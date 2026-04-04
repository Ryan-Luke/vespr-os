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

/** XP rewards — outcome-based allowlist only.
 * Per engagement spec Section 6.3: XP may ONLY be granted for business outcomes.
 * NEVER grant XP for logins, messages, time in app, or interactions.
 */
export const XP_REWARDS = {
  qualified_lead: 15,
  meeting_booked: 30,
  deal_closed_small: 100,      // < $5k
  deal_closed_medium: 250,     // $5k-25k
  deal_closed_large: 500,      // $25k+
  revenue_influenced: 5,       // per $100 influenced
  task_shipped: 25,            // task completed and accepted by user
  sop_authored: 40,
  sop_adopted: 20,             // when other agents reference it
  document_delivered: 30,
} as const

/** Forbidden XP sources — enforced at service layer. Do NOT add to this list. */
export const FORBIDDEN_XP_SOURCES = [
  "login",
  "message_sent",
  "time_in_app",
  "interaction_count",
  "streak",
] as const

/** Validates that an XP source is in the allowlist. Returns true if allowed. */
export function isValidXpSource(source: string): boolean {
  return Object.keys(XP_REWARDS).includes(source)
}

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
  // Outcome-based only per engagement spec. No streaks.
  { id: "first-task", name: "First Shipment", description: "Shipped first task", icon: "🎯", type: "agent", check: (s) => s.tasksCompleted >= 1 },
  { id: "ten-tasks", name: "On The Board", description: "Shipped 10 tasks", icon: "🏃", type: "agent", check: (s) => s.tasksCompleted >= 10 },
  { id: "fifty-tasks", name: "Workhorse", description: "Shipped 50 tasks", icon: "🐎", type: "agent", check: (s) => s.tasksCompleted >= 50 },
  { id: "century-club", name: "Century Club", description: "Shipped 100 tasks", icon: "💯", type: "agent", check: (s) => s.tasksCompleted >= 100 },
  { id: "500-tasks", name: "Machine", description: "Shipped 500 tasks", icon: "🤖", type: "agent", check: (s) => s.tasksCompleted >= 500 },
  { id: "1000-tasks", name: "Legendary", description: "Shipped 1,000 tasks", icon: "👑", type: "agent", check: (s) => s.tasksCompleted >= 1000 },
  { id: "level-5", name: "Specialist", description: "Reached Level 5", icon: "⭐", type: "agent", check: (s) => s.level >= 5 },
  { id: "level-10", name: "Expert", description: "Reached Level 10", icon: "🌟", type: "agent", check: (s) => s.level >= 10 },
  { id: "level-20", name: "Lead", description: "Reached Level 20", icon: "💫", type: "agent", check: (s) => s.level >= 20 },
]
