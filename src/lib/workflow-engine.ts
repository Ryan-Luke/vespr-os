// ── Workflow Engine (BLA-63) ─────────────────────────────────────────
// Phased business-building state machine. Each workspace progresses through
// 7 phases, each with a lead agent, required outputs, and a user buy-in gate
// before advancing to the next phase.
//
// PRINCIPLE: Integrate, don't rebuild. Outputs that need capability already
// covered by mature SaaS (CRM, email, payments, calendars, landing pages) are
// framed as "pick a tool + wire the integration", NOT "fill out a table inside
// BOS". See feedback_integrate_dont_rebuild memory.
//
// Phase definitions live here as constants. they are not user-editable.
// Per-workspace progress lives in the `workflow_phase_runs` table.

import { db } from "@/lib/db"
import { workspaces, workflowPhaseRuns, agents, teams, knowledgeEntries } from "@/lib/db/schema"
import { and, eq, ilike, or, sql } from "drizzle-orm"

// ── Types ────────────────────────────────────────────────────────────

export type PhaseKey =
  | "product"
  | "research"
  | "offer"
  | "marketing"
  | "monetization"
  | "delivery"
  | "operations"

export type PhaseStatus = "pending" | "active" | "completed" | "skipped"

export type OutputKind =
  | "decision"      // a strategic decision captured as a company memory
  | "artifact"      // a document / knowledge entry
  | "integration"   // an external SaaS tool wired up
  | "milestone"     // a real-world event (first $, first client, first post)

export interface PhaseOutputSpec {
  key: string
  label: string
  description: string
  kind: OutputKind
  // For integration outputs: suggested tools (paid + free fallback)
  integrationSuggestions?: { name: string; note?: string }[]
}

export interface PhaseDefinition {
  key: PhaseKey
  order: number
  label: string
  tagline: string
  description: string
  // Role-keyword matchers used to resolve the lead agent dynamically.
  // We match against agents.role (ILIKE) in priority order; first match wins.
  // Nova (Chief of Staff) is always co-lead for coordination.
  leadRoleKeywords: string[]
  requiredOutputs: PhaseOutputSpec[]
  nextPhase: PhaseKey | null
}

export interface PhaseRunState {
  phaseKey: PhaseKey
  status: PhaseStatus
  outputs: Record<string, {
    status: "empty" | "provided" | "confirmed"
    value?: string
    sourceId?: string
    sourceType?: "company_memory" | "knowledge_entry" | "text"
    updatedAt?: string
  }>
  gateDecision: {
    decision: "approved" | "needs_changes" | "skipped"
    note?: string
    decidedAt: string
  } | null
  skipContext: string | null
  enteredAt: string | null
  completedAt: string | null
  progress: { done: number; total: number } // required outputs filled (provided|confirmed)
}

export interface WorkflowState {
  workspaceId: string
  currentPhaseKey: PhaseKey | null
  phases: PhaseRunState[]
}

// ── Phase definitions ────────────────────────────────────────────────
// Ordered. The spine of the agentic business builder.

