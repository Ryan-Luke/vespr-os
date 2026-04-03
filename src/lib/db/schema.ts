import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
} from "drizzle-orm/pg-core"

// ── Teams ──────────────────────────────────────────────────
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("⚙️"),
  leadAgentId: uuid("lead_agent_id"), // team lead — references agents but no FK to avoid circular
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
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  costThisMonth: real("cost_this_month").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  teamId: uuid("team_id").references(() => teams.id),
  status: text("status").notNull().default("backlog"), // backlog, todo, in_progress, review, done
  priority: text("priority").notNull().default("medium"), // urgent, high, medium, low
  parentTaskId: uuid("parent_task_id"),
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

// ── Agent Feedback ────────────────────────────────────────
export const agentFeedback = pgTable("agent_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  messageId: uuid("message_id").references(() => messages.id),
  rating: text("rating").notNull(), // "positive" | "negative"
  correction: text("correction"), // optional text correction from the user
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
