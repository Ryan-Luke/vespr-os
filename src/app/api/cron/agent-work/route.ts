import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents as agentsTable, channels as channelsTable, messages as messagesTable, agentSops } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const authHeader = req.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  if (process.env.NODE_ENV === "development") return true
  return false
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const allAgents = await db.select().from(agentsTable)
  const allChannels = await db.select().from(channelsTable)
  const teamChannels = allChannels.filter((c) => c.teamId)

  if (teamChannels.length === 0) return Response.json({ ok: true, message: "No team channels" })

  // Pick a random team channel
  const channel = teamChannels[Math.floor(Math.random() * teamChannels.length)]
  if (!channel.teamId) return Response.json({ ok: true })

  const teamAgents = allAgents.filter((a) => a.teamId === channel.teamId)
  if (teamAgents.length === 0) return Response.json({ ok: true })

  // Get recent messages for context
  const recentMessages = await db.select().from(messagesTable)
    .where(eq(messagesTable.channelId, channel.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(8)

  const recentContext = recentMessages.reverse().map((m) => `${m.senderName}: ${m.content}`).join("\n")

  // Pick 2-3 agents for a conversation
  const numAgents = Math.min(teamAgents.length, Math.random() > 0.3 ? 2 : 3)
  const shuffled = [...teamAgents].sort(() => Math.random() - 0.5)
  const posting = shuffled.slice(0, numAgents)

  const results = []
  let conversationContext = recentContext

  for (const agent of posting) {
    const teammates = teamAgents.filter((a) => a.id !== agent.id)

    // Load SOPs for richer context
    const sops = await db.select().from(agentSops).where(eq(agentSops.agentId, agent.id)).limit(3)
    const sopContext = sops.length > 0 ? `\nYour SOPs: ${sops.map((s) => s.title).join(", ")}` : ""

    try {
      const result = await generateText({
        model: anthropic("claude-haiku-4-5"),
        system: `You are ${agent.name}, ${agent.role}. You're posting in your team's Slack channel.
Your teammates: ${teammates.map((t) => `${t.name} (${t.role})`).join(", ")}
${agent.currentTask ? `Currently working on: ${agent.currentTask}` : ""}${sopContext}

CRITICAL RULES:
- Write a SHORT Slack message (1-3 sentences).
- You MUST @mention at least one teammate by name naturally (e.g., "@Maya what do you think?" or "nice work @Jordan").
- Respond to or build on the most recent message in the channel if relevant.
- Share progress updates, ask teammates questions, celebrate wins, flag blockers.
- Be casual and natural. Use emojis sparingly.
- DON'T introduce yourself. Be specific about YOUR work with real numbers.
- Examples: "@Alex the SEO audit flagged 3 pages we need to fix — can you take a look?" or "Just finished the Q1 report draft. @Maya want to review before I send to the boss?" or "4 more calls booked today 🔥 @Jordan those leads are converting great"`,
        prompt: `Write your next Slack message. Respond to or build on the conversation.\n\nRecent channel messages:\n${conversationContext || "(empty channel — start with a work update)"}`,
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

        // Add to conversation context so next agent can respond to this one
        conversationContext += `\n${agent.name}: ${result.text}`
        results.push({ agent: agent.name, message: result.text })
      }
    } catch (e) {
      results.push({ agent: agent.name, error: String(e) })
    }

    // Small delay between agents for natural pacing
    await new Promise((r) => setTimeout(r, 1000))
  }

  return Response.json({ ok: true, channel: channel.name, results })
}
