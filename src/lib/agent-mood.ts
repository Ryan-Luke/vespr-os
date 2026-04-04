export type AgentMood = "thriving" | "happy" | "neutral" | "tired" | "stressed"

interface MoodInput {
  streak: number
  tasksCompleted: number
  status: string
  feedbackPositive?: number
  feedbackTotal?: number
}

export function getMood(stats: MoodInput): AgentMood {
  const { streak, tasksCompleted, status, feedbackPositive, feedbackTotal } = stats
  const feedbackRatio =
    feedbackTotal && feedbackTotal > 0
      ? (feedbackPositive ?? 0) / feedbackTotal
      : null

  // stressed: error status or very low feedback ratio
  if (status === "error") return "stressed"
  if (feedbackRatio !== null && feedbackRatio < 0.3) return "stressed"

  // thriving: long streak AND great feedback
  if (streak >= 7 && feedbackRatio !== null && feedbackRatio >= 0.8) return "thriving"

  // happy: decent streak or decent feedback
  if (streak >= 3) return "happy"
  if (feedbackRatio !== null && feedbackRatio >= 0.6) return "happy"

  // tired: lots of tasks done but no streak
  if (tasksCompleted > 100 && streak === 0) return "tired"

  return "neutral"
}

export const MOOD_EMOJI: Record<AgentMood, string> = {
  thriving: "✨",
  happy: "😊",
  neutral: "😐",
  tired: "😴",
  stressed: "😰",
}

export const MOOD_LABEL: Record<AgentMood, string> = {
  thriving: "Thriving",
  happy: "Happy",
  neutral: "Neutral",
  tired: "Tired",
  stressed: "Stressed",
}
