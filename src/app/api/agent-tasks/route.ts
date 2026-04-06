import { db } from "@/lib/db"
import { agentTasks } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { runAgentTask } from "@/lib/agents/autonomous"

// GET /api/agent-tasks?workspaceId=XXX&status=failed
// List tasks for a workspace, optionally filtered by status.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId")
  const status = url.searchParams.get("status")

  if (!workspaceId) {
    return Response.json({ error: "workspaceId required" }, { status: 400 })
  }

  const conditions = [eq(agentTasks.workspaceId, workspaceId)]
  if (status) conditions.push(eq(agentTasks.status, status))

  const tasks = await db.select().from(agentTasks)
    .where(and(...conditions))
    .orderBy(desc(agentTasks.createdAt))
    .limit(50)

  return Response.json({ tasks })
}

// POST /api/agent-tasks/retry
// Retry a failed or stuck task by its ID.
export async function POST(req: Request) {
  const { taskId } = await req.json() as { taskId?: string }
  if (!taskId) {
    return Response.json({ error: "taskId required" }, { status: 400 })
  }

  const [task] = await db.select().from(agentTasks)
    .where(eq(agentTasks.id, taskId))
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
    workspaceId: task.workspaceId ?? "",
    prompt: task.prompt,
    context: (task.context ?? {}) as Record<string, unknown>,
  })

  return Response.json(result)
}
