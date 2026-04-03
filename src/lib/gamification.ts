// ── Gamification System ────────────────────────────────────
// XP, levels, milestones, and celebrations

/** XP required for each level (cumulative) */
export function xpForLevel(level: number): number {
  // Level 1: 0, Level 2: 100, Level 3: 250, Level 4: 500...
  // Roughly quadratic growth
  return Math.floor(50 * (level - 1) * level)
}

/** Calculate level from XP */
export function levelFromXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return level
}

/** XP progress within current level (0-100%) */
export function levelProgress(xp: number): number {
  const level = levelFromXp(xp)
  const currentLevelXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  const range = nextLevelXp - currentLevelXp
  if (range === 0) return 100
  return Math.round(((xp - currentLevelXp) / range) * 100)
}

/** XP rewards for different actions */
export const XP_REWARDS = {
  task_completed: 25,
  task_completed_urgent: 50,
  sop_created: 40,
  sop_updated: 15,
  positive_feedback: 10,
  message_sent: 2,
  cross_team_coordination: 30,
  approval_auto_earned: 100,
} as const

/** Level title/rank */
export function levelTitle(level: number): string {
  if (level <= 2) return "Rookie"
  if (level <= 5) return "Specialist"
  if (level <= 10) return "Expert"
  if (level <= 15) return "Senior"
  if (level <= 20) return "Lead"
  if (level <= 30) return "Director"
  if (level <= 50) return "VP"
  return "Executive"
}

/** Milestone definitions — checked when XP is awarded */
export interface MilestoneDef {
  id: string
  name: string
  description: string
  icon: string
  type: "agent" | "team" | "company"
  check: (stats: { tasksCompleted: number; xp: number; level: number; streak: number }) => boolean
}

export const MILESTONE_DEFINITIONS: MilestoneDef[] = [
  // Agent milestones
  { id: "first-task", name: "First Blood", description: "Completed first task", icon: "🎯", type: "agent", check: (s) => s.tasksCompleted >= 1 },
  { id: "ten-tasks", name: "Getting Started", description: "Completed 10 tasks", icon: "🏃", type: "agent", check: (s) => s.tasksCompleted >= 10 },
  { id: "fifty-tasks", name: "Workhorse", description: "Completed 50 tasks", icon: "🐎", type: "agent", check: (s) => s.tasksCompleted >= 50 },
  { id: "century-club", name: "Century Club", description: "Completed 100 tasks", icon: "💯", type: "agent", check: (s) => s.tasksCompleted >= 100 },
  { id: "500-tasks", name: "Machine", description: "Completed 500 tasks", icon: "🤖", type: "agent", check: (s) => s.tasksCompleted >= 500 },
  { id: "1000-tasks", name: "Legendary", description: "Completed 1,000 tasks", icon: "👑", type: "agent", check: (s) => s.tasksCompleted >= 1000 },
  { id: "level-5", name: "Specialist", description: "Reached Level 5", icon: "⭐", type: "agent", check: (s) => s.level >= 5 },
  { id: "level-10", name: "Expert", description: "Reached Level 10", icon: "🌟", type: "agent", check: (s) => s.level >= 10 },
  { id: "level-20", name: "Lead", description: "Reached Level 20", icon: "💫", type: "agent", check: (s) => s.level >= 20 },
  { id: "week-streak", name: "Consistent", description: "7-day active streak", icon: "🔥", type: "agent", check: (s) => s.streak >= 7 },
  { id: "month-streak", name: "Unstoppable", description: "30-day active streak", icon: "🔥🔥", type: "agent", check: (s) => s.streak >= 30 },
]
