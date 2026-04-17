import { db } from "@/lib/db"
import { teamGoals } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const teamId = url.searchParams.get("teamId")

  const goals = teamId
    ? await db.select().from(teamGoals).where(eq(teamGoals.teamId, teamId))
    : await db.select().from(teamGoals).where(eq(teamGoals.workspaceId, auth.workspace.id))

  return Response.json(goals)
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json()
  const [goal] = await db.insert(teamGoals).values({
    workspaceId: auth.workspace.id,
    teamId: body.teamId,
    title: body.title,
    target: body.target,
    unit: body.unit || "tasks",
  }).returning()
  return Response.json(goal)
}

export async function PATCH(req: Request) {
  const auth = await withAuth()
  const { id, progress, status } = await req.json()
  const updates: Record<string, unknown> = {}
  if (progress !== undefined) updates.progress = progress
  if (status) updates.status = status
  const [updated] = await db.update(teamGoals).set(updates).where(and(eq(teamGoals.id, id), eq(teamGoals.workspaceId, auth.workspace.id))).returning()
  return Response.json(updated)
}
