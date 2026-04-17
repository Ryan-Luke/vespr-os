// Cross-agent orchestrator. Routes complex requests to the right agents,
// decomposes multi-step plans, manages task dependencies, and triggers
// downstream work when blockers are resolved.
//
// Entry points:
//   1. routeTask() — LLM-based decomposition of a complex prompt
//   2. executePlan() — Create tasks + dependencies and trigger ready ones
//   3. checkDependencies() — Unblock downstream tasks when a dep completes

import { db } from "@/lib/db"
import {
  agents, tasks, channels, agentTasks,
  collaborationEvents, taskDependencies, workspaces, notifications,
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { runAgentTask } from "./autonomous"
import { findBestAgent } from "./workload"
import { checkAuthority, type ActionType } from "./authority"
import { escalateIfStuck } from "./escalation"

// ── Types ────────────────────────────────────────────────────────────

export interface TaskPlan {
  tasks: { title: string; agentName: string; prompt: string; dependsOn: number[] }[]
  reasoning: string
  requiresMultipleAgents?: boolean
}

// ── Route: decompose a complex prompt into a multi-agent plan ────────

export async function routeTask(params: {
  workspaceId: string
  prompt: string
  requestingUserId?: string
  requestingAgentId?: string
  urgency?: "low" | "normal" | "high" | "urgent"
}): Promise<{ plan: TaskPlan }> {
  const { workspaceId, prompt } = params

  // Load all agents for the workspace
  const workspaceAgents = await db.select({
    id: agents.id,
    name: agents.name,
    role: agents.role,
    skills: agents.skills,
    status: agents.status,
    teamId: agents.teamId,
    archetype: agents.archetype,
  }).from(agents).where(eq(agents.workspaceId, workspaceId))

  // Load workspace API key for LLM calls
  const [ws] = await db.select({ anthropicApiKey: workspaces.anthropicApiKey })
    .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
  const apiKey = ws?.anthropicApiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { plan: { tasks: [], reasoning: "No API key configured" } }

  const anthropic = createAnthropic({ apiKey })

  // Ask LLM to decompose the work
  const { text } = await generateText({
    model: anthropic("claude-haiku-4-5"),
    maxOutputTokens: 2000,
    system: `You are a task routing engine for a business workspace. Given a request and a list of available agents, determine the best plan.

Available agents:
${workspaceAgents.map(a => `- ${a.name} (${a.role}, skills: ${(a.skills as string[]).join(", ")})`).join("\n")}

Return a JSON object with this structure:
{
  "tasks": [
    {
      "title": "brief task title",
      "agentName": "name of the best agent for this",
      "prompt": "specific instructions for this agent",
      "dependsOn": []
    }
  ],
  "reasoning": "brief explanation of why this decomposition",
  "requiresMultipleAgents": true
}

Rules:
- If the request is simple, assign to ONE agent only
- Only decompose into multiple tasks when genuinely needed
- Match agents by role and skills
- Keep task prompts specific and actionable
- Include dependencies when order matters (0-based indices)`,
    prompt,
  })

  try {
    const plan = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim()) as TaskPlan

    // Enhance plan with workload-aware agent selection: for each task,
    // if the LLM-suggested agent is overloaded, find a better match
    for (const taskDef of plan.tasks) {
      const suggestedAgent = workspaceAgents.find(
        a => a.name.toLowerCase() === taskDef.agentName.toLowerCase(),
      )
      if (!suggestedAgent) {
        // Agent name from LLM not found — use workload-aware fallback
        const best = await findBestAgent({
          workspaceId,
          preferredRole: taskDef.agentName, // treat as role hint
        })
        if (best) taskDef.agentName = best.agent.name
      }
    }

    return { plan }
  } catch {
    // Fallback: workload-aware single-agent assignment
    const best = await findBestAgent({ workspaceId })
    const fallbackName = best?.agent.name || workspaceAgents[0]?.name || "Nova"
    return {
      plan: {
        tasks: [{
          title: prompt.slice(0, 80),
          agentName: fallbackName,
          prompt,
          dependsOn: [],
        }],
        reasoning: `Single agent assignment to ${fallbackName} (could not decompose)`,
        requiresMultipleAgents: false,
      },
    }
  }
}

