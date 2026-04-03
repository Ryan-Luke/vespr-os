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

  const result = await generateText({
    model: anthropic("claude-haiku-4-5"),
    system: `You are the QA/HR Director for an AI company. You write concise, actionable performance reviews.

Format your review as a short Slack message (3-5 sentences). Include:
- Overall performance assessment (strong/adequate/needs improvement)
- Key strength
- Area for improvement
- Specific recommendation (add a skill, adjust personality, change autonomy level, etc.)

Be direct and constructive. Use numbers when available.`,
    prompt: `Performance review for ${agent.name} (${agent.role}):

Stats:
- Tasks: ${completedTasks} completed, ${inProgressTasks} in progress, ${totalTasks} total
- Feedback: ${positive} positive, ${negative} negative
- Level: ${agent.level ?? 1} (${agent.xp ?? 0} XP)
- Streak: ${agent.streak ?? 0} days
- SOPs: ${sops.length} documented
- Model: ${agent.model}
- Autonomy: ${agent.autonomyLevel}
- Current task: ${agent.currentTask || "none"}

Write the review.`,
    maxOutputTokens: 300,
  })

  // Find QA/HR agent or Nova to post the review
  const allAgents = await db.select().from(agents)
  const qaAgent = allAgents.find((a) => a.role === "QA Director") || allAgents.find((a) => a.role === "Chief of Staff")

  if (qaAgent) {
    const tlChannel = await db.select().from(channels).where(eq(channels.name, "team-leaders")).limit(1)
    if (tlChannel[0]) {
      await db.insert(messages).values({
        channelId: tlChannel[0].id,
        senderAgentId: qaAgent.id,
        senderName: qaAgent.name,
        senderAvatar: qaAgent.avatar,
        content: `📋 **Performance Review: ${agent.name}**\n\n${result.text}`,
        messageType: "text",
      })
    }
  }

  return Response.json({ review: result.text, agent: agent.name })
}
