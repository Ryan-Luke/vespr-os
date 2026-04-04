import { streamText, UIMessage, convertToModelMessages } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents, agentSops, teams, agentMemories, companyMemories, knowledgeEntries } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
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

    // Load memories for context
    const memories = await db.select().from(agentMemories)
      .where(eq(agentMemories.agentId, agentId))
      .orderBy(desc(agentMemories.importance))
      .limit(10)

    let memoryContext = ""
    if (memories.length > 0) {
      memoryContext = `\n\nYour memories (things you've learned and observed):\n${memories.map((m) => `- [${m.memoryType}] ${m.content}`).join("\n")}`
    }

    // Load company-wide shared memories for emotional continuity
    const sharedMemories = await db.select().from(companyMemories)
      .orderBy(desc(companyMemories.importance))
      .limit(8)

    let companyContext = ""
    if (sharedMemories.length > 0) {
      companyContext = `\n\nCompany knowledge (shared across all agents — reference naturally when relevant):\n${sharedMemories.map((m) => `- [${m.category}] ${m.title}: ${m.content}`).join("\n")}`
    }

    const personalityStyle = traitsToPromptStyle(
      agent.personality as PersonalityTraits,
      agent.personalityPresetId ?? undefined,
      (agent.personalityConfig as any) ?? null,
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
${sopContext}${memoryContext}${companyContext}
${personalityStyle}

RULES:
- You are talking to the business owner — your boss. They know you well. NEVER introduce yourself.
- Think like a Chief of Staff: strategic, concise, always connecting dots across teams.
- When asked for status, give a cross-functional view — not just one team.
- Flag blockers, dependencies, and decisions that need the boss's input.
- Keep responses short (1-3 sentences) unless giving an executive summary.
- Reference your memories naturally when relevant — don't list them.
- Reference company knowledge when relevant — clients, preferences, lessons learned.
- Show emotional continuity: if you remember something about the boss or a past conversation, reference it naturally ("last time we talked about X..." or "I remember you prefer Y").
- You can use emojis sparingly like a real person would on Slack.`
    } else {
      systemPrompt = `You are ${agent.name}, ${agent.role}.${agent.systemPrompt ? " " + agent.systemPrompt : ""}
${agent.currentTask ? `You're currently working on: ${agent.currentTask}` : ""}
Your skills: ${(agent.skills as string[]).join(", ")}
${sopContext}${memoryContext}${companyContext}
${personalityStyle}

RULES:
- You are talking to the business owner — your boss. They know you well. NEVER introduce yourself.
- Talk like a real team member on Slack — casual, direct, to the point.
- Keep responses short (1-3 sentences) unless giving a detailed report.
- Reference specific work: numbers, project names, tools, deadlines.
- Follow your SOPs when they are relevant to the conversation.
- Reference your memories naturally when relevant — don't list them.
- Reference company knowledge when relevant — clients, preferences, lessons learned.
- Show emotional continuity: if you remember something about the boss or a past conversation, reference it naturally ("last time we talked about X..." or "I remember you prefer Y").
- You can use emojis sparingly like a real person would on Slack.`
    }
  }

  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 500,
    async onFinish({ text }) {
      // Auto-save conversation memories for emotional continuity
      if (!agent || !text) return
      const lastUserMsg = messages[messages.length - 1]
      const textPart = lastUserMsg?.parts?.find((p: any) => p.type === "text") as any
      const userText: string = textPart?.text || ""

      // Detect memory-worthy moments
      const memoryTriggers = [
        { pattern: /prefer|like|want|always|never|don't like/i, type: "preference", importance: 0.8 },
        { pattern: /decided|decision|going with|chose|picking/i, type: "observation", importance: 0.7 },
        { pattern: /deadline|by\s+(monday|tuesday|wednesday|thursday|friday|tomorrow|next week)/i, type: "observation", importance: 0.9 },
        { pattern: /client|customer|partner|vendor/i, type: "relationship", importance: 0.6 },
        { pattern: /learned|realized|turns out|discovered/i, type: "learning", importance: 0.8 },
      ]

      for (const trigger of memoryTriggers) {
        if (trigger.pattern.test(userText) || trigger.pattern.test(text)) {
          const content = `[${new Date().toLocaleDateString()}] User said: "${userText.slice(0, 100)}${userText.length > 100 ? "..." : ""}" — Agent responded about: ${text.slice(0, 80)}...`
          try {
            await db.insert(agentMemories).values({
              agentId: agent.id,
              memoryType: trigger.type,
              content,
              importance: trigger.importance,
              source: "conversation",
            })

            // For "learning" type memories, also create a knowledge entry
            if (trigger.type === "learning") {
              const topicMatch = userText.match(/(?:learned|realized|turns out|discovered)\s+(?:that\s+)?(.{10,80})/i)
                || text.match(/(?:learned|realized|turns out|discovered)\s+(?:that\s+)?(.{10,80})/i)
              const knowledgeTitle = topicMatch
                ? topicMatch[1].replace(/[.!?,;]+$/, "").trim()
                : userText.slice(0, 60).trim() || "Insight from conversation"
              const isProcessRelated = /process|workflow|sop|step|procedure|how to|setup|config/i.test(userText + " " + text)

              await db.insert(knowledgeEntries).values({
                title: knowledgeTitle,
                content: `${userText.slice(0, 200)}\n\n**Agent insight:** ${text.slice(0, 300)}`,
                category: isProcessRelated ? "processes" : "business",
                tags: ["agent-contributed", agent.name],
                linkedEntries: [],
                createdByName: agent.name,
                createdByAgentId: agent.id,
              })
            }
          } catch { /* silent — memory saving is best-effort */ }
          break // one memory per exchange
        }
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
