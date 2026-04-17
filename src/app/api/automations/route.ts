import { db } from "@/lib/db"
import { automations } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { guardMinRole } from "@/lib/auth/rbac"

// GET /api/automations
// List all automations for the current workspace.
export async function GET() {
  const auth = await withAuth()
  const rows = await db
    .select()
    .from(automations)
    .where(eq(automations.workspaceId, auth.workspace.id))
    .orderBy(automations.createdAt)
  return Response.json(rows)
}

// POST /api/automations
// Create a new automation (admin only).
export async function POST(req: Request) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden
  const body = await req.json()
  if (!body.name || !body.schedule) {
    return Response.json({ error: "name and schedule are required" }, { status: 400 })
  }
  const [automation] = await db.insert(automations).values({
    workspaceId: auth.workspace.id,
    name: body.name,
    description: body.description || null,
    schedule: body.schedule,
    status: body.status || "active",
    managedByAgentId: body.managedByAgentId || null,
  }).returning()
  return Response.json(automation, { status: 201 })
}

// PATCH /api/automations
// Update an existing automation.
export async function PATCH(req: Request) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden
  const { id, ...updates } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })

  const values: Record<string, unknown> = {}
  if (updates.name !== undefined) values.name = updates.name
  if (updates.description !== undefined) values.description = updates.description
  if (updates.schedule !== undefined) values.schedule = updates.schedule
  if (updates.status !== undefined) values.status = updates.status
  if (updates.managedByAgentId !== undefined) values.managedByAgentId = updates.managedByAgentId

  const [updated] = await db.update(automations)
    .set(values)
    .where(and(eq(automations.id, id), eq(automations.workspaceId, auth.workspace.id)))
    .returning()
  if (!updated) return Response.json({ error: "not found" }, { status: 404 })
  return Response.json(updated)
}

// DELETE /api/automations
// Remove an automation.
export async function DELETE(req: Request) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden
  const { id } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  await db.delete(automations).where(and(eq(automations.id, id), eq(automations.workspaceId, auth.workspace.id)))
  return Response.json({ ok: true })
}
