import { db } from "@/lib/db"
import { evolutionEvents, agents } from "@/lib/db/schema"
import { eq, isNull, desc, and } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

// Get unacknowledged evolution events (shows modal on next session)
export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const onlyUnacknowledged = url.searchParams.get("unacknowledged") === "true"

  const rows = onlyUnacknowledged
    ? await db.select().from(evolutionEvents).where(and(eq(evolutionEvents.workspaceId, auth.workspace.id), isNull(evolutionEvents.acknowledgedAt))).orderBy(desc(evolutionEvents.occurredAt))
    : await db.select().from(evolutionEvents).where(eq(evolutionEvents.workspaceId, auth.workspace.id)).orderBy(desc(evolutionEvents.occurredAt))

  // Enrich with agent data
  const enriched = await Promise.all(
    rows.map(async (ev) => {
      const [ag] = await db.select().from(agents).where(eq(agents.id, ev.agentId)).limit(1)
      return { ...ev, agent: ag || null }
    })
  )

  return Response.json(enriched)
}

// Mark an evolution event as acknowledged (user dismissed the modal)
export async function PATCH(req: Request) {
  const auth = await withAuth()
  const { id } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })

  await db.update(evolutionEvents).set({ acknowledgedAt: new Date() }).where(and(eq(evolutionEvents.id, id), eq(evolutionEvents.workspaceId, auth.workspace.id)))
  return Response.json({ success: true })
}
