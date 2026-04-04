import { db } from "@/lib/db"
import { messages } from "@/lib/db/schema"
import { eq, desc, and, isNull } from "drizzle-orm"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const channelId = url.searchParams.get("channelId")
  const includeThreads = url.searchParams.get("includeThreads") === "true"

  if (!channelId) {
    return Response.json({ error: "channelId required" }, { status: 400 })
  }

  // Fetch all messages for the channel (including thread replies for counting)
  const allMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .orderBy(messages.createdAt)

  if (includeThreads) {
    return Response.json(allMessages)
  }

  // Default: return all messages (top-level + thread replies) so client can compute thread counts
  return Response.json(allMessages)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [newMessage] = await db.insert(messages).values({
    channelId: body.channelId,
    threadId: body.threadId || null,
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

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const messageId = url.searchParams.get("id")
  if (!messageId) {
    return Response.json({ error: "id required" }, { status: 400 })
  }

  // Also delete any thread replies to this message
  await db.delete(messages).where(eq(messages.threadId, messageId))
  await db.delete(messages).where(eq(messages.id, messageId))

  return Response.json({ success: true })
}