// ── Execute: turn a plan into real tasks with dependencies ──────────

export async function executePlan(params: {
  workspaceId: string
  plan: TaskPlan
  channelId?: string
}): Promise<{ taskIds: string[]; status: string }> {
  const { workspaceId, plan, channelId } = params

  const workspaceAgents = await db.select().from(agents)
    .where(eq(agents.workspaceId, workspaceId))
  const taskIds: string[] = []

  // Create tasks in order
  for (let i = 0; i < plan.tasks.length; i++) {
    const taskDef = plan.tasks[i]
    const agent = workspaceAgents.find(
      a => a.name.toLowerCase() === taskDef.agentName.toLowerCase(),
    )
    if (!agent) continue

    // Create the task record
    const [task] = await db.insert(tasks).values({
      workspaceId,
      title: taskDef.title,
      description: taskDef.prompt,
      assignedAgentId: agent.id,
      teamId: agent.teamId,
      status: taskDef.dependsOn.length > 0 ? "backlog" : "in_progress",
      priority: "high",
    }).returning()

    taskIds.push(task.id)

    // Log the collaboration event
    await db.insert(collaborationEvents).values({
      workspaceId,
      eventType: "task_delegated",
      sourceAgentId: null,
      targetAgentId: agent.id,
      taskId: task.id,
      summary: `Task "${taskDef.title}" assigned to ${agent.name}`,
      metadata: { planIndex: i, reasoning: plan.reasoning },
    })

    // If no dependencies, trigger immediately (with authority check)
    if (taskDef.dependsOn.length === 0) {
      const [ch] = await db.select().from(channels)
        .where(and(eq(channels.teamId, agent.teamId!), eq(channels.workspaceId, workspaceId)))
        .limit(1)

      // Check if the task involves an action that needs authority
      const externalActions: ActionType[] = ["send_email", "publish_content", "contact_external", "make_commitment"]
      const promptLower = taskDef.prompt.toLowerCase()
      let authorityBlocked = false

      for (const action of externalActions) {
        // Heuristic: if the prompt mentions the action type, check authority
        const actionWords = action.replace(/_/g, " ")
        if (promptLower.includes(actionWords) || promptLower.includes(action)) {
          const auth = await checkAuthority({
            agentId: agent.id,
            workspaceId,
            action,
          })
          if (!auth.allowed && auth.level === "blocked") {
            authorityBlocked = true
            await db.insert(collaborationEvents).values({
              workspaceId,
              eventType: "blocked",
              targetAgentId: agent.id,
              taskId: task.id,
              summary: `Task blocked: agent lacks authority for "${action}". ${auth.reason ?? ""}`,
            })
            break
          }
        }
      }

      if (!authorityBlocked) {
        runAgentTask({
          agentId: agent.id,
          channelId: ch?.id || channelId || "",
          workspaceId,
          prompt: taskDef.prompt,
        }).catch(() => {}) // fire and forget
      }
    }
  }

  // Create dependencies
  for (let i = 0; i < plan.tasks.length; i++) {
    for (const depIdx of plan.tasks[i].dependsOn) {
      if (taskIds[depIdx] && taskIds[i]) {
        await db.insert(taskDependencies).values({
          workspaceId,
          taskId: taskIds[i],
          dependsOnTaskId: taskIds[depIdx],
        })
      }
    }
  }

  return { taskIds, status: "executing" }
}

// ── Check Dependencies: unblock downstream tasks on completion ──────

