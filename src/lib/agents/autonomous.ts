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
  agentTasks, handoffEvents, agentSchedules,
} from "@/lib/db/schema"
import { eq, desc, ilike, or, and } from "drizzle-orm"
import { traitsToPromptStyle } from "@/lib/personality-presets"
import type { PersonalityTraits } from "@/lib/personality-presets"
import { buildIntegrationTools } from "@/lib/integrations/tools"

// ── Department-specific handoff prompts ───────────────────────────────
// When one department hands off to another, the receiving agent needs
// clear, actionable instructions. Generic "start working" prompts
// produce generic behavior. These prompts are tailored per department
// so each agent knows exactly what to do next.

function buildHandoffPrompt(params: {
  fromAgentName: string
  targetDepartment: string
  summary: string
  nextSteps: string
}): string {
  const { fromAgentName, targetDepartment, summary, nextSteps } = params
  const dept = targetDepartment.toLowerCase()

  const base = `${fromAgentName} just handed off work to your department. Here's what they completed:\n\n${summary}\n\nTheir recommended next steps for you: ${nextSteps}\n\n`

  if (dept.includes("marketing") || dept.includes("growth")) {
    return base + `You are the Marketing lead. Here's your playbook for this handoff:

1. First, use post_to_channel to post a brief acknowledgment in team-leaders. Something like: "Got the handoff from ${fromAgentName}. Business overview looks solid. Reaching out to the founder in #marketing now."

2. Then use post_to_channel to post in YOUR department channel (marketing or growth). This is your opening message to the business owner. It should:
   - Show you read the business overview and reference specifics from it
   - Ask about their marketing budget. Are they going organic (time investment), paid (ad spend), or hiring an agency? This determines everything.
   - Ask about their content strategy preferences. Do they want to be on Instagram, LinkedIn, YouTube, TikTok? How often do they want to post?
   - Ask if they already have any marketing assets (website, landing page, social accounts)

3. Use set_department_goal to set 2-3 concrete goals. Examples: "Define go-to-market strategy", "Create first landing page", "Build 30-day content calendar"

4. Use post_win to celebrate the handoff: "Marketing is now active for [business name]"

Be direct, strategic, and excited. You have a real business overview to work from. Reference the specific details. Don't be generic. Ask smart questions that show you understand their business.

IMPORTANT: After the user responds about budget and strategy, your next moves are:
- If they need a website/landing page: hand off to Operations (they handle tool selection and building)
- Bring in a copywriter agent to refine messaging and start creating content
- Start building a content calendar based on their posting cadence`
  }

  if (dept.includes("operations") || dept.includes("ops")) {
    return base + `You are the Operations lead. Here's your playbook for this handoff:

1. Post a brief acknowledgment in team-leaders.

2. Post in your department channel (operations). If this handoff is about building a website or funnel:
   - Ask the user if they already have a tool they use for websites (GHL, Webflow, Squarespace, WordPress, etc)
   - If they don't, suggest options. Recommend GoHighLevel if they want an all-in-one platform, or Vercel if they want a custom-built site that deploys fast
   - Once they pick a tool, ask for their API key or credentials so we can connect it
   - Your goal is to get the tool selected and connected, then start building

3. If this is about general operations setup, focus on:
   - What tools they already use
   - What processes need to be set up
   - What automations would save them the most time

4. Use set_department_goal for concrete goals like "Select and connect website builder" or "Deploy first landing page"

5. Post a win when tools are connected or assets are created.

Be practical and solutions-oriented. You're the person who makes things actually work.`
  }

  if (dept.includes("finance")) {
    return base + `You are the Finance lead. Here's your playbook:

1. Post acknowledgment in team-leaders.
2. Post in your channel. Focus on: payment processor setup (recommend GoHighLevel or Stripe), invoicing, pricing implementation, and financial tracking.
3. Ask what tools they already use for payments and bookkeeping.
4. Set goals around getting payments set up and first invoice ready.`
  }

  if (dept.includes("sales")) {
    return base + `You are the Sales lead. Here's your playbook:

1. Post acknowledgment in team-leaders.
2. Post in your channel. Focus on: CRM setup (recommend GoHighLevel), sales process, outreach templates, and pipeline stages.
3. Ask about their current sales process and what tools they use.
4. Set goals around pipeline setup and first outreach campaign.`
  }

  if (dept.includes("delivery") || dept.includes("fulfillment") || dept.includes("client")) {
    return base + `You are the Delivery lead. Here's your playbook:

1. Post acknowledgment in team-leaders.
2. Post in your channel. Focus on: delivery process, client onboarding SOP, project management tool setup, and quality checkpoints.
3. Ask what tools they use for project management (recommend GoHighLevel or ClickUp).
4. Set goals around creating the delivery SOP and onboarding the first client.`
  }

  // Fallback for any other department
  return base + `You received a handoff. Here's what to do:

1. Post a brief acknowledgment in team-leaders showing you received and read the handoff.
2. Post in your department channel to the business owner. Reference specific details from the handoff summary. Ask smart follow-up questions that move your department's work forward.
3. Set 2-3 concrete department goals.
4. Post a win when you complete something meaningful.

Be proactive. Show the owner that real work is happening.`
}

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
    read_channel_history: tool({
      description:
        "Read recent messages from a channel to understand what's been discussed. Use this before posting to a channel you haven't been following, or when you need to reference a conversation that happened in another department's channel. Returns the last N messages with sender names and timestamps.",
      inputSchema: jsonSchema<{ channelName: string; limit?: number }>({
        type: "object",
        properties: {
          channelName: {
            type: "string",
            description: "The channel name (lowercase, hyphenated)",
          },
          limit: { type: "number", minimum: 1, maximum: 50 },
        },
        required: ["channelName"],
        additionalProperties: false,
      }),
      execute: async ({ channelName, limit }) => {
        try {
          const [channel] = await db.select().from(channels)
            .where(eq(channels.name, channelName)).limit(1)
          if (!channel) return { ok: false, error: `Channel "${channelName}" not found` }
          const msgs = await db.select().from(messages)
            .where(eq(messages.channelId, channel.id))
            .orderBy(desc(messages.createdAt))
            .limit(limit ?? 20)
          return {
            ok: true,
            channel: channelName,
            messages: msgs.reverse().map((m) => ({
              sender: m.senderName,
              content: m.content.slice(0, 500),
              createdAt: m.createdAt.toISOString(),
            })),
          }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Failed to read" }
        }
      },
    }),

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

          // Log the handoff event for audit trail
          if (targetLead) {
            await db.insert(handoffEvents).values({
              workspaceId,
              fromAgentId: agentId,
              fromAgentName: agent?.name ?? "Unknown",
              toAgentId: targetLead.id,
              toAgentName: targetLead.name,
              toDepartment: targetDepartment,
              summary,
              nextSteps,
              context: {}, // will be enriched below if we have handoff chain context
            }).catch(() => {})
          }

          // Trigger the target lead with structured context from the chain.
          // Each handoff passes the full accumulated context so downstream
          // agents know everything upstream agents collected.
          if (targetLead && targetTeam) {
            const [deptChannel] = await db.select().from(channels)
              .where(ilike(channels.name, `%${targetDepartment.toLowerCase().replace(/\s+/g, "-")}%`)).limit(1)
            if (deptChannel) {
              const deptPrompt = buildHandoffPrompt({
                fromAgentName: agent?.name ?? "R&D",
                targetDepartment,
                summary,
                nextSteps,
              })

              // Build structured context for the receiving agent.
              // Pull company memories as collected info so the next agent
              // has everything without re-asking.
              const recentMemories = await db.select().from(companyMemories)
                .orderBy(desc(companyMemories.importance))
                .limit(15)
              const collectedInfo: Record<string, string> = {}
              for (const mem of recentMemories) {
                collectedInfo[mem.title] = mem.content
              }

              // Pull recent documents created
              const recentDocs = await db.select({ id: knowledgeEntries.id, title: knowledgeEntries.title })
                .from(knowledgeEntries)
                .where(eq(knowledgeEntries.createdByAgentId, agentId))
                .limit(5)

              const handoffContext = {
                collectedInfo,
                documentsCreated: recentDocs.map((d) => ({ id: d.id, title: d.title })),
                handoffChain: [{
                  fromAgent: agent?.name ?? "Unknown",
                  toAgent: targetLead.name,
                  summary,
                  timestamp: new Date().toISOString(),
                }],
              }

              runAgentTask({
                agentId: targetLead.id,
                channelId: deptChannel.id,
                workspaceId,
                prompt: deptPrompt,
                context: handoffContext,
              }).catch(() => {})
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

    create_schedule: tool({
      description:
        "Create a recurring scheduled task for yourself. Use this when the user wants you to do something on a regular cadence. Examples: 'create a social media post every day at 9am', 'send a weekly revenue report every Monday', 'check inbox every 4 hours'. Supported schedules: 'every Xm' (minutes), 'every Xh' (hours), 'daily at HH:MM' (24h UTC), 'weekly on DAY at HH:MM'.",
      inputSchema: jsonSchema<{
        name: string
        description?: string
        schedule: string
        taskPrompt: string
      }>({
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100, description: "Short name like 'Daily Instagram post' or 'Weekly revenue report'" },
          description: { type: "string", maxLength: 500 },
          schedule: {
            type: "string",
            description: "The schedule expression. Examples: 'every 30m', 'every 4h', 'daily at 09:00', 'weekly on monday at 09:00'. Times are UTC.",
          },
          taskPrompt: {
            type: "string",
            description: "The full instructions you'll follow each time this runs. Be specific about what to produce, where to post it, and what quality bar to hit.",
            maxLength: 4000,
          },
        },
        required: ["name", "schedule", "taskPrompt"],
        additionalProperties: false,
      }),
      execute: async ({ name, description, schedule, taskPrompt }) => {
        try {
          const [sched] = await db.insert(agentSchedules).values({
            agentId,
            name,
            description: description ?? null,
            cronExpression: schedule,
            taskPrompt,
            enabled: true,
          }).returning()
          return {
            ok: true,
            scheduleId: sched.id,
            name,
            schedule,
            message: `Schedule "${name}" created. It will run on the "${schedule}" cadence. The user can see and manage it in the Automations page.`,
          }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Failed to create schedule" }
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
  context?: Record<string, unknown> // structured context from the handoff chain
}

export interface AgentTaskResult {
  ok: boolean
  taskId?: string
  agentName?: string
  toolCalls?: number
  error?: string
}

/**
 * Run a task for an agent with persistent state tracking. The task is
 * created in the agent_tasks table before execution starts, updated as
 * it runs, and marked completed or failed when done. If Vercel times out,
 * the task stays in "running" state and can be detected and retried.
 *
 * Called by:
 *   - Handoff protocol (one agent triggers the next)
 *   - Cron jobs (scheduled content creation)
 *   - Manual trigger via POST /api/agent-tasks/run
 */
export async function runAgentTask(input: AgentTaskInput): Promise<AgentTaskResult> {
  const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1)
  if (!agent) return { ok: false, error: "Agent not found" }

  // Persist the task before starting so it's tracked even if we time out
  const [task] = await db.insert(agentTasks).values({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    channelId: input.channelId,
    status: "running",
    prompt: input.prompt,
    context: input.context ?? {},
    startedAt: new Date(),
  }).returning()

  try {
    // Build the system prompt with all three memory layers:
    // 1. Working memory: the context object from the handoff chain
    // 2. Episodic memory: agent's own memories from past tasks
    // 3. Semantic memory: company knowledge + playbooks
    let systemPrompt = await buildAgentSystemPrompt(input.agentId)

    // Inject handoff context so the agent knows what upstream agents collected
    if (input.context && Object.keys(input.context).length > 0) {
      const contextLines: string[] = []
      if (input.context.collectedInfo) {
        contextLines.push("Information collected by previous agents:")
        for (const [k, v] of Object.entries(input.context.collectedInfo as Record<string, string>)) {
          contextLines.push(`  ${k}: ${v}`)
        }
      }
      if (input.context.documentsCreated) {
        const docs = input.context.documentsCreated as { id: string; title: string }[]
        contextLines.push(`Documents created so far: ${docs.map((d) => d.title).join(", ")}`)
      }
      if (input.context.handoffChain) {
        const chain = input.context.handoffChain as { fromAgent: string; toAgent: string }[]
        contextLines.push(`Handoff chain: ${chain.map((h) => `${h.fromAgent} -> ${h.toAgent}`).join(" -> ")}`)
      }
      if (contextLines.length > 0) {
        systemPrompt += `\n\nCONTEXT FROM PREVIOUS DEPARTMENTS:\n${contextLines.join("\n")}`
      }
    }

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
      // 8 steps: post to team-leaders + post to dept channel + create doc +
      // post win + set goals + read context = up to 6 tool calls needed.
      stopWhen: ({ steps }) => steps.length >= 8,
      maxOutputTokens: 2000,
    })

    const toolCalls = result.steps.reduce(
      (sum, step) => sum + (step.toolCalls?.length ?? 0), 0,
    )

    // Mark task completed
    await db.update(agentTasks).set({
      status: "completed",
      toolCallsMade: toolCalls,
      result: { text: result.text?.slice(0, 500), toolCalls },
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(agentTasks.id, task.id))

    return { ok: true, taskId: task.id, agentName: agent.name, toolCalls }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Agent task failed"
    // Mark task failed
    await db.update(agentTasks).set({
      status: "failed",
      error: errorMsg,
      updatedAt: new Date(),
    }).where(eq(agentTasks.id, task.id)).catch(() => {})

    return { ok: false, taskId: task.id, error: errorMsg }
  }
}
