import { db } from "@/lib/db"
import { agentTasks } from "@/lib/db/schema"
import { eq, desc, and, sql } from "drizzle-orm"
import { runAgentTask } from "@/lib/agents/autonomous"
import { withAuth } from "@/lib/auth/with-auth"

// GET /api/agent-tasks?status=failed
// List tasks for the authenticated workspace, optionally filtered by status.
export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
  const offset = parseInt(url.searchParams.get("offset") || "0")

  const conditions = [eq(agentTasks.workspaceId, auth.workspace.id)]
  if (status) conditions.push(eq(agentTasks.status, status))

  const tasks = await db.select().from(agentTasks)
    .where(and(...conditions))
    .orderBy(desc(agentTasks.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentTasks)
    .where(and(...conditions))

  return Response.json({ tasks, total: count, limit, offset })
}

// POST /api/agent-tasks/retry
// Retry a failed or stuck task by its ID.
export async function POST(req: Request) {
  const auth = await withAuth()
  const { taskId } = await req.json() as { taskId?: string }
  if (!taskId) {
    return Response.json({ error: "taskId required" }, { status: 400 })
  }

  const [task] = await db.select().from(agentTasks)
    .where(and(eq(agentTasks.id, taskId), eq(agentTasks.workspaceId, auth.workspace.id)))
    .limit(1)

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 })
  }

  if (task.status !== "failed" && task.status !== "running") {
    return Response.json({ error: "Task is not in a retryable state" }, { status: 400 })
  }

  // Reset status and re-run
  await db.update(agentTasks).set({
    status: "queued",
    error: null,
    updatedAt: new Date(),
  }).where(eq(agentTasks.id, taskId))

  const result = await runAgentTask({
    agentId: task.agentId,
    channelId: task.channelId ?? "",
    workspaceId: auth.workspace.id,
    prompt: task.prompt,
    context: (task.context ?? {}) as Record<string, unknown>,
  })

  return Response.json(result)
}