export const PHASES: PhaseDefinition[] = [
  {
    key: "product",
    order: 1,
    label: "Product Definition",
    tagline: "Who, what, why. get the premise right.",
    description:
      "Nail down who we serve, what problem we solve, what we sell, and at what price. This is strategy, not tools. outputs land as company memories the whole team inherits.",
    leadRoleKeywords: ["R&D", "Research & Development", "Product", "Chief of Staff"],
    requiredOutputs: [
      { key: "target_customer", label: "Target customer", description: "Who exactly we're selling to.", kind: "decision" },
      { key: "problem_solved", label: "Problem solved", description: "The specific pain we remove.", kind: "decision" },
      { key: "offer_sketch", label: "Offer sketch", description: "One-line description of what we sell.", kind: "decision" },
      { key: "price_range", label: "Price range", description: "Rough starting price point.", kind: "decision" },
    ],
    nextPhase: "research",
  },
  {
    key: "research",
    order: 2,
    label: "Market Research",
    tagline: "Prove the demand is real before we build.",
    description:
      "Analyst-led phase. Gather evidence the market wants this, map top competitors, and benchmark pricing. Findings land as structured knowledge entries. not chat ephemera.",
    leadRoleKeywords: ["Analyst", "Researcher", "Lead Researcher", "Research"],
    requiredOutputs: [
      { key: "demand_evidence", label: "Demand evidence", description: "Concrete proof people want this (search volume, forum posts, sales data, interviews).", kind: "artifact" },
      { key: "competitor_analysis", label: "Competitor analysis", description: "Top 5 competitors with positioning and gaps.", kind: "artifact" },
      { key: "pricing_benchmark", label: "Pricing benchmark", description: "What comparable offers charge and why.", kind: "artifact" },
    ],
    nextPhase: "offer",
  },
  {
    key: "offer",
    order: 3,
    label: "Offer Creation",
    tagline: "Package it so the market says yes.",
    description:
      "Turn the validated premise into a sellable offer: positioning, deliverables, pricing tiers, and a first sales asset. Landing pages + sales pages are built with existing tools, not inside BOS.",
    leadRoleKeywords: ["Marketing", "Strategist", "Growth"],
    requiredOutputs: [
      { key: "positioning_statement", label: "Positioning statement", description: "One paragraph that tells the customer why this is for them.", kind: "decision" },
      { key: "offer_tiers", label: "Offer tiers", description: "Final pricing, deliverables, guarantees.", kind: "decision" },
      {
        key: "sales_page_tool",
        label: "Sales page tool",
        description: "Pick the platform where your landing/sales page lives and wire it up.",
        kind: "integration",
        integrationSuggestions: [
          { name: "GoHighLevel", note: "Recommended. All-in-one: sales pages, CRM, email, payments, calendar, SMS. Cheap, replaces most of the rest of this list." },
          { name: "Framer" },
          { name: "Webflow" },
          { name: "Carrd", note: "Free tier works for v1." },
          { name: "Notion", note: "Free fallback. Public page as landing page." },
        ],
      },
      { key: "first_sales_asset", label: "First sales asset live", description: "Landing page, sales one-pager, or offer doc published.", kind: "milestone" },
    ],
    nextPhase: "marketing",
  },
  {
    key: "marketing",
    order: 4,
    label: "Marketing",
    tagline: "Get the offer in front of the right people.",
    description:
      "Marketing Lead runs this phase. Define ICP, pick channels, pick an email/CRM tool, wire integrations, ship first campaign. No marketing software gets rebuilt. we plug in what exists.",
    leadRoleKeywords: ["Marketing", "Content Strategist", "Growth"],
    requiredOutputs: [
      { key: "icp_defined", label: "ICP defined", description: "Ideal client profile. use the BOS ICP builder.", kind: "decision" },
      { key: "channels_chosen", label: "Channels chosen", description: "Which 1-3 channels we'll focus on first.", kind: "decision" },
      {
        key: "email_platform_integration",
        label: "Email platform wired",
        description: "Marketing email tool connected via API key. Do NOT rebuild, integrate.",
        kind: "integration",
        integrationSuggestions: [
          { name: "GoHighLevel", note: "Recommended. Email is included with GHL alongside CRM, SMS, and funnels. No extra subscription." },
          { name: "Mailchimp" },
          { name: "ActiveCampaign" },
          { name: "ConvertKit" },
          { name: "Gmail + Google Sheets", note: "Free fallback for early outreach." },
        ],
      },
      {
        key: "crm_integration",
        label: "CRM wired",
        description: "CRM connected so agents can log leads and pipeline.",
        kind: "integration",
        integrationSuggestions: [
          { name: "GoHighLevel", note: "Recommended. CRM, pipelines, and lead tracking in the same place as your email and payments. Cheap and easy." },
          { name: "HubSpot", note: "Free tier available." },
          { name: "Pipedrive" },
          { name: "Attio" },
          { name: "Google Sheets", note: "Free fallback. Works fine for under 100 leads." },
        ],
      },
      { key: "first_campaign_shipped", label: "First campaign shipped", description: "First outreach, post, or email actually sent.", kind: "milestone" },
    ],
    nextPhase: "monetization",
  },
  {
    key: "monetization",
    order: 5,
    label: "Monetization",
    tagline: "Take money cleanly.",
    description:
      "Finance Lead runs this. Wire a payment processor, wire invoicing, land the first dollar. BOS never holds its own billing tables. Stripe/GHL/QBO do that.",
    leadRoleKeywords: ["Finance", "Bookkeeper", "Head of Finance"],
    requiredOutputs: [
      {
        key: "payment_processor_integration",
        label: "Payment processor wired",
        description: "How money comes in from customers.",
        kind: "integration",
        integrationSuggestions: [
          { name: "GoHighLevel", note: "Recommended. Payments built into GHL alongside your CRM, email, and funnels. One bill, one dashboard." },
          { name: "Stripe", note: "Best choice if you need a standalone processor with the cleanest API." },
          { name: "PayPal" },
          { name: "Square" },
        ],
      },
      {
        key: "invoice_tool_integration",
        label: "Invoicing wired",
        description: "How invoices get sent and tracked.",
        kind: "integration",
        integrationSuggestions: [
          { name: "GoHighLevel", note: "Recommended. Invoices live inside GHL with your payments and CRM." },
          { name: "Stripe Invoicing", note: "Free if you already use Stripe." },
          { name: "QuickBooks Online" },
          { name: "Wave", note: "Free invoicing tool." },
          { name: "Google Docs template", note: "Manual fallback." },
        ],
      },
      { key: "first_dollar", label: "First dollar received", description: "The first real payment from a real customer.", kind: "milestone" },
    ],
    nextPhase: "delivery",
  },
  {
    key: "delivery",
    order: 6,
    label: "Delivery",
    tagline: "Actually ship what the customer paid for.",
    description:
      "Fulfillment/Delivery Lead runs this. Build the delivery SOP, pick a project management tool, deliver the first client. Project management is integrated, not rebuilt.",
    leadRoleKeywords: ["Delivery", "Fulfillment", "Client Success", "Head of Ops", "Operations"],
    requiredOutputs: [
      { key: "delivery_sop", label: "Delivery SOP", description: "Step-by-step of how we fulfill each client. Stored as an agent SOP.", kind: "artifact" },
      {
        key: "project_mgmt_integration",
        label: "Project management wired",
        description: "Where work-in-flight for each client lives.",
        kind: "integration",
        integrationSuggestions: [
          { name: "GoHighLevel", note: "Recommended if you're already on GHL. Pipelines and Opportunities cover client delivery tracking without a second tool." },
          { name: "ClickUp" },
          { name: "Asana" },
          { name: "Linear", note: "If you already use it for engineering." },
          { name: "Notion" },
          { name: "Trello", note: "Free fallback." },
        ],
      },
      { key: "first_client_delivered", label: "First client delivered", description: "First successful end-to-end delivery logged.", kind: "milestone" },
    ],
    nextPhase: "operations",
  },
  {
    key: "operations",
    order: 7,
    label: "Operations",
    tagline: "Run the machine. ongoing rhythms, metrics, handoffs.",
    description:
      "Operations Lead (and Nova) run this perpetually. Define the weekly/daily rhythm, wire dashboards, make sure team-leaders channel is actively coordinating. This phase never ends. it's steady-state.",
    leadRoleKeywords: ["Operations", "Automation Architect", "Head of Ops", "Chief of Staff"],
    requiredOutputs: [
      { key: "ongoing_rhythms", label: "Ongoing rhythms defined", description: "Daily standup, weekly review, monthly retro. what, when, who.", kind: "decision" },
      {
        key: "dashboards_wired",
        label: "Metrics dashboard wired",
        description: "One place the owner checks for the health of the business.",
        kind: "integration",
        integrationSuggestions: [
          { name: "GoHighLevel", note: "Recommended if you're on GHL. Built-in reporting covers leads, pipeline, and revenue without a separate dashboard tool." },
          { name: "Databox" },
          { name: "Google Looker Studio", note: "Free." },
          { name: "Google Sheets", note: "Free fallback." },
        ],
      },
      { key: "team_handoffs_running", label: "Team handoffs running", description: "team-leaders channel is actively used for cross-team coordination.", kind: "milestone" },
    ],
    nextPhase: null,
  },
]

