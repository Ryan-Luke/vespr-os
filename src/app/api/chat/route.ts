import { streamText, tool, jsonSchema, UIMessage, convertToModelMessages } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents, agentSops, teams, agentMemories, companyMemories, knowledgeEntries, approvalRequests, messages as messages_table, entities as entitiesTable, entityObservations as entityObsTable } from "@/lib/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"
import { traitsToPromptStyle } from "@/lib/personality-presets"
import type { PersonalityTraits } from "@/lib/personality-presets"
import { withAuth } from "@/lib/auth/with-auth"
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
import { buildAgentContext } from "@/lib/learning/context-builder"
import { recordDailyEntry, recordUserInteraction } from "@/lib/learning/memory-writer"
import { extractEntitiesFromText } from "@/lib/learning/entity-extractor"
import { pruneAgentMemories } from "@/lib/learning/memory-manager"
import type { ConversationExtraction } from "@/lib/learning/types"

// ── Conversation Data Extraction (pattern-based, no LLM) ─────────
// Extracts structured data from user and agent text using regex patterns.
// Runs in onFinish — fast, no network calls.

function extractConversationData(userText: string, agentText: string): ConversationExtraction {
  const data: ConversationExtraction = {
    topics: [],
    decisions: [],
    preferences: [],
    actionItems: [],
    people: [],
    numbers: [],
    dates: [],
  }

  const fullText = userText + " " + agentText

  // Decisions: "let's go with", "decided", "going with", "we'll do", "approved"
  const decisionPatterns = /(?:let'?s\s+go\s+with|decided\s+(?:to|on)|going\s+with|we'?ll\s+do|approved|agreed\s+(?:to|on)|chosen|picking|selected)\s+(.{5,80})/gi
  for (const match of fullText.matchAll(decisionPatterns)) {
    data.decisions.push(match[1].trim().replace(/[.!?,;]+$/, ""))
  }

  // Preferences: "I prefer", "I like", "I want", "I don't want", "always", "never"
  const preferencePatterns = /(?:I\s+prefer|I\s+like|I\s+want|I\s+don'?t\s+(?:want|like)|always\s+|never\s+|please\s+(?:don'?t|always))\s*(.{5,80})/gi
  for (const match of userText.matchAll(preferencePatterns)) {
    data.preferences.push(match[1].trim().replace(/[.!?,;]+$/, ""))
  }

  // Action items: "need to", "should", "will", "make sure", "follow up", "reminder"
  const actionPatterns = /(?:need\s+to|should\s+|I'?ll\s+|we\s+need\s+to|make\s+sure\s+(?:to\s+)?|follow\s+up|reminder\s+to|todo|next\s+step|action\s+item)\s*(.{5,80})/gi
  for (const match of fullText.matchAll(actionPatterns)) {
    data.actionItems.push(match[1].trim().replace(/[.!?,;]+$/, ""))
  }

  // Numbers/metrics: $amounts, percentages, counts
  const numberPatterns = /\$[\d,.]+[kKmMbB]?|\d+%|\d+\s*(?:users|customers|clients|deals|leads|MRR|ARR|revenue)/gi
  for (const match of fullText.matchAll(numberPatterns)) {
    data.numbers.push(match[0].trim())
  }

  // Dates/deadlines
  const datePatterns = /(?:by|before|until|deadline|due)\s+((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|next\s+week|end\s+of\s+(?:week|month|quarter|year)|Q[1-4]|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?))/gi
  for (const match of fullText.matchAll(datePatterns)) {
    data.dates.push(match[1].trim())
  }

  // People mentioned: @mentions or "talk to X", "ask X", "check with X", "loop in X"
  const peoplePatterns = /(?:@(\w+)|(?:talk\s+to|ask|check\s+with|loop\s+in|cc|ping|reach\s+out\s+to)\s+(\w+))/gi
  for (const match of fullText.matchAll(peoplePatterns)) {
    const person = (match[1] || match[2]).trim()
    if (person.length > 1 && !data.people.includes(person)) {
      data.people.push(person)
    }
  }

  // Extract topics from significant nouns/phrases (capitalized multi-word or key business terms)
  const topicPatterns = /(?:about|regarding|discussing|working\s+on|focus(?:ing)?\s+on|looking\s+(?:at|into))\s+(.{3,60})/gi
  for (const match of fullText.matchAll(topicPatterns)) {
    const topic = match[1].trim().replace(/[.!?,;]+$/, "")
    if (topic.length >= 3 && !data.topics.includes(topic)) {
      data.topics.push(topic)
    }
  }

  // Also extract standalone business terms as topics
  const businessTerms = /\b(pricing|marketing|sales|revenue|budget|strategy|competitor|customer|product|launch|campaign|roadmap|pipeline|funnel|onboarding|retention|churn|growth|hiring|staffing|branding|SEO|content|social\s+media|analytics)\b/gi
  for (const match of fullText.matchAll(businessTerms)) {
    const term = match[1].trim().toLowerCase()
    if (!data.topics.includes(term)) {
      data.topics.push(term)
    }
  }

  // Deduplicate all arrays
  data.topics = [...new Set(data.topics)].slice(0, 10)
  data.decisions = [...new Set(data.decisions)].slice(0, 5)
  data.preferences = [...new Set(data.preferences)].slice(0, 5)
  data.actionItems = [...new Set(data.actionItems)].slice(0, 5)
  data.people = [...new Set(data.people)].slice(0, 5)
  data.numbers = [...new Set(data.numbers)].slice(0, 5)
  data.dates = [...new Set(data.dates)].slice(0, 5)

  return data
}

