// Workload Manager. Tracks agent capacity, finds the best agent for a
// task based on skills + availability, and suggests task redistribution
// when agents are overloaded.
//
// Thresholds:
//   busy:       activeTaskCount >= 3
//   overloaded: activeTaskCount >= 5

import { db } from "@/lib/db"
import {
  agents, agentTasks, tasks, collaborationEvents,
} from "@/lib/db/schema"
import { eq, and, sql, inArray, desc } from "drizzle-orm"

// ── Constants ────────────────────────────────────────────────────────

const BUSY_THRESHOLD = 3
const OVERLOADED_THRESHOLD = 5

// Scoring weights for findBestAgent
const SKILL_MATCH_WEIGHT = 0.4
const WORKLOAD_WEIGHT = 0.4
const PAST_SUCCESS_WEIGHT = 0.2

// ── Types ────────────────────────────────────────────────────────────

export interface AgentWorkload {
  agentId: string
  agentName: string
  role: string
  activeTaskCount: number
  queuedTaskCount: number
  completedToday: number
  isBusy: boolean
  estimatedCapacity: "available" | "busy" | "overloaded"
}

export interface RedistributionSuggestion {
  taskId: string
  taskTitle: string
  currentAgentId: string
  currentAgentName: string
  suggestedAgentId: string
  suggestedAgentName: string
  reason: string
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Jaccard similarity between two string arrays (case-insensitive).
 * Returns 0 if either array is empty.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a.map(s => s.toLowerCase()))
  const setB = new Set(b.map(s => s.toLowerCase()))
  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

