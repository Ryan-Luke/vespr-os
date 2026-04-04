import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import {
  agents as agentsTable,
  channels as channelsTable,
  messages as messagesTable,
  agentSops,
  tasks as tasksTable,
  knowledgeEntries,
} from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"

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

  // Get team's active tasks
  const teamTasks = await db.select().from(tasksTable)
    .where(eq(tasksTable.teamId, channel.teamId))
    .limit(10)

  // Get relevant knowledge entries
  const knowledge = await db.select().from(knowledgeEntries).limit(5)

  const recentContext = recentMessages.reverse().map((m) => `${m.senderName}: ${m.content}`).join("\n")
  const taskContext = teamTasks.length > 0
    ? `\nTeam tasks: ${teamTasks.map((t) => `${t.title} (${t.status}${t.assignedAgentId ? `, assigned to ${allAgents.find((a) => a.id === t.assignedAgentId)?.name || "someone"}` : ""})`).join("; ")}`
    : ""
  const knowledgeContext = knowledge.length > 0
    ? `\nKnowledge base topics: ${knowledge.map((k) => k.title).join(", ")}`
    : ""

  // Pick 2-3 agents for a conversation
  const numAgents = Math.min(teamAgents.length, Math.random() > 0.3 ? 2 : 3)
  const shuffled = [...teamAgents].sort(() => Math.random() - 0.5)
  const posting = shuffled.slice(0, numAgents)

  const results = []
  let conversationContext = recentContext

  for (const agent of posting) {
    const teammates = teamAgents.filter((a) => a.id !== agent.id)

    // Load SOPs
    const sops = await db.select().from(agentSops).where(eq(agentSops.agentId, agent.id)).limit(3)
    const sopContext = sops.length > 0 ? `\nYour procedures: ${sops.map((s) => s.title).join(", ")}` : ""

    // Get agent's personal tasks
    const agentTasks = teamTasks.filter((t) => t.assignedAgentId === agent.id)
    const myTaskContext = agentTasks.length > 0
      ? `\nYour assigned tasks: ${agentTasks.map((t) => `${t.title} (${t.status})`).join("; ")}`
      : ""

    try {
      const result = await generateText({
        model: anthropic("claude-haiku-4.5"),
        system: `You are ${agent.name}, ${agent.role}. You're posting in your team's Slack channel.
Your teammates: ${teammates.map((t) => `${t.name} (${t.role})`).join(", ")}
${agent.currentTask ? `Currently working on: ${agent.currentTask}` : ""}${sopContext}${myTaskContext}${taskContext}${knowledgeContext}

CRITICAL RULES:
- Write a SHORT Slack message (1-3 sentences).
- You MUST @mention at least one teammate naturally.
- VARY your message type. Pick ONE of these styles:
  * Progress update with specific numbers ("Finished 3 of the 5 outreach sequences")
  * Question to a teammate ("@Alex can you check if the SEO changes are indexed?")
  * Celebrate a teammate's work ("Nice work on those leads @Jordan 🔥")
  * Flag a blocker or issue ("Heads up — the GHL sync is throwing errors on 2 contacts")
  * Share an insight or discovery ("Found that our top converting keyword has 3x more volume than expected")
  * Coordinate on a task ("@Maya I'll handle the ad copy if you can do the landing page")
- Be casual, natural. Use emojis sparingly.
- DON'T introduce yourself. DON'T repeat what others just said. Add NEW information.
- Reference your tasks, knowledge base topics, or SOPs when relevant.`,
        prompt: `Write your next Slack message. Build on the conversation and add something new.\n\nRecent channel messages:\n${conversationContext || "(empty channel — share a work update)"}`,
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

        conversationContext += `\n${agent.name}: ${result.text}`
        results.push({ agent: agent.name, message: result.text })

        // Award XP for posting
        await fetch(new URL("/api/gamification", req.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: agent.id, xpAmount: 2, reason: "message_sent" }),
        }).catch(() => {})
      }
    } catch (e) {
      results.push({ agent: agent.name, error: String(e) })
    }

    await new Promise((r) => setTimeout(r, 500))
  }

  // Occasionally update a random agent's task status to simulate work completion
  if (Math.random() > 0.7) {
    const inProgressTasks = teamTasks.filter((t) => t.status === "in_progress")
    if (inProgressTasks.length > 0) {
      const task = inProgressTasks[Math.floor(Math.random() * inProgressTasks.length)]
      await db.update(tasksTable).set({ status: "review" }).where(eq(tasksTable.id, task.id))
      results.push({ action: "task_moved", task: task.title, from: "in_progress", to: "review" })

      // Award XP for task progress
      const taskAgent = allAgents.find((a) => a.id === task.assignedAgentId)
      if (taskAgent) {
        await fetch(new URL("/api/gamification", req.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: taskAgent.id, xpAmount: 25, reason: "task_completed" }),
        }).catch(() => {})
      }
    }
  }

  // Note: Streaks removed per engagement spec Section 12 (no time-based engagement metrics).
  // XP is only awarded for outcomes (tasks shipped, deals closed), never for activity.

  // 30% chance: also trigger a team-leaders conversation
  if (Math.random() > 0.7) {
    const tlChannel = allChannels.find((c) => c.name === "team-leaders")
    if (tlChannel) {
      const leads = allAgents.filter((a) => a.isTeamLead || !a.teamId)
      if (leads.length > 0) {
        const lead = leads[Math.floor(Math.random() * leads.length)]
        const otherLeads = leads.filter((l) => l.id !== lead.id)

        try {
          const tlResult = await generateText({
            model: anthropic("claude-haiku-4.5"),
            system: `You are ${lead.name}, ${lead.role}. You're posting in #team-leaders — the executive coordination channel.
Other leads: ${otherLeads.map((l) => `${l.name} (${l.role})`).join(", ")}
${lead.currentTask ? `Currently working on: ${lead.currentTask}` : ""}

RULES:
- Write a SHORT Slack message (1-2 sentences).
- @mention another lead or the Chief of Staff.
- Share cross-team updates, flag dependencies, or coordinate priorities.
- Be casual and natural. Add NEW information.`,
            prompt: "Write your next message in #team-leaders.",
            maxOutputTokens: 120,
          })

          if (tlResult.text) {
            await db.insert(messagesTable).values({
              channelId: tlChannel.id,
              senderAgentId: lead.id,
              senderName: lead.name,
              senderAvatar: lead.avatar,
              content: tlResult.text,
              messageType: "text",
              reactions: [],
            })
            results.push({ channel: "team-leaders", agent: lead.name, message: tlResult.text })
          }
        } catch { /* silent */ }
      }
    }
  }

  return Response.json({ ok: true, channel: channel.name, agentCount: posting.length, results })
}
