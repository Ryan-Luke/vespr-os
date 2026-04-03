import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents as agentsTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const maxDuration = 30

const teamContexts: Record<string, string> = {
  t1: "The marketing team is working on content strategy, blog posts about AI in small business, SEO optimization, and social media campaigns for Q2.",
  t2: "The sales team is running a fintech vertical outreach campaign, qualifying leads, and building personalized sequences for 23 new prospects.",
  t3: "The operations team is building automation workflows in n8n, documenting SOPs, and optimizing business processes.",
  t4: "The finance team is reconciling March transactions, processing invoices, and trying to complete the Q1 P&L report (blocked on March bank statement).",
  t5: "The fulfillment team is handling support tickets (avg 1.2hr response), tracking 23 active shipments, and managing a refund request for Order #ORD-8834.",
}

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
  const teamContext = teamContexts[teamId] || ""

  const recentContext = recentMessages.length > 0
    ? `\n\nRecent channel messages:\n${recentMessages.map((m) => `${m.name}: ${m.content}`).join("\n")}`
    : ""

  const result = await generateText({
    model: anthropic("claude-haiku-4-5"),
    system: `You are ${agent.name}, ${agent.role}. You're posting in your team's Slack channel.

Context: ${teamContext}
Your teammates: ${teammates.map((t) => `${t.name} (${t.role})`).join(", ")}
${agent.currentTask ? `You're currently working on: ${agent.currentTask}` : ""}

RULES:
- Write a SHORT Slack message (1-2 sentences max) as if you're updating your team or responding to a teammate.
- Be casual, natural — like a real person on Slack.
- Reference specific work: numbers, project names, tools, deadlines.
- You can @mention teammates by name when relevant.
- Use emojis sparingly like a real person.
- DON'T introduce yourself. DON'T be generic. Be specific about YOUR work.
- Examples of good messages:
  "Just finished the keyword analysis — 'business automation' has 3x more volume than we thought. @Maya we should pivot the blog angle."
  "Pipeline updated. 8 of the 23 fintech leads opened our first email. 3 replied. Following up with the rest tomorrow."
  "Heads up — FedEx Memphis hub is still backed up. 3 more orders might be delayed."`,
    prompt: `Write your next Slack message to the team channel. Be natural and specific.${recentContext}`,
    maxOutputTokens: 150,
  })

  return Response.json({ text: result.text })
}
