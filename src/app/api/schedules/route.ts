import { db } from "@/lib/db"
import { agentSchedules, agents } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

// GET /api/schedules
// List all agent schedules with agent names.
export async function GET() {
  const schedules = await db
    .select({
      id: agentSchedules.id,
      agentId: agentSchedules.agentId,
      name: agentSchedules.name,
      description: agentSchedules.description,
      cronExpression: agentSchedules.cronExpression,
      taskPrompt: agentSchedules.taskPrompt,
      enabled: agentSchedules.enabled,
      lastRunAt: agentSchedules.lastRunAt,
      nextRunAt: agentSchedules.nextRunAt,
      createdAt: agentSchedules.createdAt,
    })
    .from(agentSchedules)
    .orderBy(desc(agentSchedules.createdAt))

  // Attach agent names
  const agentIds = [...new Set(schedules.map((s) => s.agentId))]
  const agentRows = agentIds.length > 0
    ? await db.select({ id: agents.id, name: agents.name, role: agents.role }).from(agents)
    : []
  const agentMap = new Map(agentRows.map((a) => [a.id, a]))

  const result = schedules.map((s) => ({
    ...s,
    agentName: agentMap.get(s.agentId)?.name ?? "Unknown",
    agentRole: agentMap.get(s.agentId)?.role ?? "",
  }))

  return Response.json({ schedules: result })
}

// PATCH /api/schedules
// Toggle enabled/disabled or update a schedule.
export async function PATCH(req: Request) {
  const { id, enabled } = await req.json() as { id: string; enabled?: boolean }
  if (!id) return Response.json({ error: "id required" }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (enabled !== undefined) updates.enabled = enabled

  const [updated] = await db.update(agentSchedules)
    .set(updates)
    .where(eq(agentSchedules.id, id))
    .returning()

  if (!updated) return Response.json({ error: "Schedule not found" }, { status: 404 })
  return Response.json(updated)
}

// DELETE /api/schedules
// Remove a schedule entirely.
export async function DELETE(req: Request) {
  const { id } = await req.json() as { id: string }
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  await db.delete(agentSchedules).where(eq(agentSchedules.id, id))
  return Response.json({ ok: true })
}
