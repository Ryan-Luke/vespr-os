import { db } from "@/lib/db"
import { messages } from "@/lib/db/schema"
import { eq, desc, and, isNull } from "drizzle-orm"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const channelId = url.searchParams.get("channelId")

  if (!channelId) {
    return Response.json({ error: "channelId required" }, { status: 400 })
  }

  const channelMessages = await db
    .select()
    .from(messages)
    .where(and(eq(messages.channelId, channelId), isNull(messages.threadId)))
    .orderBy(messages.createdAt)

  return Response.json(channelMessages)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [newMessage] = await db.insert(messages).values({
    channelId: body.channelId,
    senderAgentId: body.senderAgentId || null,
    senderUserId: body.senderUserId || null,
    senderName: body.senderName,
    senderAvatar: body.senderAvatar,
    content: body.content,
    messageType: body.messageType || "text",
    linkedTaskId: body.linkedTaskId || null,
    reactions: body.reactions || [],
    metadata: body.metadata || {},
  }).returning()
  return Response.json(newMessage)
}