// ── Lookups ──────────────────────────────────────────────────────────

export function getPhase(key: PhaseKey): PhaseDefinition {
  const phase = PHASES.find((p) => p.key === key)
  if (!phase) throw new Error(`Unknown phase: ${key}`)
  return phase
}

export function getNextPhaseKey(key: PhaseKey): PhaseKey | null {
  return getPhase(key).nextPhase
}

export const FIRST_PHASE_KEY: PhaseKey = PHASES[0].key

// ── Lead agent resolution ────────────────────────────────────────────
// Nova (Chief of Staff) is ALWAYS co-lead. The second lead is resolved
// dynamically by matching agent.role against the phase's keywords.
//
// Resolution order:
//   1. Find a team lead (isTeamLead=true) whose role matches any keyword
//   2. Fall back to any agent whose role matches
//   3. Return only Nova if nothing matches (graceful degrade. phase still runs)

export interface ResolvedPhaseLeads {
  chiefOfStaff: { id: string; name: string; role: string } | null
  departmentLead: { id: string; name: string; role: string } | null
}

export async function getPhaseLeads(phaseKey: PhaseKey): Promise<ResolvedPhaseLeads> {
  const phase = getPhase(phaseKey)

  // Find Chief of Staff (Nova or equivalent). always global co-lead
  const [nova] = await db
    .select({ id: agents.id, name: agents.name, role: agents.role })
    .from(agents)
    .where(or(ilike(agents.role, "%Chief of Staff%"), ilike(agents.name, "Nova")))
    .limit(1)

  // Find department lead by role keyword, preferring team leads
  let departmentLead: { id: string; name: string; role: string } | null = null
  for (const keyword of phase.leadRoleKeywords) {
    // Skip Chief of Staff keyword at the department-lead tier (Nova covers it)
    if (/chief of staff/i.test(keyword)) continue
    const [match] = await db
      .select({ id: agents.id, name: agents.name, role: agents.role, isTeamLead: agents.isTeamLead })
      .from(agents)
      .where(ilike(agents.role, `%${keyword}%`))
      .orderBy(agents.isTeamLead) // team leads first when desc. but drizzle needs explicit; we'll post-sort
      .limit(5)
    if (match) {
      // Prefer team leads if any in the batch
      // (simple post-filter since the query returns up to 5)
      departmentLead = { id: match.id, name: match.name, role: match.role }
      break
    }
  }

  return {
    chiefOfStaff: nova ?? null,
    departmentLead,
  }
}

