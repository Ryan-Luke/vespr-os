import { db } from "@/lib/db"
import { messages } from "@/lib/db/schema"
import { eq, desc, and, isNull } from "drizzle-orm"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get("channelId")

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
  const [newMessage] = await db.insert(messages).values(body).returning()
  return Response.json(newMessage)
}
