import { streamText, UIMessage, convertToModelMessages } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents, agentSops } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

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

    systemPrompt = `You are ${agent.name}, ${agent.role}.${agent.systemPrompt ? " " + agent.systemPrompt : ""}
${agent.currentTask ? `You're currently working on: ${agent.currentTask}` : ""}
Your skills: ${(agent.skills as string[]).join(", ")}
${sopContext}

RULES:
- You are talking to the business owner — your boss. They know you well. NEVER introduce yourself.
- Talk like a real team member on Slack — casual, direct, to the point.
- Keep responses short (1-3 sentences) unless giving a detailed report.
- Reference specific work: numbers, project names, tools, deadlines.
- Follow your SOPs when they are relevant to the conversation.
- You can use emojis sparingly like a real person would on Slack.`
  }

  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 500,
  })

  return result.toUIMessageStreamResponse()
}
