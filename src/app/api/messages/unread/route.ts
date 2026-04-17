import { db } from "@/lib/db"
import { messages } from "@/lib/db/schema"
import { gte, sql, eq, and } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const since = url.searchParams.get("since")

  // Default: messages from last 4 hours
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 4 * 60 * 60 * 1000)

  // Per-channel unread counts
  const result = await db
    .select({
      channelId: messages.channelId,
      count: sql<number>`count(*)::int`,
    })
    .from(messages)
    .where(and(eq(messages.workspaceId, auth.workspace.id), gte(messages.createdAt, sinceDate)))
    .groupBy(messages.channelId)

  // Total count
  const total = result.reduce((sum, r) => sum + (r.count ?? 0), 0)

  return Response.json({
    total,
    byChannel: Object.fromEntries(result.map((r) => [r.channelId, r.count])),
  })
}
