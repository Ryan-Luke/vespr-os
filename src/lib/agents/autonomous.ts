// Autonomous agent engine. Lets agents take initiative, post to channels,
// produce documents, hand off work to other departments, and fire wins.
// This is the core of "AI runs your business" vs "AI responds when asked."
//
// Two main entry points:
//   1. postAgentMessage() - write a message to any channel as an agent
//   2. runAgentTask() - give an agent a task prompt, let it run with tools,
//      and persist all output (messages, documents, wins, handoffs)
//
// The task runner uses generateText (not streamText) because there's no
// client stream to write to. The agent works in the background.

import { generateText, tool, jsonSchema } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import {
  agents, messages, channels, knowledgeEntries, trophyEvents,
  teamGoals, teams, agentSops, agentMemories, companyMemories,
} from "@/lib/db/schema"
import { eq, desc, ilike, or, and } from "drizzle-orm"
import { traitsToPromptStyle } from "@/lib/personality-presets"
import type { PersonalityTraits } from "@/lib/personality-presets"
import { buildIntegrationTools } from "@/lib/integrations/tools"

// ── Post a message to a channel as an agent ──────────────────────────

export async function postAgentMessage(
  agentId: string,
  channelId: string,
  content: string,
): Promise<string> {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
  if (!agent) throw new Error(`Agent not found: ${agentId}`)

  const [msg] = await db.insert(messages).values({
    channelId,
    senderAgentId: agent.id,
    senderName: agent.name,
    senderAvatar: agent.avatar,
    content,
    messageType: "text",
  }).returning()

  return msg.id
}

// ── Build the autonomous tool set ────────────────────────────────────