export const maxDuration = 60

export async function POST(req: Request) {
  const auth = await withAuth()

  // Rate limit: 30 requests per minute per user
  const { rateLimit } = await import("@/lib/rate-limit")
  const { allowed } = rateLimit(`chat:${auth.user.id}`, 30, 60000)
  if (!allowed) {
    return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 })
  }

  const { messages, agentId, channelId, threadId: clientThreadId }: {
    messages: UIMessage[]
    agentId: string
    channelId?: string
    threadId?: string
  } = await req.json()

  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 })
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages array is required" }, { status: 400 })
  }

  // Generate or use the provided threadId for chat persistence
  const threadId = clientThreadId || crypto.randomUUID()

  let systemPrompt = "You are a helpful AI team member. Be concise and casual like on Slack."

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)

  // ── User message is saved client-side before calling /api/chat ────
  // Do NOT save it again here — the client already POSTed it to
  // /api/messages in handleChannelSend(). Saving here caused every
  // user message to appear twice in the DB.
  if (agent) {
    // Load SOPs for this agent
    const sops = await db.select().from(agentSops).where(eq(agentSops.agentId, agentId)).orderBy(agentSops.sortOrder)

    let sopContext = ""
    if (sops.length > 0) {
      sopContext = `\n\nYour Standard Operating Procedures (follow these closely):\n${sops.map((s) => `### ${s.title}\n${s.content}`).join("\n\n")}`
    }

    // Load learning context (memories, entities, skills, reflexions)
    // via the enhanced tiered retrieval system. Falls back to empty
    // string if the learning system has no data yet.
    const lastUserMsg = messages[messages.length - 1]
    const lastUserTextPart = lastUserMsg?.parts?.find((p: any) => p.type === "text") as any
    const lastUserText: string = lastUserTextPart?.text || ""

    let learningContext = ""
    try {
      const briefing = await buildAgentContext({
        workspaceId: auth.workspace.id,
        agentId,
        taskPrompt: lastUserText,
        userId: auth.user.id,
        userName: auth.user.name,
      })
      learningContext = briefing.full
    } catch {
      // Fallback: learning context is best-effort. Chat works without it.
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
      let businessState = ""
      {
        try {
          const { getWorkflowState, getPhase, PHASES } = await import("@/lib/workflow-engine")
          const wfState = await getWorkflowState(auth.workspace.id)
          const currentPhase = wfState.currentPhaseKey ? getPhase(wfState.currentPhaseKey as any) : null
          const completedPhases = wfState.phases.filter((p) => p.status === "completed" || p.status === "skipped")

          // Recent handoffs
          const { handoffEvents: handoffTable } = await import("@/lib/db/schema")
          const recentHandoffs = await db.select().from(handoffTable)
            .where(eq(handoffTable.workspaceId, auth.workspace.id))
            .orderBy(desc(handoffTable.createdAt))
            .limit(3)

          // Recent agent tasks
          const { agentTasks: tasksTable } = await import("@/lib/db/schema")
          const recentTasks = await db.select().from(tasksTable)
            .where(eq(tasksTable.workspaceId, auth.workspace.id))
            .orderBy(desc(tasksTable.createdAt))
            .limit(5)

          // Agent-created documents
          const agentDocs = await db.select({ title: knowledgeEntries.title, createdByName: knowledgeEntries.createdByName })
            .from(knowledgeEntries)
            .where(sql`${knowledgeEntries.createdByAgentId} IS NOT NULL AND NOT (${knowledgeEntries.tags} @> '["internal"]'::jsonb)`)
            .limit(5)

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
            let stateText = stateLines.join("\n")
            // Cap business state to 2000 chars to reduce system prompt token usage
            if (stateText.length > 2000) {
              stateText = stateText.slice(0, 2000) + "\n[truncated]"
            }
            businessState = `\n\nCURRENT BUSINESS STATE (live data):\n${stateText}`
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
${sopContext}${learningContext}${businessState}
${personalityStyle}

RULES:
- You are talking to the business owner. They know you well. NEVER introduce yourself.
- Think like a Chief of Staff: strategic, concise, always connecting dots across teams.
- When asked for status, give a cross-functional view using the CURRENT BUSINESS STATE data above. Reference specific phases, documents, handoffs, and goals by name. Don't make things up.
- Flag blockers, dependencies, and decisions that need the boss's input.
- Keep responses short (1-3 sentences) unless giving an executive summary.
- Be proactive. If you see something concerning in the business state, bring it up.
- Use the autonomous tools when action is needed. You make things happen.
- Reference your memories and company knowledge naturally when relevant.

WRITING RULES (strict):
- Write in plain English only. No markdown. No bold. No asterisks. No bullet points. No headers.
- Write like a normal person texting on Slack. Short sentences. Casual. Direct.
- Never use em dashes. Never use formatting symbols like **, ##, or -.
- Just talk normally. If you need to list things, write them in a sentence or use line breaks.
- No corporate jargon. No buzzwords. Say it like a human would say it out loud.`
    } else {
      systemPrompt = `You are ${agent.name}, ${agent.role}.${agent.systemPrompt ? " " + agent.systemPrompt : ""}
${agent.currentTask ? `You're currently working on: ${agent.currentTask}` : ""}
Your skills: ${(agent.skills as string[]).join(", ")}
${sopContext}${learningContext}
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

WRITING RULES (strict):
- Write in plain English only. No markdown. No bold. No asterisks. No bullet points. No headers.
- Write like a normal person texting on Slack. Short sentences. Casual. Direct.
- Never use em dashes. Never use formatting symbols like **, ##, or -.
- Just talk normally. If you need to list things, write them in a sentence or use line breaks.
- No corporate jargon. No buzzwords. Say it like a human would say it out loud.
- Reference specific numbers, names, and details. Not generic fluff.
- 1-3 sentences per response unless producing a detailed report.`

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
  const phaseCtx = agent
    ? await getPhaseGuidanceForAgent(auth.workspace.id, agent.id)
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
  const integrationTools = await buildIntegrationTools({ workspaceId: auth.workspace.id, agentId: agent?.id })

  // Autonomous tools let agents produce real artifacts mid-conversation:
  // create documents, post wins, hand off to other departments, set goals.
  // These are available to ALL agents, not just phase leads.
  const autonomousTools = agent
    ? buildAutonomousToolsForChat(agent.id, auth.workspace.id)
    : {}

  // Web tools let agents search the web and fetch URLs for research.
  const webTools = buildWebTools()

  const mergedTools =
    phaseTools || Object.keys(integrationTools).length > 0 || Object.keys(autonomousTools).length > 0
      ? { ...(phaseTools ?? {}), ...integrationTools, ...autonomousTools, ...webTools }
      : undefined

  // Phase leads get higher token budget for producing strategy docs
  const isPhaseLeadChat = !!phaseCtx
  const outputTokenLimit = isPhaseLeadChat ? 8000 : 5000

  // BYOK: use workspace's Anthropic API key, fall back to env var
  const apiKey = auth.workspace.anthropicApiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: "No Anthropic API key configured. Add one in Settings." }, { status: 400 })
  }
  const anthropic = createAnthropic({ apiKey })

  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: outputTokenLimit,
    tools: mergedTools,
    // 8 steps gives agents room to: respond + record_phase_output +
    // create_document + post_win + handoff_to_department + final response.
    // Lower limits cut off the phase completion chain mid-way.
    stopWhen: mergedTools ? ({ steps }) => steps.length >= 8 : undefined,
    async onFinish({ text }) {
      // Save agent response to the channel so DB fetches pick it up
      if (agent && text && channelId) {
        try {
          await db.insert(messages_table).values({
            workspaceId: auth.workspace.id,
            channelId,
            threadId,
            senderAgentId: agent.id,
            senderName: agent.name,
            senderAvatar: agent.avatar,
            content: text,
            messageType: "text",
          })
        } catch {}
      }

      // ── Comprehensive Memory Pipeline ──────────────────────────
      // 1. Extract structured data (topics, decisions, preferences, actions, numbers)
      // 2. Record user interaction memory (tagged with userId)
      // 3. Create/update user entity + observations
      // 4. If decision detected, create company memory (handled by recordUserInteraction)
      // 5. Prune if over budget
      if (!agent || !text) return
      const lastUserMsg = messages[messages.length - 1]
      const textPart = lastUserMsg?.parts?.find((p: any) => p.type === "text") as any
      const userText: string = textPart?.text || ""

      try {
        // Step 1: Extract structured data from conversation
        const extracted = extractConversationData(userText, text)

        // Step 2: Record user interaction memory (tagged with userId)
        // This also creates company memories for decisions and
        // separate entries for preferences and action items.
        await recordUserInteraction({
          workspaceId: auth.workspace.id,
          agentId: agent.id,
          userId: auth.user.id,
          userName: auth.user.name,
          userMessage: userText,
          agentResponse: text,
          topics: extracted.topics,
          decisions: extracted.decisions,
          preferences: extracted.preferences,
          actionItems: extracted.actionItems,
          people: extracted.people,
          numbers: extracted.numbers,
          dates: extracted.dates,
        })

        // Step 3: Create/update user entity in knowledge graph
        try {
          const [existingEntity] = await db
            .select()
            .from(entitiesTable)
            .where(
              and(
                eq(entitiesTable.workspaceId, auth.workspace.id),
                sql`LOWER(${entitiesTable.name}) = LOWER(${auth.user.name})`,
              ),
            )
            .limit(1)

          let userEntityId: string

          if (existingEntity) {
            userEntityId = existingEntity.id
            // Update timestamp to keep entity fresh
            await db
              .update(entitiesTable)
              .set({ updatedAt: new Date() })
              .where(eq(entitiesTable.id, userEntityId))
          } else {
            // First interaction — create user entity
            const [created] = await db
              .insert(entitiesTable)
              .values({
                workspaceId: auth.workspace.id,
                name: auth.user.name,
                entityType: "person",
                metadata: {
                  userId: auth.user.id,
                  email: auth.user.email,
                  isWorkspaceUser: true,
                },
              })
              .returning()
            userEntityId = created.id
          }

          // Add observations from this conversation
          const observationParts: string[] = []
          if (extracted.topics.length > 0) {
            observationParts.push(`Discussed: ${extracted.topics.join(", ")}`)
          }
          if (extracted.decisions.length > 0) {
            observationParts.push(`Decided: ${extracted.decisions.join("; ")}`)
          }
          if (extracted.preferences.length > 0) {
            observationParts.push(`Prefers: ${extracted.preferences.join("; ")}`)
          }
          if (extracted.numbers.length > 0) {
            observationParts.push(`Mentioned: ${extracted.numbers.join(", ")}`)
          }

          if (observationParts.length > 0) {
            const obsImportance = extracted.decisions.length > 0 ? 4 : 3
            await db.insert(entityObsTable).values({
              entityId: userEntityId,
              content: observationParts.join(". "),
              source: "conversation",
              sourceAgentId: agent.id,
              importance: obsImportance,
            })
          }
        } catch { /* entity creation is best-effort */ }

        // Step 4: Legacy agentMemories backward compat
        let importance = 2
        if (extracted.decisions.length > 0) importance = 4
        else if (extracted.preferences.length > 0 || extracted.actionItems.length > 0) importance = 3
        else if (extracted.numbers.length > 0 || extracted.dates.length > 0) importance = 3

        if (importance >= 3) {
          try {
            const memoryType = importance >= 4 ? "observation" : "preference"
            const legacyContent = `[${new Date().toLocaleDateString()}] ${auth.user.name} said: "${userText.slice(0, 100)}${userText.length > 100 ? "..." : ""}". Agent responded about: ${text.slice(0, 80)}...`
            await db.insert(agentMemories).values({
              agentId: agent.id,
              memoryType,
              content: legacyContent,
              importance: importance / 5,
              source: "conversation",
            })
          } catch { /* legacy compat is best-effort */ }
        }

        // Step 5: Prune agent memories if over budget
        try {
          await pruneAgentMemories(agent.id, auth.workspace.id)
        } catch { /* pruning is best-effort */ }
      } catch { /* silent — memory saving is best-effort */ }
    },
  })

  return result.toUIMessageStreamResponse()
}
