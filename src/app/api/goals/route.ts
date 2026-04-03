import { db } from "@/lib/db"
import { teamGoals } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const teamId = url.searchParams.get("teamId")

  const goals = teamId
    ? await db.select().from(teamGoals).where(eq(teamGoals.teamId, teamId))
    : await db.select().from(teamGoals)

  return Response.json(goals)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [goal] = await db.insert(teamGoals).values({
    teamId: body.teamId,
    title: body.title,
    target: body.target,
    unit: body.unit || "tasks",
  }).returning()
  return Response.json(goal)
}

export async function PATCH(req: Request) {
  const { id, progress, status } = await req.json()
  const updates: Record<string, unknown> = {}
  if (progress !== undefined) updates.progress = progress
  if (status) updates.status = status
  const [updated] = await db.update(teamGoals).set(updates).where(eq(teamGoals.id, id)).returning()
  return Response.json(updated)
}