function buildAutonomousTools(agentId: string, workspaceId: string) {
  return {
    post_to_channel: tool({
      description:
        "Post a message to a channel as yourself. Use this to greet users, share updates, ask questions, or announce results. Pick the right channel: your department channel for work, team-leaders for cross-department updates, wins for celebrating milestones.",
      inputSchema: jsonSchema<{ channelName: string; content: string }>({
        type: "object",
        properties: {
          channelName: {
            type: "string",
            description: "The channel name (lowercase, hyphenated). Examples: team-leaders, wins, watercooler, marketing, research-&-development",
          },
          content: { type: "string", minLength: 1, maxLength: 4000 },
        },
        required: ["channelName", "content"],
        additionalProperties: false,
      }),
      execute: async ({ channelName, content }) => {
        try {
          const [channel] = await db.select().from(channels)
            .where(eq(channels.name, channelName)).limit(1)
          if (!channel) return { ok: false, error: `Channel "${channelName}" not found` }
          const msgId = await postAgentMessage(agentId, channel.id, content)
          return { ok: true, messageId: msgId, channel: channelName }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Failed to post" }
        }
      },
    }),

    create_document: tool({
      description:
        "Create a structured business document that appears in the Knowledge section. Use this when you've gathered enough information to produce a deliverable: business overview, research report, marketing plan, content strategy, competitor analysis, etc. Write in clean markdown. Be thorough and specific. This is a real artifact the user will reference.",
      inputSchema: jsonSchema<{
        title: string
        content: string
        category: string
        tags?: string[]
      }>({
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          content: { type: "string", minLength: 50, maxLength: 20000 },
          category: {
            type: "string",
            description: "business, clients, campaigns, processes, metrics, financial",
          },
          tags: { type: "array", items: { type: "string" }, maxItems: 10 },
        },
        required: ["title", "content", "category"],
        additionalProperties: false,
      }),
      execute: async ({ title, content, category, tags }) => {
        try {
          const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
          const [entry] = await db.insert(knowledgeEntries).values({
            title,
            content,
            category,
            tags: tags ?? [],
            createdByName: agent?.name ?? "Agent",
            createdByAgentId: agentId,
          }).returning()
          return { ok: true, documentId: entry.id, title }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Failed to create document" }
        }
      },
    }),

    post_win: tool({
      description:
        "Announce a win in the wins channel. Use this when something worth celebrating happened: a document was completed, a first draft is ready, a milestone was hit, a goal was reached. Keep it short and punchy. The user should feel momentum.",
      inputSchema: jsonSchema<{ title: string; description: string; icon?: string }>({
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 100 },
          description: { type: "string", minLength: 1, maxLength: 500 },
          icon: { type: "string", maxLength: 4 },
        },
        required: ["title", "description"],
        additionalProperties: false,
      }),
      execute: async ({ title, description, icon }) => {
        try {
          const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
          // Create trophy event
          await db.insert(trophyEvents).values({
            agentId,
            agentName: agent?.name ?? "Agent",
            type: "milestone",
            title,
            description,
            icon: icon ?? "🏆",
          })
          // Also post to wins channel
          const [winsChannel] = await db.select().from(channels)
            .where(eq(channels.name, "wins")).limit(1)
          if (winsChannel) {
            await postAgentMessage(agentId, winsChannel.id, `${icon ?? "🏆"} **${title}**\n${description}`)
          }
          return { ok: true, title }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Failed to post win" }
        }
      },
    }),

    handoff_to_department: tool({
      description:
        "Hand off work to another department's lead. Posts a summary in the team-leaders channel and then triggers the target department's lead to start working. Use this when your phase of work is complete and the next department needs to pick it up.",
      inputSchema: jsonSchema<{
        targetDepartment: string
        summary: string
        nextSteps: string
      }>({
        type: "object",
        properties: {
          targetDepartment: {
            type: "string",
            description: "The department name to hand off to. Examples: Marketing, Sales, Operations, Finance, Delivery",
          },
          summary: { type: "string", minLength: 10, maxLength: 2000 },
          nextSteps: { type: "string", minLength: 10, maxLength: 1000 },
        },
        required: ["targetDepartment", "summary", "nextSteps"],
        additionalProperties: false,
      }),
      execute: async ({ targetDepartment, summary, nextSteps }) => {
        try {
          // Find the target team lead
          const [targetTeam] = await db.select().from(teams)
            .where(ilike(teams.name, `%${targetDepartment}%`)).limit(1)
          let targetLead: { id: string; name: string; role: string } | null = null
          if (targetTeam) {
            const [lead] = await db.select().from(agents)
              .where(and(eq(agents.teamId, targetTeam.id), eq(agents.isTeamLead, true))).limit(1)
            if (lead) targetLead = { id: lead.id, name: lead.name, role: lead.role }
          }

          // Post handoff in team-leaders
          const [tlChannel] = await db.select().from(channels)
            .where(eq(channels.name, "team-leaders")).limit(1)
          const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
          if (tlChannel) {
            const handoffMsg = `**Handoff to ${targetDepartment}**\n\n${summary}\n\n**Next steps for ${targetLead?.name ?? targetDepartment}:** ${nextSteps}`
            await postAgentMessage(agentId, tlChannel.id, handoffMsg)
          }

          // Trigger the target lead to start working (async, fire and forget)
          if (targetLead && targetTeam) {
            // Find the target department's channel
            const [deptChannel] = await db.select().from(channels)
              .where(ilike(channels.name, `%${targetDepartment.toLowerCase().replace(/\s+/g, "-")}%`)).limit(1)
            if (deptChannel) {
              // Queue a background task for the target lead
              // This is a fire-and-forget fetch to our own API
              const taskUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/agent-tasks/run`
              fetch(taskUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  agentId: targetLead.id,
                  channelId: deptChannel.id,
                  workspaceId,
                  prompt: `${agent?.name ?? "A colleague"} from R&D just handed off work to your department. Here's their summary:\n\n${summary}\n\nYour next steps: ${nextSteps}\n\nGreet the business owner in your department channel and start working on the next steps. Be proactive. Show you've read the handoff.`,
                }),
              }).catch(() => {}) // fire and forget
            }
          }

          return {
            ok: true,
            handedOffTo: targetLead?.name ?? targetDepartment,
            postedToTeamLeaders: true,
          }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Handoff failed" }
        }
      },
    }),

    set_department_goal: tool({
      description:
        "Set a goal for your department. Goals appear on the dashboard and help the user track progress. Examples: 'Complete business overview document' with target 1, 'Create 5 social media posts' with target 5.",
      inputSchema: jsonSchema<{ title: string; target: number; unit: string }>({
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          target: { type: "number", minimum: 1 },
          unit: { type: "string", description: "tasks, documents, posts, leads, etc." },
        },
        required: ["title", "target", "unit"],
        additionalProperties: false,
      }),
      execute: async ({ title, target, unit }) => {
        try {
          const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
          if (!agent?.teamId) return { ok: false, error: "Agent has no team" }
          const [goal] = await db.insert(teamGoals).values({
            teamId: agent.teamId,
            title,
            target,
            unit,
          }).returning()
          return { ok: true, goalId: goal.id, title }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Failed to set goal" }
        }
      },
    }),
  }
}

/**
 * Public version of the autonomous tools for use in the CHAT route.
 * Same tools as the background runner, so agents can produce documents,
 * post wins, and hand off mid-conversation with the user.
 */
export function buildAutonomousToolsForChat(agentId: string, workspaceId: string) {
  return buildAutonomousTools(agentId, workspaceId)
}

// ── Build the agent system prompt for autonomous work ────────────────

async function buildAgentSystemPrompt(agentId: string): Promise<string> {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
  if (!agent) throw new Error(`Agent not found: ${agentId}`)

  const sops = await db.select().from(agentSops)
    .where(eq(agentSops.agentId, agentId))
    .orderBy(agentSops.sortOrder)

  const memories = await db.select().from(agentMemories)
    .where(eq(agentMemories.agentId, agentId))
    .orderBy(desc(agentMemories.importance))
    .limit(10)

  const sharedMemories = await db.select().from(companyMemories)
    .orderBy(desc(companyMemories.importance))
    .limit(8)

  const personalityStyle = traitsToPromptStyle(
    agent.personality as PersonalityTraits,
    agent.personalityPresetId ?? undefined,
    (agent.personalityConfig as any) ?? null,
  )

  let prompt = `You are ${agent.name}, ${agent.role}.${agent.systemPrompt ? " " + agent.systemPrompt : ""}
Your skills: ${(agent.skills as string[]).join(", ")}
${personalityStyle}

RULES:
- You are working autonomously for the business owner.
- Be proactive. Take initiative. Produce real output.
- When you have enough information, CREATE something tangible: a document, a plan, a strategy. Don't just ask more questions.
- Post updates to your department channel as you work.
- Post to team-leaders when you finish a major piece of work.
- Post to wins when something worth celebrating happens.
- Hand off to the next department when your work is done.
- Keep messages short, direct, and human. No em dashes. No corporate fluff.
- Show the business owner that real work is getting done.`

  if (sops.length > 0) {
    prompt += `\n\nYour SOPs:\n${sops.map((s) => `### ${s.title}\n${s.content}`).join("\n\n")}`
  }
  if (memories.length > 0) {
    prompt += `\n\nYour memories:\n${memories.map((m) => `- [${m.memoryType}] ${m.content}`).join("\n")}`
  }
  if (sharedMemories.length > 0) {
    prompt += `\n\nCompany knowledge:\n${sharedMemories.map((m) => `- [${m.category}] ${m.title}: ${m.content}`).join("\n")}`
  }

  return prompt
}

// ── Run an autonomous agent task ─────────────────────────────────────

export interface AgentTaskInput {
  agentId: string
  channelId: string
  workspaceId: string
  prompt: string
}

export interface AgentTaskResult {
  ok: boolean
  agentName?: string
  toolCalls?: number
  error?: string
}

/**
 * Run a task for an agent. The agent gets a prompt (instructions), its full
 * system context (personality, SOPs, memories), and a toolkit for posting
 * messages, creating documents, posting wins, and handing off to other
 * departments. The LLM decides what to do. All output is persisted.
 *
 * This is the core of autonomous agent behavior. Called by:
 *   - Onboarding completion (trigger R&D to start fact-finding)
 *   - Handoff protocol (one agent triggers the next)
 *   - Cron jobs (scheduled content creation)
 *   - Manual trigger from the UI
 */
export async function runAgentTask(input: AgentTaskInput): Promise<AgentTaskResult> {
  try {
    const systemPrompt = await buildAgentSystemPrompt(input.agentId)
    const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1)
    if (!agent) return { ok: false, error: "Agent not found" }

    const autonomousTools = buildAutonomousTools(input.agentId, input.workspaceId)
    const integrationTools = await buildIntegrationTools({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
    })

    const allTools = { ...autonomousTools, ...integrationTools }

    const result = await generateText({
      model: anthropic("claude-haiku-4-5"),
      system: systemPrompt,
      prompt: input.prompt,
      tools: allTools,
      stopWhen: ({ steps }) => steps.length >= 5,
      maxOutputTokens: 2000,
    })

    // Count tool calls across all steps
    const toolCalls = result.steps.reduce(
      (sum, step) => sum + (step.toolCalls?.length ?? 0), 0,
    )

    return { ok: true, agentName: agent.name, toolCalls }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Agent task failed" }
  }
}
