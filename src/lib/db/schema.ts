import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  unique,
} from "drizzle-orm/pg-core"

// ── Users ─────────────────────────────────────────────────
// Per-user identity inside a single company's Business OS deploy.
// NOT multi-tenant: all users in this table belong to the same company
// (the company that deployed this instance). See project_deployment_model memory.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"), // "owner" | "admin" | "member"
  avatarEmoji: text("avatar_emoji").default("👤"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
})

// ── Invites ───────────────────────────────────────────────
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => users.id),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  expiresAt: timestamp("expires_at").notNull(),
})

// ── Workspaces ────────────────────────────────────────────
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // e.g. "VESPR"
  slug: text("slug").notNull(), // URL-friendly: "vespr"
  icon: text("icon").notNull().default("🏢"), // emoji or letter
  description: text("description"), // what the business does
  businessType: text("business_type").notNull().default("agency"), // agency, saas, ecommerce, info_product, consulting, other
  industry: text("industry"), // e.g. "AI Services"
  website: text("website"),
  businessProfile: jsonb("business_profile").$type<{
    mission?: string
    icp?: string
    verticals?: string[]
    teamSize?: string
    revenue?: string
    tools?: string[]
    goal?: string          // what they want to achieve
    targetScale?: string   // where they want to scale to
    timeline?: string      // by when
    competitors?: Array<{ label: string; url: string }>
  }>().default({}),
  // Owner identity — the founder using this workspace
  ownerName: text("owner_name"),
  // Anthropic API key — required for AI to operate on user's account (per PVD)
  anthropicApiKey: text("anthropic_api_key"),
  // Current phase in the Workflow Engine state machine (BLA-63). Null until
  // phases are initialized for this workspace. See `src/lib/workflow-engine.ts`.
  currentPhaseKey: text("current_phase_key"),
  phaseStartedAt: timestamp("phase_started_at"),
  isActive: boolean("is_active").notNull().default(true),
  // Public trainer profile (opt-in) — per engagement spec Phase 3
  isPublic: boolean("is_public").notNull().default(false),
  publicTagline: text("public_tagline"), // one-line founder flex
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Teams ──────────────────────────────────────────────────
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("⚙️"),
  leadAgentId: uuid("lead_agent_id"), // team lead — references agents but no FK to avoid circular
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Team Goals ─────────────────────────────────────────────
export const teamGoals = pgTable("team_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").references(() => teams.id).notNull(),
  title: text("title").notNull(),
  target: integer("target").notNull(), // target number
  progress: integer("progress").notNull().default(0),
  unit: text("unit").notNull().default("tasks"), // "tasks", "leads", "posts", "%", "hrs", etc.
  status: text("status").notNull().default("active"), // "active" | "completed" | "paused"
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Agents ─────────────────────────────────────────────────
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  avatar: text("avatar").notNull(), // 2-letter fallback
  pixelAvatarIndex: integer("pixel_avatar_index").notNull().default(0),
  provider: text("provider").notNull().default("anthropic"), // anthropic, openai, google, custom
  model: text("model").notNull().default("Claude Haiku"),
  systemPrompt: text("system_prompt"),
  status: text("status").notNull().default("idle"), // working, idle, error, paused
  teamId: uuid("team_id").references(() => teams.id),
  currentTask: text("current_task"),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  personalityPresetId: text("personality_preset_id"), // null = custom personality
  personalityConfig: jsonb("personality_config").$type<Record<string, unknown>>(), // expanded custom personality (CustomPersonalityConfig)
  personality: jsonb("personality").$type<{
    formality: number   // 0 = casual, 100 = formal
    humor: number       // 0 = dry, 100 = goofy
    energy: number      // 0 = calm, 100 = intense
    warmth: number      // 0 = cool, 100 = warm
    directness: number  // 0 = diplomatic, 100 = blunt
    confidence: number  // 0 = humble, 100 = bold
    verbosity: number   // 0 = terse, 100 = expressive
  }>().notNull().default({ formality: 40, humor: 30, energy: 50, warmth: 60, directness: 50, confidence: 50, verbosity: 40 }),
  autonomyLevel: text("autonomy_level").notNull().default("supervised"), // "full_auto" | "supervised" | "manual"
  isTeamLead: boolean("is_team_lead").notNull().default(false),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streak: integer("streak").notNull().default(0), // DEPRECATED per engagement spec — no longer displayed or incremented
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  costThisMonth: real("cost_this_month").notNull().default(0),
  // Identity system (per engagement spec Section 5)
  nickname: text("nickname"), // user-set when agent is hired
  archetype: text("archetype"), // Scout, Closer, Analyst, Strategist, Builder, Operator, Communicator
  tier: text("tier").notNull().default("common"), // common, uncommon, rare, epic, legendary
  identityStats: jsonb("identity_stats").$type<{
    outreach?: number
    research?: number
    negotiation?: number
    execution?: number
    creativity?: number
  }>().notNull().default({}),
  // Cumulative outcome counters — used by evolution engine
  outcomeStats: jsonb("outcome_stats").$type<{
    qualified_leads?: number
    deals_closed?: number
    meetings_booked?: number
    tasks_shipped?: number
    sops_authored?: number
    documents_delivered?: number
    revenue_sourced?: number
  }>().notNull().default({}),
  currentForm: text("current_form"), // e.g. "Senior Scout"
  evolvedFromForm: text("evolved_from_form"), // previous form name, if evolved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Evolution Events ──────────────────────────────────────
