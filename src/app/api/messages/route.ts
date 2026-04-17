import { db } from "@/lib/db"
import { channels, messages } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { messageSchema } from "@/lib/validation"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const channelId = url.searchParams.get("channelId")
  const includeThreads = url.searchParams.get("includeThreads") === "true"
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 200)
  const offset = parseInt(url.searchParams.get("offset") || "0")

  if (!channelId) {
    return Response.json({ error: "channelId required" }, { status: 400 })
  }

  // Verify the channel belongs to the user's workspace
  const [channel] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.workspaceId, auth.workspace.id)))

  if (!channel) {
    return Response.json({ error: "Channel not found" }, { status: 404 })
  }

  const conditions = and(eq(messages.channelId, channelId), eq(messages.workspaceId, auth.workspace.id))

  // Fetch messages for the channel with pagination
  const allMessages = await db
    .select()
    .from(messages)
    .where(conditions)
    .orderBy(messages.createdAt)
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(conditions)

  return Response.json({ messages: allMessages, total: count, limit, offset })
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json()
  const parsed = messageSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || "Invalid message data" }, { status: 400 })
  }
  const [newMessage] = await db.insert(messages).values({
    workspaceId: auth.workspace.id,
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

export async function PATCH(req: Request) {
  const auth = await withAuth()
  const body = await req.json()
  const { id, reactions } = body
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (reactions !== undefined) updates.reactions = reactions

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 })
  }

  // Only update if the message belongs to the user's workspace
  const [updated] = await db
    .update(messages)
    .set(updates)
    .where(and(eq(messages.id, id), eq(messages.workspaceId, auth.workspace.id)))
    .returning()

  if (!updated) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  return Response.json(updated)
}

export async function DELETE(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const messageId = url.searchParams.get("id")
  if (!messageId) {
    return Response.json({ error: "id required" }, { status: 400 })
  }

  // Verify the message belongs to the user's workspace before deleting
  const [msg] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.workspaceId, auth.workspace.id)))

  if (!msg) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  // Also delete any thread replies to this message (scoped to workspace)
  await db.delete(messages).where(and(eq(messages.threadId, messageId), eq(messages.workspaceId, auth.workspace.id)))
  await db.delete(messages).where(and(eq(messages.id, messageId), eq(messages.workspaceId, auth.workspace.id)))

  return Response.json({ success: true })
}
