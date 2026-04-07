import { streamText, tool, jsonSchema, UIMessage, convertToModelMessages } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents, agentSops, teams, agentMemories, companyMemories, knowledgeEntries, approvalRequests } from "@/lib/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { traitsToPromptStyle } from "@/lib/personality-presets"
import type { PersonalityTraits } from "@/lib/personality-presets"
import { getActiveWorkspace } from "@/lib/workspace-server"
import {
  getPhaseGuidanceForAgent,
  renderPhaseGuidancePrompt,
  upsertPhaseOutput,
  getPlaybooksForPhase,
  renderPlaybookReferenceBlock,
  type PhaseKey,
} from "@/lib/workflow-engine"
import { buildIntegrationTools } from "@/lib/integrations/tools"
import { buildAutonomousToolsForChat } from "@/lib/agents/autonomous"
import { buildWebTools } from "@/lib/agents/web-tools"

export const maxDuration = 60

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
      companyContext = `\n\nCompany knowledge (shared across all agents. reference naturally when relevant):\n${sharedMemories.map((m) => `- [${m.category}] ${m.title}: ${m.content}`).join("\n")}`
    }

    const personalityStyle = traitsToPromptStyle(
      agent.personality as PersonalityTraits,
      agent.personalityPresetId ?? undefined,
      (agent.personalityConfig as any) ?? null,
    )

    // Chief of Staff gets a special system prompt with full business awareness
    if (agent.role === "Chief of Staff") {
      const allTeams = await db.select().from(teams)
      const allAgents = await db.select().from(agents)
      const teamLeads = allAgents.filter((a) => a.isTeamLead)

      // Pull real-time business state so Nova knows what's actually happening
      const activeWsForNova = await getActiveWorkspace()
      let businessState = ""
      if (activeWsForNova) {
        try {
          const { getWorkflowState, getPhase, PHASES } = await import("@/lib/workflow-engine")
          const wfState = await getWorkflowState(activeWsForNova.id)
          const currentPhase = wfState.currentPhaseKey ? getPhase(wfState.currentPhaseKey as any) : null
          const completedPhases = wfState.phases.filter((p) => p.status === "completed" || p.status === "skipped")

          // Recent handoffs
          const { handoffEvents: handoffTable } = await import("@/lib/db/schema")
          const recentHandoffs = await db.select().from(handoffTable)
            .where(eq(handoffTable.workspaceId, activeWsForNova.id))
            .orderBy(desc(handoffTable.createdAt))
            .limit(5)

          // Recent agent tasks
          const { agentTasks: tasksTable } = await import("@/lib/db/schema")
          const recentTasks = await db.select().from(tasksTable)
            .where(eq(tasksTable.workspaceId, activeWsForNova.id))
            .orderBy(desc(tasksTable.createdAt))
            .limit(5)

          // Agent-created documents
          const agentDocs = await db.select({ title: knowledgeEntries.title, createdByName: knowledgeEntries.createdByName })
            .from(knowledgeEntries)
            .where(sql`${knowledgeEntries.createdByAgentId} IS NOT NULL AND NOT (${knowledgeEntries.tags} @> '["internal"]'::jsonb)`)
            .limit(10)

          // Department goals
          const { teamGoals: goalsTable } = await import("@/lib/db/schema")
          const goals = await db.select().from(goalsTable).limit(20)

          // Pending approvals
          const pendingApprovals = await db.select({ title: approvalRequests.title, agentName: approvalRequests.agentName })
            .from(approvalRequests)
            .where(eq(approvalRequests.status, "pending"))
            .limit(5)

          const stateLines: string[] = []
          if (currentPhase) {
            const currentRun = wfState.phases.find((p) => p.phaseKey === wfState.currentPhaseKey)
            stateLines.push(`Current phase: ${currentPhase.label} (${currentRun?.progress.done}/${currentRun?.progress.total} outputs captured)`)
          }
          if (completedPhases.length > 0) {
            stateLines.push(`Completed phases: ${completedPhases.map((p) => p.phaseKey).join(", ")}`)
          }
          if (agentDocs.length > 0) {
            stateLines.push(`Documents created: ${agentDocs.map((d) => `"${d.title}" by ${d.createdByName}`).join(", ")}`)
          }
          if (recentHandoffs.length > 0) {
            stateLines.push(`Recent handoffs: ${recentHandoffs.map((h) => `${h.fromAgentName} -> ${h.toAgentName} (${h.toDepartment})`).join(", ")}`)
          }
          if (recentTasks.length > 0) {
            const taskSummary = recentTasks.map((t) => `${t.status}${t.error ? ' (error)' : ''}`).join(", ")
            stateLines.push(`Recent agent tasks: ${taskSummary}`)
          }
          if (goals.length > 0) {
            stateLines.push(`Department goals: ${goals.map((g) => `${g.title} (${g.progress}/${g.target} ${g.unit})`).join(", ")}`)
          }
          if (pendingApprovals.length > 0) {
            stateLines.push(`Pending approvals: ${pendingApprovals.map((a) => `"${a.title}" from ${a.agentName}`).join(", ")}`)
          }

          if (stateLines.length > 0) {
            businessState = `\n\nCURRENT BUSINESS STATE (live data):\n${stateLines.join("\n")}`
          }
        } catch {
          // Best-effort. Nova still works without real-time state.
        }
      }

      systemPrompt = `You are ${agent.name}, Chief of Staff. You are the executive coordinator for the entire AI workforce.
${agent.currentTask ? `You're currently working on: ${agent.currentTask}` : ""}

Your responsibilities:
- Coordinate across all departments: ${allTeams.map((t) => t.name).join(", ")}
- Your team leads: ${teamLeads.map((a) => `${a.name} (${a.role}, ${allTeams.find((t) => t.id === a.teamId)?.name})`).join(", ")}
- Surface blockers, resolve cross-team dependencies, and keep the business owner informed
- Prepare executive summaries and prioritize work across teams
- You report directly to the business owner (CEO)
${sopContext}${memoryContext}${companyContext}${businessState}
${personalityStyle}

RULES:
- You are talking to the business owner. They know you well. NEVER introduce yourself.
- Think like a Chief of Staff: strategic, concise, always connecting dots across teams.
- No em dashes. Short human sentences. Direct.
- When asked for status, give a cross-functional view using the CURRENT BUSINESS STATE data above. Reference specific phases, documents, handoffs, and goals by name. Don't make things up.
- Flag blockers, dependencies, and decisions that need the boss's input.
- Keep responses short (1-3 sentences) unless giving an executive summary.
- Be proactive. If you see something concerning in the business state (failed tasks, stalled phases, empty goals), bring it up.
- Use the autonomous tools (create_document, post_win, handoff_to_department, set_department_goal) when action is needed. You're not just a reporter. You make things happen.
- Reference your memories and company knowledge naturally when relevant.
- You can use emojis sparingly like a real person would on Slack.`
    } else {
      systemPrompt = `You are ${agent.name}, ${agent.role}.${agent.systemPrompt ? " " + agent.systemPrompt : ""}
${agent.currentTask ? `You're currently working on: ${agent.currentTask}` : ""}
Your skills: ${(agent.skills as string[]).join(", ")}
${sopContext}${memoryContext}${companyContext}
${personalityStyle}

CORE IDENTITY:
You are a department head. Not an assistant. Not a chatbot. You OWN your area. You are proactive, strategic, and accountable for results. You push the project forward even when the user doesn't ask.

HOW YOU OPERATE:
- Think like a real department head who was just hired. You don't wait to be told what to do. You assess the situation, identify what's needed, and take action.
- Challenge weak thinking. If the user's plan has holes, say so. "That pricing doesn't work at your scale. Here's why." Be respectful but honest.
- Do the math. Validate financial goals against pricing, market size, and timelines. If something doesn't add up, point it out before it becomes a problem.
- Ask smart follow-up questions. Don't accept vague answers. "Who specifically? How many? What's the timeline? What have you tried before?"
- When you have enough validated information, PRODUCE something tangible. Create documents, strategies, plans. Show your work.
- After creating a deliverable, share it and ask for feedback. Wait for approval before handing off.
- Use web_search and web_fetch to research competitors, validate market assumptions, check pricing benchmarks. Don't rely only on what the user tells you.
- Post wins when milestones are hit. Set department goals to track progress.
- Keep the user informed about what you're doing and what comes next.

COMMUNICATION STYLE:
- No em dashes. Short human sentences.
- Talk like a sharp team member on Slack. Casual but competent.
- Reference specific numbers, names, and details. Not generic fluff.
- 1-3 sentences per response unless producing a detailed report or analysis.
- Reference company knowledge and your memories when relevant.`

      // Role-specific guidance layered on top of the generic rules.
      // Marketing agents need to know their specific playbook.
      const roleLower = agent.role.toLowerCase()
      if (roleLower.includes("marketing") || roleLower.includes("growth") || roleLower.includes("content strategist")) {
        systemPrompt += `

MARKETING-SPECIFIC:
- Your first job after receiving a handoff from R&D is to understand the user's marketing budget and strategy preference.
- Ask: are they going organic (time investment, social media, content), paid (ad spend on Meta/Google/TikTok), or hiring a third-party agency?
- Ask about content strategy: which platforms, how often they want to post, what kind of content.
- When you have enough info about their strategy, create a "Marketing Strategy" document using create_document. Include: chosen channels, budget allocation, content calendar outline, first 30-day plan, KPIs.
- If the user needs a website or landing page, hand off to Operations (they handle tool selection and building). Don't try to build it yourself.
- Bring in a copywriter by mentioning in your chat that you're looping in the copywriter to start on messaging and content. The user should feel like the team is expanding.
- Once strategy is set, use set_department_goal for goals like "Launch first campaign" or "Create 30-day content calendar".
- Post wins when strategy docs are done, first content pieces are created, or goals are hit.`
      }

      if (roleLower.includes("operations") || roleLower.includes("ops") || roleLower.includes("automation")) {
        systemPrompt += `

OPERATIONS-SPECIFIC:
- When you receive a handoff about building a website or funnel, your first move is to ask the user what tool they want to use.
- Never assume a default tool. Ask first. If they don't have one, suggest GoHighLevel (all-in-one, cheap, easy) or Vercel (custom-built, fast to deploy, more flexible).
- Once they pick a tool, ask for their API key or credentials to connect it to the platform.
- Your goal is: tool selected, credentials saved, asset built. In that order.
- For general operations work, focus on: what tools they use, what processes need setup, what automations save the most time.
- Use create_document for operational plans, process docs, and automation specs.`
      }

      if (roleLower.includes("finance") || roleLower.includes("bookkeeper")) {
        systemPrompt += `

FINANCE-SPECIFIC:
- Focus on getting the payment processor connected (GoHighLevel or Stripe).
- Ask what tools they already use for payments and bookkeeping.
- Help set up pricing tiers based on the offer from the business overview.
- Track revenue goals and report on financial metrics.`
      }
    }
  }

  // ── Workflow Engine phase guidance (BLA-64) ──────────────────────
  // If there's an active workspace in a phase AND this agent is a phase
  // lead, inject phase context into the system prompt and expose the
  // record_phase_output tool so the agent can capture answers as company
  // memories while conversing naturally.
  const activeWs = await getActiveWorkspace()
  const phaseCtx = agent && activeWs
    ? await getPhaseGuidanceForAgent(activeWs.id, agent.id)
    : null

  if (phaseCtx) {
    systemPrompt += "\n" + renderPhaseGuidancePrompt(phaseCtx)

    // Inject phase-relevant seeded playbooks (agent-only reference material).
    // These are hidden from the user surface entirely. they exist so
    // agents can draw on battle-tested frameworks while coaching the user
    // through each phase. Cap at 3 digests (~1500 tokens) so we don't
    // blow the context window.
    try {
      const playbooks = await getPlaybooksForPhase(phaseCtx.phaseKey as PhaseKey, 3)
      if (playbooks.length > 0) {
        systemPrompt += renderPlaybookReferenceBlock(playbooks)
      }
    } catch {
      // Best-effort. if the lookup fails (schema drift, empty DB),
      // chat still works without the framework references.
    }
  }

  const phaseTools = phaseCtx
    ? {
        record_phase_output: tool({
          description:
            "Capture a concrete answer/artifact the user just provided for one of the required phase outputs. Use this the moment the user gives you something substantive. Strategic decisions get stored as company memories; research artifacts get stored as knowledge entries. Integration and milestone outputs are NOT handled here. they need the user to pick/wire a tool in a dedicated flow.",
          inputSchema: jsonSchema<{ output_key: string; summary: string; detail?: string }>({
            type: "object",
            properties: {
              output_key: {
                type: "string",
                description: "The exact output_key for the required output being answered.",
                enum: phaseCtx.allOutputs.map((o) => o.key),
              },
              summary: {
                type: "string",
                description:
                  "A 1-2 sentence distilled version of the captured answer. Keep the user's voice and specifics.",
                minLength: 5,
                maxLength: 600,
              },
              detail: {
                type: "string",
                description:
                  "For artifact-style outputs (research, competitor analysis, pricing benchmarks), the full long-form content in markdown. Include evidence, sources the user cited, numbers, and specifics. Leave empty for short decision-style outputs.",
                maxLength: 6000,
              },
            },
            required: ["output_key", "summary"],
            additionalProperties: false,
          }),
          execute: async ({ output_key, summary, detail }) => {
            try {
              const spec = phaseCtx.allOutputs.find((o) => o.key === output_key)
              if (!spec) return { ok: false, error: `Unknown output_key: ${output_key}` }

              // Integrations/milestones need dedicated picker flows. refuse here
              if (spec.kind === "integration" || spec.kind === "milestone") {
                return {
                  ok: false,
                  error: `Output "${spec.label}" is a ${spec.kind} and must be handled via a dedicated flow (not this tool). Explain to the user what this output needs and let them drive the tool picker / milestone confirmation.`,
                }
              }

              // Dispatch storage by kind:
              //   decision → company_memories (short, shared strategic facts)
              //   artifact → knowledge_entries (longer research, cited content)
              if (spec.kind === "decision") {
                const [memory] = await db
                  .insert(companyMemories)
                  .values({
                    category: "fact",
                    title: `${phaseCtx.phaseLabel}: ${spec.label}`,
                    content: detail ? `${summary}\n\n${detail}` : summary,
                    importance: 0.9,
                    source: "agent",
                    sourceAgentId: agent!.id,
                    tags: ["phase", phaseCtx.phaseKey, output_key],
                  })
                  .returning()

                await upsertPhaseOutput(
                  phaseCtx.workspaceId,
                  phaseCtx.phaseKey as PhaseKey,
                  output_key,
                  {
                    status: "provided",
                    value: summary,
                    sourceId: memory.id,
                    sourceType: "company_memory",
                  },
                )
                return { ok: true, captured: output_key, storedAs: "company_memory" }
              }

              // artifact
              const [entry] = await db
                .insert(knowledgeEntries)
                .values({
                  title: `${phaseCtx.phaseLabel}: ${spec.label}`,
                  content: detail
                    ? `**Summary:** ${summary}\n\n${detail}`
                    : `**Summary:** ${summary}`,
                  category: phaseCtx.phaseKey === "research" ? "research" : "business",
                  tags: ["phase", phaseCtx.phaseKey, output_key],
                  createdByName: agent!.name,
                  createdByAgentId: agent!.id,
                })
                .returning()

              await upsertPhaseOutput(
                phaseCtx.workspaceId,
                phaseCtx.phaseKey as PhaseKey,
                output_key,
                {
                  status: "provided",
                  value: summary,
                  sourceId: entry.id,
                  sourceType: "knowledge_entry",
                },
              )
              return { ok: true, captured: output_key, storedAs: "knowledge_entry" }
            } catch (err) {
              return {
                ok: false,
                error: err instanceof Error ? err.message : "failed to record phase output",
              }
            }
          },
        }),
      }
    : undefined

  // ── Integration tools (BLA-88 payoff) ────────────────────────────
  // Expose tools for each SaaS tool the workspace has connected. Example:
  // if Linear is connected, the agent gets `linear_create_issue`. Tools
  // are keyed by provider + action, and the LLM decides when to call them
  // based on the tool descriptions. Empty object when nothing is connected.
  const integrationTools = activeWs
    ? await buildIntegrationTools({ workspaceId: activeWs.id, agentId: agent?.id })
    : {}

  // Autonomous tools let agents produce real artifacts mid-conversation:
  // create documents, post wins, hand off to other departments, set goals.
  // These are available to ALL agents, not just phase leads.
  const autonomousTools = agent && activeWs
    ? buildAutonomousToolsForChat(agent.id, activeWs.id)
    : {}

  // Web tools let agents search the web and fetch URLs for research.
  const webTools = buildWebTools()

  const mergedTools =
    phaseTools || Object.keys(integrationTools).length > 0 || Object.keys(autonomousTools).length > 0
      ? { ...(phaseTools ?? {}), ...integrationTools, ...autonomousTools, ...webTools }
      : undefined

  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 500,
    tools: mergedTools,
    // 8 steps gives agents room to: respond + record_phase_output +
    // create_document + post_win + handoff_to_department + final response.
    // Lower limits cut off the phase completion chain mid-way.
    stopWhen: mergedTools ? ({ steps }) => steps.length >= 8 : undefined,
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
          const content = `[${new Date().toLocaleDateString()}] User said: "${userText.slice(0, 100)}${userText.length > 100 ? "..." : ""}". Agent responded about: ${text.slice(0, 80)}...`
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
          } catch { /* silent. memory saving is best-effort */ }
          break // one memory per exchange
        }
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
