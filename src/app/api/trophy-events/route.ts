import { db } from "@/lib/db"
import { trophyEvents } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId")

  const query = workspaceId
    ? db.select().from(trophyEvents).where(eq(trophyEvents.workspaceId, workspaceId)).orderBy(desc(trophyEvents.createdAt))
    : db.select().from(trophyEvents).orderBy(desc(trophyEvents.createdAt))

  const events = await query
  return Response.json(events)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [created] = await db.insert(trophyEvents).values({
    workspaceId: body.workspaceId || null,
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