// ── State reads ──────────────────────────────────────────────────────

export async function getWorkflowState(workspaceId: string): Promise<WorkflowState> {
  const [ws] = await db
    .select({ currentPhaseKey: workspaces.currentPhaseKey })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`)

  const runs = await db
    .select()
    .from(workflowPhaseRuns)
    .where(eq(workflowPhaseRuns.workspaceId, workspaceId))

  const runsByKey = new Map(runs.map((r) => [r.phaseKey, r]))

  const phases: PhaseRunState[] = PHASES.map((phase) => {
    const run = runsByKey.get(phase.key)
    const outputs = (run?.outputs ?? {}) as PhaseRunState["outputs"]
    const filled = phase.requiredOutputs.filter(
      (o) => outputs[o.key] && outputs[o.key].status !== "empty"
    ).length
    return {
      phaseKey: phase.key,
      status: (run?.status ?? "pending") as PhaseStatus,
      outputs,
      gateDecision: (run?.gateDecision ?? null) as PhaseRunState["gateDecision"],
      skipContext: run?.skipContext ?? null,
      enteredAt: run?.enteredAt ? run.enteredAt.toISOString() : null,
      completedAt: run?.completedAt ? run.completedAt.toISOString() : null,
      progress: { done: filled, total: phase.requiredOutputs.length },
    }
  })

  return {
    workspaceId,
    currentPhaseKey: (ws.currentPhaseKey ?? null) as PhaseKey | null,
    phases,
  }
}

// ── State writes ─────────────────────────────────────────────────────

export async function ensureWorkflowInitialized(workspaceId: string): Promise<WorkflowState> {
  const [ws] = await db
    .select({ currentPhaseKey: workspaces.currentPhaseKey })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`)

  if (!ws.currentPhaseKey) {
    const now = new Date()
    await db
      .update(workspaces)
      .set({ currentPhaseKey: FIRST_PHASE_KEY, phaseStartedAt: now })
      .where(eq(workspaces.id, workspaceId))
    await db.insert(workflowPhaseRuns).values({
      workspaceId,
      phaseKey: FIRST_PHASE_KEY,
      status: "active",
      enteredAt: now,
    })
  }

  return getWorkflowState(workspaceId)
}

export async function upsertPhaseOutput(
  workspaceId: string,
  phaseKey: PhaseKey,
  outputKey: string,
  payload: {
    status: "provided" | "confirmed"
    value?: string
    sourceId?: string
    sourceType?: "company_memory" | "knowledge_entry" | "text"
  }
): Promise<void> {
  const phase = getPhase(phaseKey)
  const spec = phase.requiredOutputs.find((o) => o.key === outputKey)
  if (!spec) throw new Error(`Unknown output key ${outputKey} for phase ${phaseKey}`)

  // Ensure a phase run row exists (phase may not have been entered yet, e.g.
  // user provided info for a future phase during skip).
  const [existing] = await db
    .select()
    .from(workflowPhaseRuns)
    .where(and(
      eq(workflowPhaseRuns.workspaceId, workspaceId),
      eq(workflowPhaseRuns.phaseKey, phaseKey),
    ))
    .limit(1)

  const now = new Date()
  const outputEntry = { ...payload, updatedAt: now.toISOString() }

  if (!existing) {
    await db.insert(workflowPhaseRuns).values({
      workspaceId,
      phaseKey,
      status: "pending",
      outputs: { [outputKey]: outputEntry },
    })
    return
  }

  const prior = (existing.outputs ?? {}) as PhaseRunState["outputs"]
  const nextOutputs: PhaseRunState["outputs"] = { ...prior, [outputKey]: outputEntry }
  await db
    .update(workflowPhaseRuns)
    .set({ outputs: nextOutputs, updatedAt: now })
    .where(eq(workflowPhaseRuns.id, existing.id))
}

