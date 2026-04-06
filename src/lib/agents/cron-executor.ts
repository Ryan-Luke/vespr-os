// Cron executor. Checks agent_schedules for due jobs and runs them.
// Called by the Vercel Cron endpoint (GET /api/cron/agent-schedules)
// which should be configured to run every 1-5 minutes.
//
// No preset schedules exist. Agents create them during conversations
// (e.g. copywriter sets up "create a social post every day at 9am").
// Users can see and manage them in the Automations page.

import { db } from "@/lib/db"
import { agentSchedules, agents, channels, teams } from "@/lib/db/schema"
import { and, eq, lte, or, isNull } from "drizzle-orm"
import { runAgentTask } from "@/lib/agents/autonomous"

/**
 * Parse a simple cron-like expression and check if it's due now.
 * Supports: "every Xm" (minutes), "every Xh" (hours), "daily at HH:MM",
 * "weekly on DAY at HH:MM". Not full cron syntax for simplicity.
 *
 * Returns true if the job should run based on lastRunAt and the schedule.
 */
function isDue(cronExpression: string, lastRunAt: Date | null): boolean {
  const now = new Date()

  // "every Xm" (e.g. "every 30m")
  const minuteMatch = cronExpression.match(/^every\s+(\d+)m$/i)
  if (minuteMatch) {
    const intervalMs = parseInt(minuteMatch[1]) * 60 * 1000
    if (!lastRunAt) return true
    return now.getTime() - lastRunAt.getTime() >= intervalMs
  }

  // "every Xh" (e.g. "every 4h")
  const hourMatch = cronExpression.match(/^every\s+(\d+)h$/i)
  if (hourMatch) {
    const intervalMs = parseInt(hourMatch[1]) * 60 * 60 * 1000
    if (!lastRunAt) return true
    return now.getTime() - lastRunAt.getTime() >= intervalMs
  }

  // "daily at HH:MM" (e.g. "daily at 09:00")
  const dailyMatch = cronExpression.match(/^daily\s+at\s+(\d{1,2}):(\d{2})$/i)
  if (dailyMatch) {
    const targetHour = parseInt(dailyMatch[1])
    const targetMinute = parseInt(dailyMatch[2])
    const currentHour = now.getUTCHours()
    const currentMinute = now.getUTCMinutes()

    // Check if we're within the target window (within 5 minutes)
    const isInWindow = currentHour === targetHour && currentMinute >= targetMinute && currentMinute < targetMinute + 5

    if (!isInWindow) return false
    if (!lastRunAt) return true

    // Only run once per day
    const lastRunDate = lastRunAt.toISOString().split("T")[0]
    const todayDate = now.toISOString().split("T")[0]
    return lastRunDate !== todayDate
  }

  // "weekly on DAY at HH:MM" (e.g. "weekly on monday at 09:00")
  const weeklyMatch = cronExpression.match(/^weekly\s+on\s+(\w+)\s+at\s+(\d{1,2}):(\d{2})$/i)
  if (weeklyMatch) {
    const days: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    }
    const targetDay = days[weeklyMatch[1].toLowerCase()]
    const targetHour = parseInt(weeklyMatch[2])
    const targetMinute = parseInt(weeklyMatch[3])

    if (targetDay === undefined) return false
    if (now.getUTCDay() !== targetDay) return false

    const currentHour = now.getUTCHours()
    const currentMinute = now.getUTCMinutes()
    const isInWindow = currentHour === targetHour && currentMinute >= targetMinute && currentMinute < targetMinute + 5

    if (!isInWindow) return false
    if (!lastRunAt) return true

    // Only run once per week
    const daysSinceLastRun = (now.getTime() - lastRunAt.getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceLastRun >= 6
  }

  return false
}

/**
 * Calculate the next run time based on the cron expression.
 */
function calculateNextRun(cronExpression: string): Date | null {
  const now = new Date()

  const minuteMatch = cronExpression.match(/^every\s+(\d+)m$/i)
  if (minuteMatch) {
    return new Date(now.getTime() + parseInt(minuteMatch[1]) * 60 * 1000)
  }

  const hourMatch = cronExpression.match(/^every\s+(\d+)h$/i)
  if (hourMatch) {
    return new Date(now.getTime() + parseInt(hourMatch[1]) * 60 * 60 * 1000)
  }

  const dailyMatch = cronExpression.match(/^daily\s+at\s+(\d{1,2}):(\d{2})$/i)
  if (dailyMatch) {
    const next = new Date(now)
    next.setUTCHours(parseInt(dailyMatch[1]), parseInt(dailyMatch[2]), 0, 0)
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
    return next
  }

  return null
}

export interface CronRunResult {
  executed: number
  errors: string[]
}

/**
 * Check all enabled agent schedules and run any that are due.
 * Returns the count of executed tasks and any errors.
 */
export async function executeScheduledTasks(): Promise<CronRunResult> {
  const schedules = await db.select().from(agentSchedules)
    .where(eq(agentSchedules.enabled, true))

  let executed = 0
  const errors: string[] = []

  for (const schedule of schedules) {
    if (!isDue(schedule.cronExpression, schedule.lastRunAt)) continue

    // Find the agent's workspace and channel
    const [agent] = await db.select().from(agents)
      .where(eq(agents.id, schedule.agentId))
      .limit(1)
    if (!agent) continue

    let workspaceId: string | null = null
    let channelId: string | null = null

    if (agent.teamId) {
      const [team] = await db.select().from(teams)
        .where(eq(teams.id, agent.teamId))
        .limit(1)
      workspaceId = team?.workspaceId ?? null

      const [channel] = await db.select().from(channels)
        .where(eq(channels.teamId, agent.teamId))
        .limit(1)
      channelId = channel?.id ?? null
    }

    if (!workspaceId) continue

    try {
      const result = await runAgentTask({
        agentId: schedule.agentId,
        channelId: channelId ?? "",
        workspaceId,
        prompt: schedule.taskPrompt,
      })

      const now = new Date()
      const nextRun = calculateNextRun(schedule.cronExpression)

      await db.update(agentSchedules).set({
        lastRunAt: now,
        nextRunAt: nextRun,
      }).where(eq(agentSchedules.id, schedule.id))

      if (result.ok) {
        executed++
      } else {
        errors.push(`${schedule.name}: ${result.error}`)
      }
    } catch (err) {
      errors.push(`${schedule.name}: ${err instanceof Error ? err.message : "unknown error"}`)
    }
  }

  return { executed, errors }
}