function estimateCapacity(active: number): "available" | "busy" | "overloaded" {
  if (active >= OVERLOADED_THRESHOLD) return "overloaded"
  if (active >= BUSY_THRESHOLD) return "busy"
  return "available"
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Get workload metrics for all agents in a workspace. Counts active
 * tasks from both the agentTasks table (background work) and the tasks
 * table (user-visible kanban tasks).
 */
export async function getWorkspaceWorkload(workspaceId: string): Promise<AgentWorkload[]> {
  // Load all workspace agents
  const workspaceAgents = await db.select({
    id: agents.id,
    name: agents.name,
    role: agents.role,
  }).from(agents).where(eq(agents.workspaceId, workspaceId))

  if (workspaceAgents.length === 0) return []

  const agentIds = workspaceAgents.map(a => a.id)

  // Count agentTasks by status per agent
  const agentTaskCounts = await db
    .select({
      agentId: agentTasks.agentId,
      status: agentTasks.status,
      count: sql<number>`count(*)::int`,
    })
    .from(agentTasks)
    .where(and(
      eq(agentTasks.workspaceId, workspaceId),
      inArray(agentTasks.agentId, agentIds),
    ))
    .groupBy(agentTasks.agentId, agentTasks.status)

  // Count tasks (kanban) with status "in_progress" per agent
  const kanbanCounts = await db
    .select({
      agentId: tasks.assignedAgentId,
      count: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .where(and(
      eq(tasks.workspaceId, workspaceId),
      eq(tasks.status, "in_progress"),
      sql`${tasks.assignedAgentId} IS NOT NULL`,
    ))
    .groupBy(tasks.assignedAgentId)

  // Count tasks completed today per agent (agentTasks)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const completedTodayCounts = await db
    .select({
      agentId: agentTasks.agentId,
      count: sql<number>`count(*)::int`,
    })
    .from(agentTasks)
    .where(and(
      eq(agentTasks.workspaceId, workspaceId),
      eq(agentTasks.status, "completed"),
      sql`${agentTasks.completedAt} >= ${todayStart}`,
      inArray(agentTasks.agentId, agentIds),
    ))
    .groupBy(agentTasks.agentId)

  // Build lookup maps
  const agentTaskMap: Record<string, { running: number; queued: number }> = {}
  for (const row of agentTaskCounts) {
    if (!agentTaskMap[row.agentId]) {
      agentTaskMap[row.agentId] = { running: 0, queued: 0 }
    }
    if (row.status === "running") agentTaskMap[row.agentId].running = row.count
    if (row.status === "queued") agentTaskMap[row.agentId].queued = row.count
  }

  const kanbanMap: Record<string, number> = {}
  for (const row of kanbanCounts) {
    if (row.agentId) kanbanMap[row.agentId] = row.count
  }

  const completedMap: Record<string, number> = {}
  for (const row of completedTodayCounts) {
    completedMap[row.agentId] = row.count
  }

  return workspaceAgents.map(agent => {
    const atCounts = agentTaskMap[agent.id] || { running: 0, queued: 0 }
    const kanban = kanbanMap[agent.id] || 0
    const activeTaskCount = atCounts.running + kanban
    const queuedTaskCount = atCounts.queued

    return {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      activeTaskCount,
      queuedTaskCount,
      completedToday: completedMap[agent.id] || 0,
      isBusy: activeTaskCount >= BUSY_THRESHOLD,
      estimatedCapacity: estimateCapacity(activeTaskCount),
    }
  })
}

/**
 * Find the best available agent for a task based on skill match,
 * current workload, and past success rate.
 *
 * Scoring:
 *   - Skill match (40%): Jaccard similarity of requiredSkills vs agent.skills
 *   - Workload (40%): lower active task count = higher score
 *   - Past success (20%): ratio of completed vs total recent agentTasks
 */
export async function findBestAgent(params: {
  workspaceId: string
  requiredSkills?: string[]
  preferredRole?: string
  excludeAgentIds?: string[]
}): Promise<{ agent: { id: string; name: string; role: string }; reason: string } | null> {
  const { workspaceId, requiredSkills = [], preferredRole, excludeAgentIds = [] } = params

  // Load all workspace agents with their skills
  const workspaceAgents = await db.select({
    id: agents.id,
    name: agents.name,
    role: agents.role,
    skills: agents.skills,
    status: agents.status,
  }).from(agents).where(eq(agents.workspaceId, workspaceId))

  // Filter: exclude paused/error agents and explicitly excluded IDs
  const excludeSet = new Set(excludeAgentIds)
  const candidates = workspaceAgents.filter(
    a => !excludeSet.has(a.id) && a.status !== "paused" && a.status !== "error",
  )

  if (candidates.length === 0) return null

  // Get workload data
  const workloads = await getWorkspaceWorkload(workspaceId)
  const workloadMap: Record<string, AgentWorkload> = {}
  for (const wl of workloads) workloadMap[wl.agentId] = wl

  // Get recent success rates (last 20 tasks per agent)
  const recentTasks = await db.select({
    agentId: agentTasks.agentId,
    status: agentTasks.status,
  }).from(agentTasks)
    .where(eq(agentTasks.workspaceId, workspaceId))
    .orderBy(desc(agentTasks.createdAt))
    .limit(200) // 200 rows covers ~20 per agent for 10 agents

  const successRateMap: Record<string, number> = {}
  const taskCountMap: Record<string, { total: number; completed: number }> = {}
  for (const t of recentTasks) {
    if (!taskCountMap[t.agentId]) taskCountMap[t.agentId] = { total: 0, completed: 0 }
    taskCountMap[t.agentId].total++
    if (t.status === "completed") taskCountMap[t.agentId].completed++
  }
  for (const [agentId, counts] of Object.entries(taskCountMap)) {
    successRateMap[agentId] = counts.total > 0 ? counts.completed / counts.total : 0.5
  }

  // Find max active count for normalization
  const maxActive = Math.max(1, ...workloads.map(w => w.activeTaskCount))

  // Score each candidate
  let bestScore = -1
  let bestAgent: (typeof candidates)[0] | null = null
  let bestReason = ""

  for (const candidate of candidates) {
    const agentSkills = (candidate.skills as string[]) || []
    const wl = workloadMap[candidate.id]

    // Skill match score (0-1)
    let skillScore = 0
    if (requiredSkills.length > 0) {
      skillScore = jaccardSimilarity(requiredSkills, agentSkills)
    } else {
      // No required skills — all agents are equally matched
      skillScore = 0.5
    }

    // Role bonus: if preferredRole is specified and matches, boost skill score
    if (preferredRole && candidate.role.toLowerCase().includes(preferredRole.toLowerCase())) {
      skillScore = Math.min(1, skillScore + 0.3)
    }

    // Workload score: 1.0 for idle, 0.0 for max active
    const activeCount = wl?.activeTaskCount ?? 0
    const workloadScore = 1 - (activeCount / maxActive)

    // Past success score (0-1), default 0.5 for agents with no history
    const successScore = successRateMap[candidate.id] ?? 0.5

    const totalScore =
      (skillScore * SKILL_MATCH_WEIGHT) +
      (workloadScore * WORKLOAD_WEIGHT) +
      (successScore * PAST_SUCCESS_WEIGHT)

    if (totalScore > bestScore) {
      bestScore = totalScore
      bestAgent = candidate
      bestReason = [
        `skill match: ${(skillScore * 100).toFixed(0)}%`,
        `availability: ${(workloadScore * 100).toFixed(0)}%`,
        `success rate: ${(successScore * 100).toFixed(0)}%`,
      ].join(", ")
    }
  }

  if (!bestAgent) return null

  return {
    agent: { id: bestAgent.id, name: bestAgent.name, role: bestAgent.role },
    reason: `Best match (score: ${(bestScore * 100).toFixed(0)}%) — ${bestReason}`,
  }
}

/**
 * Suggest redistributing tasks from overloaded agents to available ones.
 * Returns suggestions — does NOT move tasks. The UI or orchestrator
 * decides whether to act on these.
 */
export async function suggestRedistribution(workspaceId: string): Promise<RedistributionSuggestion[]> {
  const workloads = await getWorkspaceWorkload(workspaceId)
  const suggestions: RedistributionSuggestion[] = []

  const overloaded = workloads.filter(w => w.estimatedCapacity === "overloaded")
  const available = workloads.filter(w => w.estimatedCapacity === "available")

  if (overloaded.length === 0 || available.length === 0) return suggestions

  // Load agents with skills for matching
  const agentSkillsMap: Record<string, string[]> = {}
  const allAgents = await db.select({
    id: agents.id,
    skills: agents.skills,
  }).from(agents).where(eq(agents.workspaceId, workspaceId))
  for (const a of allAgents) {
    agentSkillsMap[a.id] = (a.skills as string[]) || []
  }

  for (const overloadedAgent of overloaded) {
    // Get the overloaded agent's in-progress tasks (kanban tasks)
    const agentTasks_ = await db.select({
      id: tasks.id,
      title: tasks.title,
      priority: tasks.priority,
    }).from(tasks)
      .where(and(
        eq(tasks.workspaceId, workspaceId),
        eq(tasks.assignedAgentId, overloadedAgent.agentId),
        eq(tasks.status, "in_progress"),
      ))
      .orderBy(tasks.priority) // lower priority first = best to offload
      .limit(3) // suggest up to 3 redistributions per overloaded agent

    for (const task of agentTasks_) {
      // Find the best available agent by skill overlap
      let bestTarget: typeof available[0] | null = null
      let bestSim = -1

      const currentSkills = agentSkillsMap[overloadedAgent.agentId] || []

      for (const candidate of available) {
        const candidateSkills = agentSkillsMap[candidate.agentId] || []
        const sim = jaccardSimilarity(currentSkills, candidateSkills)
        if (sim > bestSim) {
          bestSim = sim
          bestTarget = candidate
        }
      }

      if (bestTarget) {
        suggestions.push({
          taskId: task.id,
          taskTitle: task.title,
          currentAgentId: overloadedAgent.agentId,
          currentAgentName: overloadedAgent.agentName,
          suggestedAgentId: bestTarget.agentId,
          suggestedAgentName: bestTarget.agentName,
          reason: `${overloadedAgent.agentName} is overloaded (${overloadedAgent.activeTaskCount} active). ${bestTarget.agentName} is available with ${(bestSim * 100).toFixed(0)}% skill overlap.`,
        })
      }
    }
  }

  return suggestions
}

// Re-export thresholds for tests
export { BUSY_THRESHOLD, OVERLOADED_THRESHOLD }
