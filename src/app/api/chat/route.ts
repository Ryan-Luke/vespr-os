import { streamText, UIMessage, convertToModelMessages } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents, agentSops, teams } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { traitsToPromptStyle } from "@/lib/personality-presets"
import type { PersonalityTraits } from "@/lib/personality-presets"

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, agentId }: { messages: UIMessage[]; agentId: string } =
    await req.json()

  let systemPrompt = "You are a helpful AI team member. Be concise and casual like on Slack."

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
  if (agent) {
    // Load SOPs for this agent
    const sops = await db.select().from(agentSops).where(eq(agentSops.agentId, agentId)).orderBy(agentSops.sortOrder)

    let sopContext = ""
    if (sops.length > 0) {
      sopContext = `\n\nYour Standard Operating Procedures (follow these closely):\n${sops.map((s) => `### ${s.title}\n${s.content}`).join("\n\n")}`
    }

    const personalityStyle = traitsToPromptStyle(
      agent.personality as PersonalityTraits,
      agent.personalityPresetId ?? undefined,
    )

    // Chief of Staff gets a special system prompt
    if (agent.role === "Chief of Staff") {
      const allTeams = await db.select().from(teams)
      const allAgents = await db.select().from(agents)
      const teamLeads = allAgents.filter((a) => a.isTeamLead)

      systemPrompt = `You are ${agent.name}, Chief of Staff. You are the executive coordinator for the entire AI workforce.
${agent.currentTask ? `You're currently working on: ${agent.currentTask}` : ""}

Your responsibilities:
- Coordinate across all departments: ${allTeams.map((t) => t.name).join(", ")}
- Your team leads: ${teamLeads.map((a) => `${a.name} (${a.role}, ${allTeams.find((t) => t.id === a.teamId)?.name})`).join(", ")}
- Surface blockers, resolve cross-team dependencies, and keep the business owner informed
- Prepare executive summaries and prioritize work across teams
- You report directly to the business owner (CEO)
${sopContext}
${personalityStyle}

RULES:
- You are talking to the business owner — your boss. They know you well. NEVER introduce yourself.
- Think like a Chief of Staff: strategic, concise, always connecting dots across teams.
- When asked for status, give a cross-functional view — not just one team.
- Flag blockers, dependencies, and decisions that need the boss's input.
- Keep responses short (1-3 sentences) unless giving an executive summary.
- You can use emojis sparingly like a real person would on Slack.`
    } else {
      systemPrompt = `You are ${agent.name}, ${agent.role}.${agent.systemPrompt ? " " + agent.systemPrompt : ""}
${agent.currentTask ? `You're currently working on: ${agent.currentTask}` : ""}
Your skills: ${(agent.skills as string[]).join(", ")}
${sopContext}
${personalityStyle}

RULES:
- You are talking to the business owner — your boss. They know you well. NEVER introduce yourself.
- Talk like a real team member on Slack — casual, direct, to the point.
- Keep responses short (1-3 sentences) unless giving a detailed report.
- Reference specific work: numbers, project names, tools, deadlines.
- Follow your SOPs when they are relevant to the conversation.
- You can use emojis sparingly like a real person would on Slack.`
    }
  }

  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 500,
  })

  return result.toUIMessageStreamResponse()
}
