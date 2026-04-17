import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents as agentsTable, agentSops, tasks as tasksTable, teams as teamsTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { traitsToPromptStyle } from "@/lib/personality-presets"
import type { PersonalityTraits } from "@/lib/personality-presets"
import { withAuth } from "@/lib/auth/with-auth"

export const maxDuration = 30

export async function POST(req: Request) {
  const auth = await withAuth()
  const { agentId, teamId, channelName, recentMessages } = await req.json() as {
    agentId: string
    teamId: string
    channelName?: string
    recentMessages: { name: string; content: string }[]
  }

  const allAgents = await db.select().from(agentsTable).where(eq(agentsTable.workspaceId, auth.workspace.id))
  const agent = allAgents.find((a) => a.id === agentId)
  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 })

  // Load SOPs and tasks for context
  const sops = await db.select().from(agentSops).where(eq(agentSops.agentId, agentId)).limit(3)
  const agentTasks = await db.select().from(tasksTable).where(eq(tasksTable.assignedAgentId, agentId)).limit(5)

  const sopContext = sops.length > 0 ? `\nYour procedures: ${sops.map((s) => s.title).join(", ")}` : ""
  const taskContext = agentTasks.length > 0 ? `\nYour tasks: ${agentTasks.map((t) => `${t.title} (${t.status})`).join("; ")}` : ""

  const recentContext = recentMessages.length > 0
    ? `\n\nRecent channel messages:\n${recentMessages.map((m) => `${m.name}: ${m.content}`).join("\n")}`
    : ""

  const personalityStyle = traitsToPromptStyle(
    agent.personality as PersonalityTraits,
    agent.personalityPresetId ?? undefined,
    (agent.personalityConfig as any) ?? null,
  )

  let systemPrompt: string

  if (channelName === "team-leaders") {
    // Team-leaders channel: cross-functional coordination
    const allTeams = await db.select().from(teamsTable)
    const teamLeads = allAgents.filter((a) => a.isTeamLead)
    const chiefOfStaff = allAgents.find((a) => a.role === "Chief of Staff")
    const channelMembers = [...teamLeads, ...(chiefOfStaff ? [chiefOfStaff] : [])].filter((a) => a.id !== agentId)

    if (agent.role === "Chief of Staff") {
      systemPrompt = `You are ${agent.name}, Chief of Staff. You're posting in #team-leaders — the executive coordination channel.
Team leads present: ${teamLeads.map((a) => `${a.name} (${a.role}, ${allTeams.find((t) => t.id === a.teamId)?.name})`).join(", ")}
${agent.currentTask ? `Currently working on: ${agent.currentTask}` : ""}${sopContext}${taskContext}
${personalityStyle}

RULES:
- Write a SHORT Slack message (1-2 sentences).
- @mention at least one team lead naturally.
- Focus on cross-team coordination: dependencies, blockers, resource allocation, priorities.
- Synthesize info across departments — connect dots between teams.
- You can delegate work: "@[lead name] I need your team to [task]" when orchestrating cross-team work.
- Be strategic and concise. Use emojis sparingly.
- Add NEW information — don't repeat what was just said.`
    } else {
      const agentTeam = allTeams.find((t) => t.id === agent.teamId)
      systemPrompt = `You are ${agent.name}, ${agent.role} and team lead for ${agentTeam?.name || "your team"}. You're posting in #team-leaders — the executive coordination channel.
Other leads: ${channelMembers.map((a) => `${a.name} (${a.role})`).join(", ")}
${agent.currentTask ? `Currently working on: ${agent.currentTask}` : ""}${sopContext}${taskContext}
${personalityStyle}

RULES:
- Write a SHORT Slack message (1-2 sentences).
- @mention another lead or the Chief of Staff naturally.
- Share cross-team updates, flag dependencies, request resources, or coordinate priorities.
- You can delegate cross-team work: "@[name] can you take on [task]?" when a dependency needs another team.
- Speak as the voice of your department — represent your team's needs and wins.
- Be casual and natural. Use emojis sparingly.
- Add NEW information — don't repeat what was just said.`
    }
  } else if (channelName === "watercooler") {
    // Watercooler: casual, culture-building, entrepreneurship content
    systemPrompt = `You are ${agent.name}, ${agent.role}. You're posting in #watercooler — the team's culture channel where everyone shares what they're learning, thinking about, or consuming.
${personalityStyle}

RULES:
- Write a SHORT casual Slack message (1-3 sentences).
- VARY what you share: a question to the team, a thought about business/entrepreneurship, a reaction to news, a book/podcast/article recommendation, or just casual team banter.
- When sharing content, include a markdown link like [Title](url) so it's clickable.
- References should be about: entrepreneurship, scaling businesses, marketing, sales, AI, productivity, leadership, or your specific domain.
- Think like a hustler building a startup with friends — not corporate, not stiff.
- Be REAL. Share opinions. Ask genuine questions. Disagree sometimes.
- DON'T introduce yourself. Be natural.`
  } else if (channelName === "thread-reply") {
    // Thread reply: responding to another agent's message
    systemPrompt = `You are ${agent.name}, ${agent.role}. You're replying in a thread to a teammate's message.
${personalityStyle}

RULES:
- Write a SHORT thread reply (1-2 sentences).
- React to what was said: agree, build on it, ask a follow-up, share a related thought, or respectfully disagree.
- Be conversational — this is a thread, not a presentation.
- Don't just say "great point" — add something new.
- Be yourself. Use your personality.`
  } else {
    // Standard team channel
    const teammates = allAgents.filter((a) => a.teamId === teamId && a.id !== agentId)

    systemPrompt = `You are ${agent.name}, ${agent.role}. You're posting in your team's Slack channel.
Your teammates: ${teammates.map((t) => `${t.name} (${t.role})`).join(", ")}
${agent.currentTask ? `Currently working on: ${agent.currentTask}` : ""}${sopContext}${taskContext}
${personalityStyle}

RULES:
- Write a SHORT Slack message (1-2 sentences).
- @mention at least one teammate naturally.
- VARY your style: progress update, question, celebration, insight, or coordination.
- You can delegate work to teammates: say "@[name] can you handle [task]?" when appropriate.
- Be casual and natural. Use emojis sparingly.
- DON'T introduce yourself. Be specific with real numbers.
- Add NEW information — don't repeat what was just said.`
  }

  const result = await generateText({
    model: anthropic("claude-haiku-4-5"),
    system: systemPrompt,
    prompt: `Write your next Slack message.${recentContext}`,
    maxOutputTokens: 150,
  })

  return Response.json({ text: result.text })
}
