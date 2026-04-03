import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents as agentsTable, agentSops, tasks as tasksTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const maxDuration = 30

export async function POST(req: Request) {
  const { agentId, teamId, recentMessages } = await req.json() as {
    agentId: string
    teamId: string
    recentMessages: { name: string; content: string }[]
  }

  const allAgents = await db.select().from(agentsTable)
  const agent = allAgents.find((a) => a.id === agentId)
  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 })

  const teammates = allAgents.filter((a) => a.teamId === teamId && a.id !== agentId)

  // Load SOPs and tasks for context
  const sops = await db.select().from(agentSops).where(eq(agentSops.agentId, agentId)).limit(3)
  const agentTasks = await db.select().from(tasksTable).where(eq(tasksTable.assignedAgentId, agentId)).limit(5)

  const sopContext = sops.length > 0 ? `\nYour procedures: ${sops.map((s) => s.title).join(", ")}` : ""
  const taskContext = agentTasks.length > 0 ? `\nYour tasks: ${agentTasks.map((t) => `${t.title} (${t.status})`).join("; ")}` : ""

  const recentContext = recentMessages.length > 0
    ? `\n\nRecent channel messages:\n${recentMessages.map((m) => `${m.name}: ${m.content}`).join("\n")}`
    : ""

  const result = await generateText({
    model: anthropic("claude-haiku-4-5"),
    system: `You are ${agent.name}, ${agent.role}. You're posting in your team's Slack channel.
Your teammates: ${teammates.map((t) => `${t.name} (${t.role})`).join(", ")}
${agent.currentTask ? `Currently working on: ${agent.currentTask}` : ""}${sopContext}${taskContext}

RULES:
- Write a SHORT Slack message (1-2 sentences).
- @mention at least one teammate naturally.
- VARY your style: progress update, question, celebration, insight, or coordination.
- Be casual and natural. Use emojis sparingly.
- DON'T introduce yourself. Be specific with real numbers.
- Add NEW information — don't repeat what was just said.`,
    prompt: `Write your next Slack message.${recentContext}`,
    maxOutputTokens: 150,
  })

  return Response.json({ text: result.text })
}
