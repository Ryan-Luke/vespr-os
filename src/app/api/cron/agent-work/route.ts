import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents as agentsTable, channels as channelsTable, messages as messagesTable } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"

export const maxDuration = 60

// Verify cron secret to prevent unauthorized access
function verifyCron(req: Request): boolean {
  const authHeader = req.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  // Allow in development
  if (process.env.NODE_ENV === "development") return true
  return false
}

export async function GET(req: Request) {
  if (!verifyCron(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const allAgents = await db.select().from(agentsTable)
  const allChannels = await db.select().from(channelsTable)
  const teamChannels = allChannels.filter((c) => c.teamId)

  // Pick a random team channel and 1-2 agents to post
  const channel = teamChannels[Math.floor(Math.random() * teamChannels.length)]
  if (!channel?.teamId) return Response.json({ ok: true, message: "No team channels" })

  const teamAgents = allAgents.filter((a) => a.teamId === channel.teamId)
  if (teamAgents.length === 0) return Response.json({ ok: true, message: "No agents in team" })

  // Get recent messages for context
  const recentMessages = await db.select().from(messagesTable)
    .where(eq(messagesTable.channelId, channel.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(5)

  const recentContext = recentMessages.reverse().map((m) => `${m.senderName}: ${m.content}`).join("\n")

  // Have 1-2 agents post
  const numAgents = Math.random() > 0.5 ? 2 : 1
  const shuffled = [...teamAgents].sort(() => Math.random() - 0.5)
  const posting = shuffled.slice(0, numAgents)

  const results = []

  for (const agent of posting) {
    const teammates = teamAgents.filter((a) => a.id !== agent.id)

    try {
      const result = await generateText({
        model: anthropic("claude-haiku-4-5"),
        system: `You are ${agent.name}, ${agent.role}. You're posting in your team's Slack channel.
Your teammates: ${teammates.map((t) => `${t.name} (${t.role})`).join(", ")}
${agent.currentTask ? `Currently working on: ${agent.currentTask}` : ""}

RULES:
- Write a SHORT Slack message (1-2 sentences) updating your team or responding to a teammate.
- Be casual, natural — like a real person on Slack.
- Reference specific work: numbers, project names, tools, deadlines.
- You can @mention teammates by name.
- Use emojis sparingly. DON'T introduce yourself. Be specific.`,
        prompt: `Write your next Slack message.${recentContext ? `\n\nRecent messages:\n${recentContext}` : ""}`,
        maxOutputTokens: 150,
      })

      if (result.text) {
        const [saved] = await db.insert(messagesTable).values({
          channelId: channel.id,
          senderAgentId: agent.id,
          senderName: agent.name,
          senderAvatar: agent.avatar,
          content: result.text,
          messageType: "text",
          reactions: [],
        }).returning()
        results.push({ agent: agent.name, message: result.text })
      }
    } catch (e) {
      results.push({ agent: agent.name, error: String(e) })
    }
  }

  return Response.json({ ok: true, channel: channel.name, results })
}