export async function checkDependencies(workspaceId: string, completedTaskId: string) {
  const deps = await db.select().from(taskDependencies)
    .where(and(
      eq(taskDependencies.dependsOnTaskId, completedTaskId),
      eq(taskDependencies.status, "pending"),
      eq(taskDependencies.workspaceId, workspaceId),
    ))

  for (const dep of deps) {
    // Mark this dependency as satisfied
    await db.update(taskDependencies)
      .set({ status: "satisfied", satisfiedAt: new Date() })
      .where(eq(taskDependencies.id, dep.id))

    // Check if ALL dependencies for the blocked task are now satisfied
    const remaining = await db.select().from(taskDependencies)
      .where(and(
        eq(taskDependencies.taskId, dep.taskId),
        eq(taskDependencies.status, "pending"),
      ))

    if (remaining.length === 0) {
      // All dependencies satisfied — trigger the task
      const [blockedTask] = await db.select().from(tasks)
        .where(eq(tasks.id, dep.taskId)).limit(1)

      if (blockedTask?.assignedAgentId) {
        await db.update(tasks).set({ status: "in_progress" })
          .where(eq(tasks.id, dep.taskId))

        const [agent] = await db.select().from(agents)
          .where(eq(agents.id, blockedTask.assignedAgentId)).limit(1)
        const [ch] = await db.select().from(channels)
          .where(and(
            eq(channels.teamId, agent?.teamId!),
            eq(channels.workspaceId, workspaceId),
          ))
          .limit(1)

        await db.insert(collaborationEvents).values({
          workspaceId,
          eventType: "unblocked",
          targetAgentId: blockedTask.assignedAgentId,
          taskId: dep.taskId,
          summary: `Task "${blockedTask.title}" unblocked — all dependencies satisfied`,
        })

        runAgentTask({
          agentId: blockedTask.assignedAgentId,
          channelId: ch?.id || "",
          workspaceId,
          prompt: `Work on this task: "${blockedTask.title}". ${blockedTask.description || ""}`,
        }).catch(() => {})
      }
    }
  }
}

// ── Check Stuck Tasks: escalate tasks that haven't progressed ────────

/**
 * Scan for tasks that have been in_progress or running for too long
 * and escalate them. Designed to be called by the cron job.
 *
 * Returns the number of escalations triggered.
 */
export async function checkStuckTasks(workspaceId: string): Promise<number> {
  const now = Date.now()
  let escalations = 0

  // Check agentTasks stuck in "running"
  const runningTasks = await db.select().from(agentTasks)
    .where(and(
      eq(agentTasks.workspaceId, workspaceId),
      eq(agentTasks.status, "running"),
    ))

  for (const task of runningTasks) {
    const startTime = task.startedAt?.getTime() ?? task.createdAt.getTime()
    const stuckMinutes = Math.floor((now - startTime) / 60000)

    const result = await escalateIfStuck({
      workspaceId,
      taskId: task.id,
      taskTitle: task.prompt.slice(0, 80),
      assignedAgentId: task.agentId,
      stuckSinceMinutes: stuckMinutes,
    })

    if (result) escalations++
  }

  // Check kanban tasks stuck in "in_progress"
  const stuckKanban = await db.select().from(tasks)
    .where(and(
      eq(tasks.workspaceId, workspaceId),
      eq(tasks.status, "in_progress"),
    ))

  for (const task of stuckKanban) {
    if (!task.assignedAgentId) continue
    const createdTime = task.createdAt.getTime()
    const stuckMinutes = Math.floor((now - createdTime) / 60000)

    const result = await escalateIfStuck({
      workspaceId,
      taskId: task.id,
      taskTitle: task.title,
      assignedAgentId: task.assignedAgentId,
      stuckSinceMinutes: stuckMinutes,
    })

    if (result) escalations++
  }

  return escalations
}

// ── Handle task failure in dependency chain ────────────────────────
// When a task fails, notify downstream blocked tasks and create
// notifications so the user knows the chain is stalled.
export async function handleTaskFailure(workspaceId: string, failedTaskId: string) {
  try {
    const deps = await db.select().from(taskDependencies)
      .where(and(
        eq(taskDependencies.dependsOnTaskId, failedTaskId),
        eq(taskDependencies.status, "pending"),
      ))

    for (const dep of deps) {
      await db.insert(notifications).values({
        workspaceId,
        type: "task_failed",
        title: "Dependency chain stalled",
        description: `A task in the dependency chain failed. Downstream tasks are blocked.`,
        actionUrl: "/tasks",
        read: false,
      })

      await db.update(taskDependencies)
        .set({ status: "canceled" })
        .where(eq(taskDependencies.id, dep.id))
    }
  } catch {} // best-effort
}