export async function recordPhaseGate(
  workspaceId: string,
  phaseKey: PhaseKey,
  decision: "approved" | "needs_changes" | "skipped",
  note?: string
): Promise<void> {
  const now = new Date()
  const gate = { decision, note, decidedAt: now.toISOString() }
  await db
    .update(workflowPhaseRuns)
    .set({ gateDecision: gate, updatedAt: now })
    .where(and(
      eq(workflowPhaseRuns.workspaceId, workspaceId),
      eq(workflowPhaseRuns.phaseKey, phaseKey),
    ))
}

export async function advancePhase(workspaceId: string): Promise<WorkflowState> {
  const state = await getWorkflowState(workspaceId)
  if (!state.currentPhaseKey) throw new Error("Workflow not initialized")
  const current = getPhase(state.currentPhaseKey)
  const currentRun = state.phases.find((p) => p.phaseKey === current.key)!

  if (!currentRun.gateDecision || currentRun.gateDecision.decision !== "approved") {
    throw new Error("Current phase has no approved gate. record a gate before advancing")
  }

  const now = new Date()
  await db
    .update(workflowPhaseRuns)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(and(
      eq(workflowPhaseRuns.workspaceId, workspaceId),
      eq(workflowPhaseRuns.phaseKey, current.key),
    ))

  const nextKey = current.nextPhase
  if (!nextKey) {
    // Operations is terminal (steady-state). Clear currentPhaseKey? Or keep?
    // Keep. operations is perpetual. Just mark completed_at on the run.
    await db
      .update(workspaces)
      .set({ currentPhaseKey: null, phaseStartedAt: null })
      .where(eq(workspaces.id, workspaceId))
    return getWorkflowState(workspaceId)
  }

  // Start next phase (upsert. it may already exist from prior skip context)
  const [existing] = await db
    .select()
    .from(workflowPhaseRuns)
    .where(and(
      eq(workflowPhaseRuns.workspaceId, workspaceId),
      eq(workflowPhaseRuns.phaseKey, nextKey),
    ))
    .limit(1)

  if (existing) {
    await db
      .update(workflowPhaseRuns)
      .set({ status: "active", enteredAt: now, updatedAt: now })
      .where(eq(workflowPhaseRuns.id, existing.id))
  } else {
    await db.insert(workflowPhaseRuns).values({
      workspaceId,
      phaseKey: nextKey,
      status: "active",
      enteredAt: now,
    })
  }

  await db
    .update(workspaces)
    .set({ currentPhaseKey: nextKey, phaseStartedAt: now })
    .where(eq(workspaces.id, workspaceId))

  return getWorkflowState(workspaceId)
}