export const evolutionEvents = pgTable("evolution_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  fromForm: text("from_form").notNull(),
  toForm: text("to_form").notNull(),
  triggerMetric: text("trigger_metric").notNull(), // e.g. "qualified_leads", "deals_closed"
  triggerValue: integer("trigger_value").notNull(),
  unlockedCapabilities: jsonb("unlocked_capabilities").$type<string[]>().notNull().default([]),
  shareableCardUrl: text("shareable_card_url"),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
})

// ── Roster Unlocks ────────────────────────────────────────
// New archetypes become available as the business hits milestones (spec Section 11)
export const rosterUnlocks = pgTable("roster_unlocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  archetype: text("archetype").notNull(), // Scout, Closer, Analyst, etc.
  tier: text("tier").notNull().default("common"), // common/uncommon/rare/epic/legendary
  triggerMetric: text("trigger_metric").notNull(), // first_customer, mrr_10k, etc.
  triggerValue: text("trigger_value"), // human-readable, e.g. "$10K MRR"
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
})

// ── Agent Bonds (Synergy) ──────────────────────────────────
// Tracks collaboration between agents and their outcome lift (spec Section 10)
export const agentBonds = pgTable("agent_bonds", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentAId: uuid("agent_a_id").notNull(),
  agentBId: uuid("agent_b_id").notNull(),
  workflowCount: integer("workflow_count").notNull().default(0),
  outcomeLift: real("outcome_lift"), // e.g. 0.15 for +15%
  liftLabel: text("lift_label"), // "conversion", "close rate", "delivery speed"
  context: text("context"), // "on enterprise deals", "on client onboarding"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Agent Emergent Traits ──────────────────────────────────
// Derived from performance data — descriptive, never judgmental (spec Section 9)
export const agentTraits = pgTable("agent_traits", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  trait: text("trait").notNull(), // "Follows up within 2 hours"
  sourceMetric: text("source_metric").notNull(), // traceable back to data
  sourceValue: text("source_value"), // human-readable backing value
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Trophy Feed Events ────────────────────────────────────
// Home screen highlight reel — wins only, per engagement spec Section 7
export const trophyEvents = pgTable("trophy_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id"),
  agentId: uuid("agent_id"),
  agentName: text("agent_name"),
  type: text("type").notNull(), // deal_closed, meeting_booked, milestone, evolution, first, capability_unlocked
  title: text("title").notNull(), // e.g. "Kira closed Acme — $12K ARR"
  description: text("description"),
  icon: text("icon"), // emoji
  amount: real("amount"), // for deal_closed events
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Channels ───────────────────────────────────────────────
export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull().default("team"), // team, agent, project, direct, system
  teamId: uuid("team_id").references(() => teams.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Messages ───────────────────────────────────────────────
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").references(() => channels.id).notNull(),
  threadId: uuid("thread_id"),
  senderAgentId: uuid("sender_agent_id").references(() => agents.id),
  senderUserId: text("sender_user_id"), // for human messages
  senderName: text("sender_name").notNull(),
  senderAvatar: text("sender_avatar").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"),
  linkedTaskId: uuid("linked_task_id"), // bidirectional link to a task
  reactions: jsonb("reactions").$type<{ emoji: string; count: number; agentNames: string[] }[]>().notNull().default([]),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Tasks ──────────────────────────────────────────────────
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  assignedAgentId: uuid("assigned_agent_id").references(() => agents.id),
  assignedToUser: boolean("assigned_to_user").notNull().default(false), // true = task for the human
  teamId: uuid("team_id").references(() => teams.id),
  status: text("status").notNull().default("backlog"), // backlog, todo, in_progress, review, done
  priority: text("priority").notNull().default("medium"), // urgent, high, medium, low
  parentTaskId: uuid("parent_task_id"),
  linkedMessageIds: jsonb("linked_message_ids").$type<string[]>().notNull().default([]),
  // Rich guidance for user-assigned tasks
  instructions: text("instructions"), // step-by-step markdown
  resources: jsonb("resources").$type<{ label: string; url: string }[]>(),
  blockedReason: text("blocked_reason"), // what's waiting on this task
  // Deliverable requirement — what must be submitted before task can be completed
  requirement: jsonb("requirement").$type<{
    type: "file" | "url" | "text" | "checkbox" | null // null = no requirement
    label: string // e.g. "Upload the signed contract"
    fulfilled?: boolean
    value?: string // file url, text response, or url
    fulfilledAt?: string
  }>(),
  result: jsonb("result").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
})

// ── Automations ────────────────────────────────────────────
export const automations = pgTable("automations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  schedule: text("schedule").notNull(), // cron expression
  status: text("status").notNull().default("active"), // active, paused, error
  managedByAgentId: uuid("managed_by_agent_id").references(() => agents.id),
  runCount: integer("run_count").notNull().default(0),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Agent SOPs ─────────────────────────────────────────────
export const agentSops = pgTable("agent_sops", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(), // rich text / markdown
  category: text("category").notNull().default("general"), // general, process, tools, escalation, reference
  sortOrder: integer("sort_order").notNull().default(0),
  version: integer("version").notNull().default(1),
  positiveFeedback: integer("positive_feedback").notNull().default(0),
  negativeFeedback: integer("negative_feedback").notNull().default(0),
  lastImprovedAt: timestamp("last_improved_at"),
  improvementSource: text("improvement_source"), // "feedback" | "task_outcome" | "manual"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Knowledge Entries ─────────────────────────────────────
export const knowledgeEntries = pgTable("knowledge_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(), // markdown
  category: text("category").notNull().default("business"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  linkedEntries: jsonb("linked_entries").$type<string[]>().notNull().default([]),
  createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
  createdByName: text("created_by_name").notNull().default("Unknown"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Agent Schedules (Cron Jobs) ────────────────────────────
export const agentSchedules = pgTable("agent_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  cronExpression: text("cron_expression").notNull(),
  taskPrompt: text("task_prompt").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Approval Requests (Human-in-the-Loop Queue) ──────────
export const approvalRequests = pgTable("approval_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  agentName: text("agent_name").notNull(),
  actionType: text("action_type").notNull(), // "send_email", "publish_content", "approve_spend", "launch_campaign", "external_action"
  title: text("title").notNull(),
  description: text("description").notNull(),
  reasoning: text("reasoning"), // why the agent is asking
  options: jsonb("options").$type<{ label: string; value: string }[]>(), // approve/reject/custom options
  // actionPayload: serialized action spec that the approval executor runs
  // when this request transitions to "approved". See src/lib/approvals/executor.ts
  // for the discriminated union of supported action types.
  actionPayload: jsonb("action_payload").$type<Record<string, unknown>>(),
  urgency: text("urgency").notNull().default("normal"), // "urgent" | "normal" | "low"
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected" | "modified"
  response: text("response"), // user's response/modification OR executor result (JSON stringified)
  channelId: uuid("channel_id").references(() => channels.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  executedAt: timestamp("executed_at"),
})

// ── Approval Log & Progressive Autonomy ───────────────────
export const approvalLog = pgTable("approval_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  actionType: text("action_type").notNull(), // e.g. "send_email", "publish_content", "approve_spend", "launch_campaign"
  description: text("description").notNull(),
  decision: text("decision").notNull(), // "approved" | "rejected" | "modified"
  reasoning: text("reasoning"), // why the agent requested this
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const autoApprovals = pgTable("auto_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  actionType: text("action_type").notNull(), // auto-approved action type
  approvalCount: integer("approval_count").notNull().default(0), // how many times approved before auto
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Decision Log (Audit Trail) ────────────────────────────
export const decisionLog = pgTable("decision_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id),
  agentName: text("agent_name").notNull(),
  actionType: text("action_type").notNull(), // "task_completed", "sop_updated", "message_sent", "integration_call", "approval_requested", "decision_made"
  title: text("title").notNull(),
  description: text("description").notNull(),
  reasoning: text("reasoning"), // why the agent did this
  outcome: text("outcome"), // what happened as a result
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Agent Feedback ────────────────────────────────────────
export const agentFeedback = pgTable("agent_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  messageId: uuid("message_id").references(() => messages.id),
  rating: text("rating").notNull(), // "positive" | "negative"
  correction: text("correction"), // optional text correction from the user
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Integrations ──────────────────────────────────────────
// Credentials for external SaaS tools the user has connected. Per the
// integrate-don't-rebuild principle, BOS never stores customer data
// from these tools as its own records. It stores the credentials so
// agents can call the tools through a thin adapter layer (BLA-88/89).
//
// The `config` field holds the encrypted credentials payload as a
// base64 string under the `encrypted` key. Plaintext never hits this
// table. See `src/lib/integrations/crypto.ts` for the cipher.
export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  providerKey: text("provider_key"), // normalized id: "gohighlevel", "stripe", "mailchimp", etc.
  name: text("name").notNull(),      // display name: "GoHighLevel", "Stripe", etc.
  provider: text("provider").notNull(), // legacy field, keeping for compat
  category: text("category").notNull(), // "crm", "email", "payments", "marketing", "delivery", "dashboards"
  status: text("status").notNull().default("disconnected"), // "connected" | "disconnected" | "error"
  // Free-form jsonb. For integrations connected via the BLA-88 adapter,
  // the object carries an `encrypted` base64 string with AES-256-GCM
  // ciphertext of the credentials. Legacy demo seeds use ad-hoc keys
  // like `workspace`, `handle`, etc.
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  connectedAt: timestamp("connected_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Agent Memory ──────────────────────────────────────────
export const agentMemories = pgTable("agent_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  memoryType: text("memory_type").notNull(), // "observation" | "preference" | "learning" | "relationship" | "skill"
  content: text("content").notNull(),
  importance: real("importance").notNull().default(0.5), // 0-1, higher = more likely to be recalled
  source: text("source"), // "conversation" | "feedback" | "task_outcome" | "correction" | "system"
  relatedAgentId: uuid("related_agent_id"), // for relationship memories
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Company Memory (shared across all agents) ────────────
export const companyMemories = pgTable("company_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(), // "client" | "process" | "preference" | "lesson" | "fact"
  title: text("title").notNull(),
  content: text("content").notNull(),
  importance: real("importance").notNull().default(0.5),
  source: text("source"), // "agent" | "user" | "system"
  sourceAgentId: uuid("source_agent_id").references(() => agents.id),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Gamification ──────────────────────────────────────────
export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id),
  type: text("type").notNull(), // "agent" | "team" | "company"
  name: text("name").notNull(), // e.g. "First Task", "Century Club", "Revenue Milestone"
  description: text("description").notNull(),
  icon: text("icon").notNull(), // emoji
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
})

// ── Workflow Engine ───────────────────────────────────────
// Phased business-building state machine (BLA-63).
// Each workspace runs through 7 phases: product → research → offer →
// marketing → monetization → delivery → operations. Lead agents own
// each phase, user gates sit between phases.
// Phase definitions live in `src/lib/workflow-engine.ts` (constants,
// not user-editable). This table only stores per-workspace progress.
export const workflowPhaseRuns = pgTable("workflow_phase_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id).notNull(),
  phaseKey: text("phase_key").notNull(), // "product" | "research" | "offer" | "marketing" | "monetization" | "delivery" | "operations"
  status: text("status").notNull().default("pending"), // "pending" | "active" | "completed" | "skipped"
  // outputs: { [outputKey]: { status, value?, sourceId?, sourceType?, updatedAt } }
  // outputKey matches a required key defined by the phase in workflow-engine.ts
  // sourceType points to where the real artifact lives: "company_memory" | "knowledge_entry" | "text"
  outputs: jsonb("outputs").$type<Record<string, {
    status: "empty" | "provided" | "confirmed"
    value?: string
    sourceId?: string
    sourceType?: "company_memory" | "knowledge_entry" | "text"
    updatedAt?: string
  }>>().notNull().default({}),
  // gateDecision: user's buy-in response before advancing out of this phase
  gateDecision: jsonb("gate_decision").$type<{
    decision: "approved" | "needs_changes" | "skipped"
    note?: string
    decidedAt: string
  } | null>(),
  // skipContext: user's brain-dump when they skip the phase — so downstream
  // agents inherit the info they would have gathered here
  skipContext: text("skip_context"),
  enteredAt: timestamp("entered_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  workspacePhaseUnique: unique("workflow_phase_runs_workspace_phase_unique").on(t.workspaceId, t.phaseKey),
}))

// ── Agent Tasks (persistent, resumable) ───────────────────
// Tracks autonomous agent work with checkpoint/resume for serverless
// durability. If Vercel times out mid-task, the task can be resumed
// from its checkpoint. Pattern from LangGraph's state persistence.
export const agentTasks = pgTable("agent_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  channelId: uuid("channel_id").references(() => channels.id),
  status: text("status").notNull().default("queued"), // queued, running, completed, failed, interrupted
  prompt: text("prompt").notNull(),
  // Structured context passed through the handoff chain. Each agent
  // adds to it. Downstream agents get everything upstream collected.
  context: jsonb("context").$type<{
    collectedInfo?: Record<string, string>
    documentsCreated?: { id: string; title: string }[]
    decisionseMade?: string[]
    handoffChain?: { fromAgent: string; toAgent: string; summary: string; timestamp: string }[]
    [key: string]: unknown
  }>().notNull().default({}),
  // Serialized state for resume after timeout or interruption.
  checkpoint: jsonb("checkpoint").$type<{
    messagesProcessed?: number
    toolCallsMade?: string[]
    lastStepOutput?: string
    [key: string]: unknown
  }>(),
  result: jsonb("result").$type<Record<string, unknown>>(),
  toolCallsMade: integer("tool_calls_made").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Handoff Events (audit trail for the department chain) ──
// Every handoff between departments is logged so any agent can trace
// the full provenance of a task. Pattern from OpenAI Agents SDK.
export const handoffEvents = pgTable("handoff_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  fromAgentId: uuid("from_agent_id").references(() => agents.id),
  fromAgentName: text("from_agent_name").notNull(),
  toAgentId: uuid("to_agent_id").references(() => agents.id),
  toAgentName: text("to_agent_name").notNull(),
  toDepartment: text("to_department").notNull(),
  summary: text("summary").notNull(),
  nextSteps: text("next_steps").notNull(),
  // Full structured context at the moment of handoff
  context: jsonb("context").$type<Record<string, unknown>>().default({}),
  taskId: uuid("task_id"), // the agent_tasks row that was triggered
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Activity Log ──────────────────────────────────────────
export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id),
  agentName: text("agent_name").notNull(),
  action: text("action").notNull(), // e.g., "completed_task", "sent_message", "updated_knowledge", "created_sop"
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
