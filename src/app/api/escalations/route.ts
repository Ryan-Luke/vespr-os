import { db } from "@/lib/db"
import { collaborationEvents, agents } from "@/lib/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { escalate, type EscalationSeverity } from "@/lib/agents/escalation"

// GET /api/escalations — List escalation events for the workspace
// Supports: ?severity=high, ?limit=, ?offset=
export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const severity = url.searchParams.get("severity")
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
  const offset = parseInt(url.searchParams.get("offset") || "0")

  const conditions = [
    eq(collaborationEvents.workspaceId, auth.workspace.id),
    eq(collaborationEvents.eventType, "escalated"),
  ]

  // Filter by severity if provided (stored in metadata)
  let allEvents = await db.select().from(collaborationEvents)
    .where(and(...conditions))
    .orderBy(desc(collaborationEvents.createdAt))
    .limit(limit)
    .offset(offset)

  if (severity) {
    allEvents = allEvents.filter(
      e => (e.metadata as Record<string, unknown>)?.severity === severity,
    )
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collaborationEvents)
    .where(and(...conditions))

  return Response.json({ escalations: allEvents, total: count, limit, offset })
}

// POST /api/escalations — Create a manual escalation (admin/owner only)
export async function POST(req: Request) {
  const auth = await withAuth()

  // Only owners and admins can create manual escalations
  if (auth.role !== "owner" && auth.role !== "admin") {
    return Response.json({ error: "Only workspace owners and admins can create escalations" }, { status: 403 })
  }

  const body = await req.json() as {
    agentId?: string
    reason?: string
    context?: string
    severity?: EscalationSeverity
    linkedTaskId?: string
    linkedThreadId?: string
  }

  if (!body.agentId || !body.reason || !body.severity) {
    return Response.json(
      { error: "agentId, reason, and severity are required" },
      { status: 400 },
    )
  }

  // Verify agent belongs to workspace
  const [agent] = await db.select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, body.agentId), eq(agents.workspaceId, auth.workspace.id)))
    .limit(1)

  if (!agent) {
    return Response.json({ error: "Agent not found in this workspace" }, { status: 404 })
  }

  const result = await escalate({
    workspaceId: auth.workspace.id,
    escalatingAgentId: body.agentId,
    reason: body.reason,
    context: body.context ?? "",
    severity: body.severity,
    linkedTaskId: body.linkedTaskId,
    linkedThreadId: body.linkedThreadId,
  })

  return Response.json(result)
}
