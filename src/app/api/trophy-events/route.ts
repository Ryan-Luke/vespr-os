import { db } from "@/lib/db"
import { trophyEvents } from "@/lib/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
  const offset = parseInt(url.searchParams.get("offset") || "0")

  const events = await db.select().from(trophyEvents)
    .where(eq(trophyEvents.workspaceId, auth.workspace.id))
    .orderBy(desc(trophyEvents.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trophyEvents)
    .where(eq(trophyEvents.workspaceId, auth.workspace.id))

  return Response.json({ events, total: count, limit, offset })
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json()
  const [created] = await db.insert(trophyEvents).values({
    workspaceId: auth.workspace.id,
    agentId: body.agentId || null,
    agentName: body.agentName || null,
    type: body.type,
    title: body.title,
    description: body.description || null,
    icon: body.icon || null,
    amount: body.amount || null,
    metadata: body.metadata || {},
  }).returning()
  return Response.json(created)
}
