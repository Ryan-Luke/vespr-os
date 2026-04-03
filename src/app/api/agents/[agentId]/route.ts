import { db } from "@/lib/db"
import { agents } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = {}

  if (body.status !== undefined) updates.status = body.status
  if (body.currentTask !== undefined) updates.currentTask = body.currentTask
  if (body.systemPrompt !== undefined) updates.systemPrompt = body.systemPrompt
  if (body.isTeamLead !== undefined) updates.isTeamLead = body.isTeamLead

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 })
  }

  updates.updatedAt = new Date()

  const [updated] = await db
    .update(agents)
    .set(updates)
    .where(eq(agents.id, agentId))
    .returning()

  if (!updated) {
    return Response.json({ error: "Agent not found" }, { status: 404 })
  }

  return Response.json(updated)
}