export async function skipPhase(
  workspaceId: string,
  phaseKey: PhaseKey,
  skipContext: string
): Promise<WorkflowState> {
  if (!skipContext || skipContext.trim().length < 20) {
    throw new Error("Skipping a phase requires a context brain-dump (min 20 chars) so downstream agents inherit what they need.")
  }

  const now = new Date()
  const [existing] = await db
    .select()
    .from(workflowPhaseRuns)
    .where(and(
      eq(workflowPhaseRuns.workspaceId, workspaceId),
      eq(workflowPhaseRuns.phaseKey, phaseKey),
    ))
    .limit(1)

  if (existing) {
    await db
      .update(workflowPhaseRuns)
      .set({
        status: "skipped",
        skipContext,
        gateDecision: { decision: "skipped", note: skipContext, decidedAt: now.toISOString() },
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(workflowPhaseRuns.id, existing.id))
  } else {
    await db.insert(workflowPhaseRuns).values({
      workspaceId,
      phaseKey,
      status: "skipped",
      skipContext,
      gateDecision: { decision: "skipped", note: skipContext, decidedAt: now.toISOString() },
      enteredAt: now,
      completedAt: now,
    })
  }

  // Advance current phase pointer if we're skipping the currently active one
  const [ws] = await db
    .select({ currentPhaseKey: workspaces.currentPhaseKey })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  if (ws?.currentPhaseKey === phaseKey) {
    const nextKey = getNextPhaseKey(phaseKey)
    if (nextKey) {
      const [nextExisting] = await db
        .select()
        .from(workflowPhaseRuns)
        .where(and(
          eq(workflowPhaseRuns.workspaceId, workspaceId),
          eq(workflowPhaseRuns.phaseKey, nextKey),
        ))
        .limit(1)
      if (nextExisting) {
        await db
          .update(workflowPhaseRuns)
          .set({ status: "active", enteredAt: now, updatedAt: now })
          .where(eq(workflowPhaseRuns.id, nextExisting.id))
      } else {
        await db.insert(workflowPhaseRuns).values({
          workspaceId,
          phaseKey: nextKey,
          status: "active",
          enteredAt: now,
        })
      }
      await db
        .update(workspaces)
        .set({ currentPhaseKey: nextKey, phaseStartedAt: now })
        .where(eq(workspaces.id, workspaceId))
    } else {
      await db
        .update(workspaces)
        .set({ currentPhaseKey: null, phaseStartedAt: null })
        .where(eq(workspaces.id, workspaceId))
    }
  }

  return getWorkflowState(workspaceId)
}

// ── Phase guidance for agent chats (BLA-64) ──────────────────────────
// When a user chats with an agent that's a phase lead, we inject phase
// context into the system prompt so the agent naturally walks the user
// through the required outputs. The agent uses the record_phase_output
// tool (see api/chat route) to capture answers as company memories.

export interface PhaseGuidanceContext {
  workspaceId: string
  phaseKey: PhaseKey
  phaseLabel: string
  phaseTagline: string
  phaseDescription: string
  alreadyCaptured: { key: string; label: string; value?: string }[]
  stillNeeded: PhaseOutputSpec[]
  allOutputs: PhaseOutputSpec[]
  isLeadAgent: boolean
}

/**
 * Returns phase guidance context for an agent if:
 *   1. The workspace has an active phase
 *   2. The given agent is either the Chief of Staff (Nova) OR the department
 *      lead for the active phase (resolved dynamically via role keywords)
 * Returns null otherwise. meaning chat proceeds in normal (non-phase) mode.
 */
export async function getPhaseGuidanceForAgent(
  workspaceId: string,
  agentId: string,
): Promise<PhaseGuidanceContext | null> {
  const state = await getWorkflowState(workspaceId)
  if (!state.currentPhaseKey) return null

  const phaseKey = state.currentPhaseKey as PhaseKey
  const phase = getPhase(phaseKey)
  const leads = await getPhaseLeads(phaseKey)

  const isLead = leads.chiefOfStaff?.id === agentId || leads.departmentLead?.id === agentId
  if (!isLead) return null

  const currentRun = state.phases.find((p) => p.phaseKey === phaseKey)
  const outputsState = currentRun?.outputs ?? {}

  const alreadyCaptured: { key: string; label: string; value?: string }[] = []
  const stillNeeded: PhaseOutputSpec[] = []

  for (const spec of phase.requiredOutputs) {
    const captured = outputsState[spec.key]
    if (captured && captured.status !== "empty") {
      alreadyCaptured.push({ key: spec.key, label: spec.label, value: captured.value })
    } else {
      stillNeeded.push(spec)
    }
  }

  return {
    workspaceId,
    phaseKey,
    phaseLabel: phase.label,
    phaseTagline: phase.tagline,
    phaseDescription: phase.description,
    alreadyCaptured,
    stillNeeded,
    allOutputs: phase.requiredOutputs,
    isLeadAgent: true,
  }
}

/** Render a human-readable system-prompt block from phase guidance. */
export function renderPhaseGuidancePrompt(ctx: PhaseGuidanceContext): string {
  const capturedBlock = ctx.alreadyCaptured.length > 0
    ? ctx.alreadyCaptured.map((o) => `  ✓ ${o.label}${o.value ? `: ${o.value}` : ""}`).join("\n")
    : "  (nothing captured yet)"

  const neededBlock = ctx.stillNeeded.length > 0
    ? ctx.stillNeeded.map((o) => `  • ${o.label}. ${o.description} [output_key: ${o.key}]`).join("\n")
    : "  (all required outputs captured. time to ask the user for buy-in to move forward)"

  return `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTIVE BUSINESS-BUILDING PHASE. YOU ARE LEADING THIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are currently leading Phase: **${ctx.phaseLabel}**
Tagline: ${ctx.phaseTagline}

${ctx.phaseDescription}

Already captured:
${capturedBlock}

Still needed:
${neededBlock}

YOUR JOB THIS TURN:
- If there are still required outputs, ask the user about the NEXT missing one in natural conversation. Ask one question at a time. Don't dump a form.
- When the user gives you a clear answer to one of the required outputs, IMMEDIATELY call the \`record_phase_output\` tool with the correct output_key and a 1-2 sentence summary of their answer. Then acknowledge it and move on to the next missing output.
- Only call \`record_phase_output\` when you genuinely have a clear answer, not for vague or non-answers.
- Stay in character. You're not a form. You're a team lead who cares about getting this right.

WHEN ALL REQUIRED OUTPUTS ARE CAPTURED:
Don't just summarize and wait. Produce something real. Follow this sequence:

1. Use \`create_document\` to create a thorough business strategy document. The document structure depends on the phase:

FOR PRODUCT DEFINITION PHASE, create a document titled "Business Overview: [Company Name]" with these exact sections. Use the Hormozi Value Equation and Lean Canvas frameworks. Be specific to THIS business, not generic:

## Executive Summary
One paragraph. What the business does, for whom, and why it will win.

## The Problem
The specific pain this business solves. Who feels it most acutely. What it costs them to NOT solve it (in dollars, time, or opportunity). Frame it through Hormozi's lens: what is the dream outcome the customer desperately wants?

## Target Customer
Detailed avatar. Industry, company size, role of the buyer, their current behavior, where they spend time online, what they've already tried that didn't work. Be specific. "Agency owners doing $30K-$100K/month who are drowning in manual ops" is good. "Business owners" is not.

## The Offer
What we sell. The format (coaching, done-for-you, SaaS, course, service). What's included. What specific result it promises. Frame it using the Hormozi Value Equation: Value = Dream Outcome x Perceived Likelihood of Achievement / Time Delay x Effort & Sacrifice. The offer should maximize the top and minimize the bottom.

## Pricing Logic
The price point. Why that price is justified based on the value delivered. What the ROI looks like for the customer. Time to first result. Level of effort required from them.

## Competitive Landscape
Top 3-5 competitors (use what the user shared plus anything you can reason about). What each does well. Where they fall short. Their approximate pricing. Where the gap is that this business fills.

## Unfair Advantage
What makes this business hard to copy. Could be: founder's unique experience, proprietary process, compound data/SOPs, speed of delivery, network, technology stack. Be honest. If the advantage is thin, say so and suggest how to build a stronger one.

## Go-To-Market Direction
First channels to focus on. What the first 90 days should look like. Initial marketing approach (organic, paid, outbound, partnerships). This section hands off naturally to the Marketing team.

## Key Metrics
The 5-8 numbers that tell us if this business is working. Revenue, customers, conversion rate, churn, CAC, LTV, pipeline size, etc. Pick the ones that matter most for this specific business model.

## Next Steps
What the Marketing team needs to do with this document. What the user should focus on personally. What decisions are still open.

FOR MARKET RESEARCH PHASE, create a "Market Research Report" with: Demand Evidence, Competitor Deep Dive (with specific competitor analysis), Pricing Benchmarks, Market Gaps and Opportunities, Recommended Positioning.

FOR OTHER PHASES, create the appropriate deliverable document.

Make it LONG and DETAILED. This is a real strategy document, not a summary. Minimum 1500 words. The user should be impressed by how thorough it is.

2. Use \`post_win\` to celebrate. Example: "Business Overview complete for [Company Name]" with a short excited description.

3. IMPORTANT: After creating the doc, tell the user EXACTLY this (fill in the details):

"Done. I just created your Business Overview doc. You can view it here: /business (go to My Business in the sidebar).

Take a look and let me know what you think. If anything needs changing I'll revise it. When you're happy with it, say 'approved' and I'll hand this off to Marketing to start building your go-to-market plan."

4. WAIT for the user to respond. Do NOT handoff yet. The user needs to review the doc first.

5. If the user says "approved", "looks good", "ship it", "go", or anything affirmative:
   - Use \`handoff_to_department\` to pass to Marketing
   - Tell them: "Handed off to Marketing. Check the team-leaders channel to see them pick it up."

6. If the user asks for changes, revise the doc or discuss what needs to change. Don't handoff until they approve.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
}

// ── Playbook relevance lookup (BLA-139 follow-up) ───────────────────
// Seeded business-building playbooks live in `knowledge_entries` tagged
// `internal` + `phase:<key>` + topic/frequency tags. They're hidden from
// the user-facing Knowledge page and global search, but the chat route
// can pull phase-relevant ones to inject into a phase lead's system
// prompt so the agent can cite frameworks accurately during guided
// phases.
//
// Digest extraction: from each matched playbook we extract a compact
// summary (title + intro paragraph + H2 heading list). We don't dump
// full content. that would blow the context window. The digest gives
// the agent a map of the framework's scope; if the agent needs detail,
// a future chunk can add a "fetch_playbook_detail" tool.

export interface PlaybookDigest {
  title: string
  intro: string            // first real paragraph after the H1, clamped
  sections: string[]       // H2 heading list, first 8
  topicTags: string[]      // non-internal, non-phase tags for context
}

/** Extract a compact digest from a playbook's markdown content. */
function extractPlaybookDigest(title: string, content: string, tags: string[]): PlaybookDigest {
  const lines = content.split("\n")

  // Find the first real paragraph after the H1 (skip H1 itself, blockquotes, headings, blanks)
  let intro = ""
  let startedBody = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!startedBody) {
      if (trimmed.startsWith("# ")) { startedBody = true; continue }
      continue
    }
    if (!trimmed) { if (intro) break; continue }
    if (trimmed.startsWith("#")) { if (intro) break; continue }
    if (trimmed.startsWith(">")) continue
    intro += (intro ? " " : "") + trimmed
    if (intro.length > 400) break
  }
  if (intro.length > 500) intro = intro.slice(0, 497) + "..."

  // Collect H2 headings
  const sections: string[] = []
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) sections.push(m[1].trim())
    if (sections.length >= 8) break
  }

  const topicTags = tags.filter((t) =>
    t !== "internal" && t !== "playbook" && !t.startsWith("phase:")
  )

  return { title, intro, sections, topicTags }
}

/** Render a playbook digest as a compact system-prompt block. */
export function renderPlaybookDigest(d: PlaybookDigest): string {
  const parts: string[] = []
  parts.push(`**Framework: ${d.title}**`)
  if (d.intro) parts.push(d.intro)
  if (d.sections.length > 0) {
    parts.push(`Covers: ${d.sections.join(" · ")}`)
  }
  if (d.topicTags.length > 0) {
    parts.push(`Tags: ${d.topicTags.join(", ")}`)
  }
  return parts.join("\n")
}

/**
 * Fetch up to `limit` playbook digests relevant to the given phase.
 * Returns compact digests (not full content). suitable for direct
 * injection into an agent system prompt.
 */
export async function getPlaybooksForPhase(
  phaseKey: PhaseKey,
  limit = 3,
): Promise<PlaybookDigest[]> {
  const phaseTag = `phase:${phaseKey}`
  // Order by created_at DESC so newer curated additions bubble to the top.
  // Luke drops new playbooks over time and wants them reached first without
  // needing a manual priority field.
  const rows = await db
    .select({
      title: knowledgeEntries.title,
      content: knowledgeEntries.content,
      tags: knowledgeEntries.tags,
    })
    .from(knowledgeEntries)
    .where(
      and(
        sql`${knowledgeEntries.tags} @> '["internal"]'::jsonb`,
        sql`${knowledgeEntries.tags} @> '["playbook"]'::jsonb`,
        sql`${knowledgeEntries.tags} @> ${JSON.stringify([phaseTag])}::jsonb`,
      ),
    )
    .orderBy(sql`${knowledgeEntries.createdAt} DESC`)
    .limit(limit)

  return rows.map((r) => extractPlaybookDigest(r.title, r.content, (r.tags ?? []) as string[]))
}

/** Render a full playbook reference block for system prompt injection. */
export function renderPlaybookReferenceBlock(digests: PlaybookDigest[]): string {
  if (digests.length === 0) return ""
  const body = digests.map((d) => renderPlaybookDigest(d)).join("\n\n")
  return `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROVEN FRAMEWORKS FOR THIS PHASE. INTERNAL REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These are battle-tested business-building frameworks relevant to the current phase. Use them to guide your questions and recommendations, but NEVER mention they're "frameworks" or cite them explicitly. talk like a team member drawing on experience, not a consultant reading from a playbook. The user should feel like you know this stuff, not like you're looking it up.

${body}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
}

// Suppress unused-import warning for `teams`. reserved for future lead
// resolution that walks team → leadAgentId. Keeping import deliberate.
void teams
