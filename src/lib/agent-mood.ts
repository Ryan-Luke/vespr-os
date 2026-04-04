// Per engagement spec Section 12: no mood states that imply neediness (sad, tired, stressed, lonely).
// Per spec Section 8.3: idle is a neutral, acceptable state. An idle agent is not a problem.
//
// Agents can be in three states: performing well, performing on track, or not yet showing signal.
// Never negative. Never guilt-inducing.

export type AgentMood = "thriving" | "on_track" | "neutral"

interface MoodInput {
  tasksCompleted: number
  status: string
  feedbackPositive?: number
  feedbackTotal?: number
}

export function getMood(stats: MoodInput): AgentMood {
  const { feedbackPositive, feedbackTotal } = stats
  const feedbackRatio =
    feedbackTotal && feedbackTotal > 0
      ? (feedbackPositive ?? 0) / feedbackTotal
      : null

  // thriving: great outcomes
  if (feedbackRatio !== null && feedbackRatio >= 0.8) return "thriving"

  // on_track: positive feedback
  if (feedbackRatio !== null && feedbackRatio >= 0.6) return "on_track"

  return "neutral"
}

export const MOOD_EMOJI: Record<AgentMood, string> = {
  thriving: "✨",
  on_track: "📈",
  neutral: "",
}

export const MOOD_LABEL: Record<AgentMood, string> = {
  thriving: "Thriving",
  on_track: "On track",
  neutral: "",
}
