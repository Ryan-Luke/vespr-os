import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents, tasks, agentFeedback, messages, channels, agentSops } from "@/lib/db/schema"
import { eq, sql, desc } from "drizzle-orm"

export const maxDuration = 30

// Generate a performance review for an agent and post it in #team-leaders
export async function POST(req: Request) {
  const { agentId } = await req.json() as { agentId: string }

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 })

  // Gather performance data
  const agentTasks = await db.select().from(tasks).where(eq(tasks.assignedAgentId, agentId))
  const completedTasks = agentTasks.filter((t) => t.status === "done").length
  const inProgressTasks = agentTasks.filter((t) => t.status === "in_progress").length
  const totalTasks = agentTasks.length

  const feedbackStats = await db.select({
    rating: agentFeedback.rating,
    count: sql<number>`count(*)`,
  }).from(agentFeedback).where(eq(agentFeedback.agentId, agentId)).groupBy(agentFeedback.rating)

  const positive = Number(feedbackStats.find((f) => f.rating === "positive")?.count ?? 0)
  const negative = Number(feedbackStats.find((f) => f.rating === "negative")?.count ?? 0)

  const sops = await db.select().from(agentSops).where(eq(agentSops.agentId, agentId))

  // Calculate metrics
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const feedbackTotal = positive + negative
  const feedbackRatio = feedbackTotal > 0 ? Math.round((positive / feedbackTotal) * 100) : 50

  const result = await generateText({
    model: anthropic("claude-haiku-4.5-20250414"),
    system: `You are Aria, the QA & People Ops agent. You conduct performance reviews for AI agents. You are professional but caring, direct but encouraging.

You MUST respond with valid JSON only — no markdown, no wrapping. The JSON must have this exact shape:
{
  "rating": <number 1-5>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "recommendations": "<1-2 sentence specific actionable recommendation>"
}

Rating guide:
- 5: Exceptional — top performer, high completion rate, strong feedback, long streak
- 4: Strong — consistently good output with minor areas to grow
- 3: Solid — meeting expectations, clear room for improvement
- 2: Needs attention — falling behind on key metrics
- 1: Critical — major issues requiring immediate intervention

Be specific and reference actual numbers. Keep each strength/improvement to one concise sentence.`,
    prompt: `Performance review for ${agent.name} (${agent.role}):

Stats:
- Tasks: ${completedTasks} completed, ${inProgressTasks} in progress, ${totalTasks} total (${completionRate}% completion rate)
- Feedback: ${positive} positive, ${negative} negative (${feedbackRatio}% positive ratio)
- Level: ${agent.level ?? 1} (${agent.xp ?? 0} XP)
- Streak: ${agent.streak ?? 0} days
- Lifetime tasks completed: ${agent.tasksCompleted ?? 0}
- SOPs: ${sops.length} documented
- Model: ${agent.model}
- Autonomy: ${agent.autonomyLevel}
- Cost this month: $${agent.costThisMonth ?? 0}
- Current task: ${agent.currentTask || "none"}

Write the JSON review.`,
    maxOutputTokens: 500,
  })

  // Parse structured review from LLM response
  let review: { rating: number; summary: string; strengths: string[]; improvements: string[]; recommendations: string }
  try {
    review = JSON.parse(result.text)
  } catch {
    // Fallback if JSON parsing fails
    review = {
      rating: 3,
      summary: result.text,
      strengths: ["Consistent task execution"],
      improvements: ["Could not parse structured review"],
      recommendations: "Re-run the review for detailed analysis.",
    }
  }

  // Find QA/HR agent (Aria) or Nova to post the review
  const allAgents = await db.select().from(agents)
  const poster = allAgents.find((a) => a.role === "QA & People Ops") || allAgents.find((a) => a.role === "Chief of Staff")

  if (poster) {
    const tlChannel = await db.select().from(channels).where(eq(channels.name, "team-leaders")).limit(1)
    if (tlChannel[0]) {
      await db.insert(messages).values({
        channelId: tlChannel[0].id,
        senderAgentId: poster.id,
        senderName: poster.name,
        senderAvatar: poster.avatar,
        content: `Performance Review: ${agent.name}\n\nRating: ${review.rating}/5\n${review.summary}\n\nStrengths: ${review.strengths.join(", ")}\nImprovements: ${review.improvements.join(", ")}\nRecommendation: ${review.recommendations}`,
        messageType: "text",
      })
    }
  }

  return Response.json({ review, agent: agent.name })
}
