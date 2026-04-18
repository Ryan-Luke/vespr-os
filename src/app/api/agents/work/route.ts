import { db } from "@/lib/db"
import { tasks, agentTasks, channels } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { runAgentTask } from "@/lib/agents/autonomous"

// POST /api/agents/work
// Scan for in_progress tasks that need agent work and trigger them.
// This is the user-facing equivalent of the cron job — call it to
// kick agents into action on stalled tasks.
export async function POST() {
  const auth = await withAuth()
  const workspaceId = auth.workspace.id

  // Find in_progress tasks with assigned agents
  const inProgress = await db.select().from(tasks)
    .where(and(
      eq(tasks.status, "in_progress"),
      eq(tasks.workspaceId, workspaceId),
    ))
    .limit(20)

  const triggered: string[] = []
  const skipped: string[] = []

  for (const task of inProgress) {
    if (!task.assignedAgentId) {
      skipped.push(task.title)
      continue
    }

    // Check if agent already has a running task
    const [running] = await db.select({ id: agentTasks.id }).from(agentTasks)
      .where(and(
        eq(agentTasks.agentId, task.assignedAgentId),
        eq(agentTasks.workspaceId, workspaceId),
        eq(agentTasks.status, "running"),
      ))
      .limit(1)

    if (running) {
      skipped.push(task.title + " (agent busy)")
      continue
    }

    // Find channel for agent
    const [ch] = task.teamId
      ? await db.select().from(channels).where(and(eq(channels.teamId, task.teamId), eq(channels.workspaceId, workspaceId))).limit(1)
      : await db.select().from(channels).where(and(eq(channels.name, "general"), eq(channels.workspaceId, workspaceId))).limit(1)

    if (!ch) {
      skipped.push(task.title + " (no channel)")
      continue
    }

    // Fire and forget — don't await so we can trigger multiple
    runAgentTask({
      agentId: task.assignedAgentId,
      channelId: ch.id,
      workspaceId,
      prompt: `Work on this task: "${task.title}". ${task.description || ""}`,
    }).catch(() => {})

    triggered.push(task.title)

    // Rate limit spacing — 3 seconds between triggers
    if (triggered.length < 5) {
      await new Promise(r => setTimeout(r, 3000))
    }

    // Cap at 5 per request
    if (triggered.length >= 5) break
  }

  return Response.json({
    ok: true,
    triggered: triggered.length,
    triggeredTasks: triggered,
    skipped: skipped.length,
    skippedTasks: skipped,
    remaining: inProgress.length - triggered.length - skipped.length,
  })
}
