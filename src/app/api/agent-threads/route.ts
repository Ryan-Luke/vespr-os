import { db } from "@/lib/db"
import { agentThreads, agentThreadMessages } from "@/lib/db/schema"
import { eq, desc, and, sql } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { startAgentThread } from "@/lib/agents/consultation"

// GET /api/agent-threads — List threads for the workspace
// Supports: ?status=active|resolved|archived|escalated, ?limit=, ?offset=
export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
  const offset = parseInt(url.searchParams.get("offset") || "0")

  const conditions = [eq(agentThreads.workspaceId, auth.workspace.id)]
  if (status) conditions.push(eq(agentThreads.status, status))

  const threads = await db.select().from(agentThreads)
    .where(and(...conditions))
    .orderBy(desc(agentThreads.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentThreads)
    .where(and(...conditions))

  return Response.json({ threads, total: count, limit, offset })
}

// POST /api/agent-threads — Start a new agent collaboration thread
// Body: { initiatorAgentId, targetAgentName, subject, initialMessage, type?, linkedTaskId? }
// Restricted to owner/admin roles.
export async function POST(req: Request) {
  const auth = await withAuth()
  if (auth.role !== "owner" && auth.role !== "admin") {
    return Response.json({ error: "Only owners and admins can start agent threads" }, { status: 403 })
  }

  const body = await req.json()
  const { initiatorAgentId, targetAgentName, subject, initialMessage, type, linkedTaskId } = body

  if (!initiatorAgentId || !targetAgentName || !subject || !initialMessage) {
    return Response.json({
      error: "initiatorAgentId, targetAgentName, subject, and initialMessage are required",
    }, { status: 400 })
  }

  try {
    const result = await startAgentThread({
      workspaceId: auth.workspace.id,
      initiatorAgentId,
      targetAgentName,
      subject,
      initialMessage,
      type,
      linkedTaskId,
    })

    return Response.json(result, { status: 201 })
  } catch (err) {
    return Response.json({
      error: err instanceof Error ? err.message : "Failed to start thread",
    }, { status: 500 })
  }
}
