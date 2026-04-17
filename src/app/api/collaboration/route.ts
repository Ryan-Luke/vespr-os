import { db } from "@/lib/db"
import { collaborationEvents } from "@/lib/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

// GET /api/collaboration — List collaboration events for the workspace
// Supports: ?type=task_delegated|agent_consulted|..., ?agentId=, ?limit=, ?offset=
export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const eventType = url.searchParams.get("type")
  const agentId = url.searchParams.get("agentId")
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
  const offset = parseInt(url.searchParams.get("offset") || "0")

  const conditions = [eq(collaborationEvents.workspaceId, auth.workspace.id)]
  if (eventType) conditions.push(eq(collaborationEvents.eventType, eventType))
  if (agentId) {
    // Match events where the agent is either source or target
    conditions.push(
      sql`(${collaborationEvents.sourceAgentId} = ${agentId} OR ${collaborationEvents.targetAgentId} = ${agentId})`,
    )
  }

  const events = await db.select().from(collaborationEvents)
    .where(and(...conditions))
    .orderBy(desc(collaborationEvents.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collaborationEvents)
    .where(and(...conditions))

  return Response.json({ events, total: count, limit, offset })
}
