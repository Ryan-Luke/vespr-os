/**
 * Learning module types.
 *
 * Core data types for the enhanced memory system: scored retrieval,
 * tiered weighting, knowledge graph entities, Voyager-style skills,
 * and context briefings assembled for agent dispatch.
 */

// ── Memory Entry ─────────────────────────────────────────────────────

export type EntryType = "daily" | "weekly" | "monthly" | "skill" | "reflexion" | "insight"

export interface MemoryEntry {
  id: string
  workspaceId: string
  agentId: string | null
  entryType: EntryType
  title: string
  content: string
  importance: number // 1-5
  tags: string[]
  contentHash: string | null
  supersededBy: string | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

// ── Knowledge Graph ──────────────────────────────────────────────────

export type EntityType = "person" | "company" | "project" | "tool" | "concept" | "agent"

export interface Entity {
  id: string
  workspaceId: string
  name: string
  entityType: EntityType
  aliases: string[]
  summary: string | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export type ObservationSource = "conversation" | "task" | "consolidation"

export interface EntityObservation {
  id: string
  entityId: string
  content: string
  source: ObservationSource
  sourceAgentId: string | null
  importance: number // 1-5
  createdAt: Date
}

export type RelationType = "works_with" | "manages" | "uses" | "part_of" | "related_to"

export interface EntityRelation {
  id: string
  workspaceId: string
  fromEntityId: string
  toEntityId: string
  relationType: RelationType
  context: string | null
  strength: number // 0-1
  createdAt: Date
  updatedAt: Date
}

// ── Skills (Voyager-style) ───────────────────────────────────────────

export interface Skill {
  id: string
  workspaceId: string
  agentId: string | null
  name: string
  description: string
  pattern: string
  triggerConditions: string[]
  successCount: number
  failureCount: number
  lastUsedAt: Date | null
  importance: number // 1-5
  createdAt: Date
  updatedAt: Date
}

// ── Scoring & Retrieval ──────────────────────────────────────────────

export interface TierWeights {
  recency: number
  importance: number
  relevance: number
}

export type TierName = "recent" | "summary" | "shared" | "archive"

export interface ScoredEntry {
  entry: MemoryEntry
  scores: {
    recency: number
    importance: number
    relevance: number
    composite: number
  }
  tier: TierName
}

export interface RetrievalResult {
  entries: ScoredEntry[]
  tiers: Record<TierName, ScoredEntry[]>
  totalConsidered: number
}

// ── Retriever params ─────────────────────────────────────────────────

export interface RetrievalParams {
  workspaceId: string
  agentId: string
  query?: string
  maxEntries?: number
  includeTiers?: TierName[]
}

// ── Context Builder ──────────────────────────────────────────────────

export interface ContextBriefing {
  memories: string
  entities: string
  skills: string
  reflexions: string
  policies: string
  userContext: string     // about the person the agent is talking to
  crossUserInsights: string // insights from other users' conversations
  full: string // assembled briefing text
  stats: {
    memoriesUsed: number
    entitiesUsed: number
    skillsUsed: number
    reflexionsUsed: number
    userMemoriesUsed: number
    crossUserInsightsUsed: number
    totalChars: number
  }
}

export interface ContextBuilderParams {
  workspaceId: string
  agentId: string
  taskPrompt?: string
  userId?: string        // who is the agent talking to?
  userName?: string      // user's display name
  maxChars?: number
}

// ── User Interaction Memory ─────────────────────────────────────────

export interface UserInteractionParams {
  workspaceId: string
  agentId: string
  userId: string
  userName: string
  userMessage: string
  agentResponse: string
  topics: string[]       // extracted from conversation
  decisions: string[]    // any decisions made
  preferences: string[]  // user preferences expressed
  actionItems: string[]  // things to follow up on
  people: string[]       // people mentioned
  numbers: string[]      // metrics/amounts mentioned
  dates: string[]        // deadlines/dates mentioned
}

export interface ConversationExtraction {
  topics: string[]
  decisions: string[]
  preferences: string[]
  actionItems: string[]
  people: string[]
  numbers: string[]
  dates: string[]
}
