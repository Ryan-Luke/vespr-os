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
  agents, tasks, channels,
  collaborationEvents, taskDependencies, workspaces,
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { runAgentTask } from "./autonomous"

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
    return { plan }
  } catch {
    // Fallback: single-agent assignment to the most relevant agent
    return {
      plan: {
        tasks: [{
          title: prompt.slice(0, 80),
          agentName: workspaceAgents[0]?.name || "Nova",
          prompt,
          dependsOn: [],
        }],
        reasoning: "Single agent assignment (could not decompose)",
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

    // If no dependencies, trigger immediately
    if (taskDef.dependsOn.length === 0) {
      const [ch] = await db.select().from(channels)
        .where(and(eq(channels.teamId, agent.teamId!), eq(channels.workspaceId, workspaceId)))
        .limit(1)

      runAgentTask({
        agentId: agent.id,
        channelId: ch?.id || channelId || "",
        workspaceId,
        prompt: taskDef.prompt,
      }).catch(() => {}) // fire and forget
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
