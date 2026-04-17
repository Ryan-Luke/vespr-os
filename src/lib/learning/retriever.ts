/**
 * Tiered memory retriever.
 *
 * Replaces the simple `db.select().from(agentMemories)` pattern with
 * scored, MMR-reranked retrieval across multiple memory tiers:
 *   1. Recent memories (< 7 days) for this agent
 *   2. Weekly/monthly summaries (consolidated entries)
 *   3. Shared/company memories (agentId = null or from companyMemories)
 *   4. Entity observations related to the query
 *
 * During the transition period, reads from BOTH old tables (agentMemories,
 * companyMemories) and new tables (memoryEntries, entityObservations).
 */

import { db } from "@/lib/db"
import {
  memoryEntries,
  agentMemories,
  companyMemories,
  entityObservations,
  entities,
} from "@/lib/db/schema"
import { eq, and, desc, sql, isNull, or, inArray } from "drizzle-orm"
import { scoreEntries, mmrRerank, textRelevance } from "./scoring"
import type {
  MemoryEntry,
  RetrievalParams,
  RetrievalResult,
  ScoredEntry,
  TierName,
} from "./types"

// ── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_MAX_ENTRIES = 20
const RECENT_DAYS = 7
const DEFAULT_TIERS: TierName[] = ["recent", "summary", "shared"]

// ── Legacy adapter ───────────────────────────────────────────────────
// Converts rows from the old agentMemories/companyMemories tables into
// the MemoryEntry shape so the scoring pipeline handles them uniformly.

function legacyAgentMemoryToEntry(
  row: {
    id: string
    workspaceId: string | null
    agentId: string
    memoryType: string
    content: string
    importance: number
    source: string | null
    createdAt: Date
  },
): MemoryEntry {
  return {
    id: row.id,
    workspaceId: row.workspaceId ?? "",
    agentId: row.agentId,
    entryType: "daily",
    title: row.memoryType,
    content: row.content,
    importance: Math.round(row.importance * 5), // old table uses 0-1, new uses 1-5
    tags: [row.memoryType, row.source ?? "unknown"],
    contentHash: null,
    supersededBy: null,
    metadata: {},
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  }
}

function legacyCompanyMemoryToEntry(
  row: {
    id: string
    workspaceId: string | null
    category: string
    title: string
    content: string
    importance: number
    source: string | null
    tags: string[] | null
    createdAt: Date
    updatedAt: Date
  },
): MemoryEntry {
  return {
    id: row.id,
    workspaceId: row.workspaceId ?? "",
    agentId: null, // shared
    entryType: "insight",
    title: row.title,
    content: row.content,
    importance: Math.round(row.importance * 5),
    tags: [...(row.tags ?? []), row.category],
    contentHash: null,
    supersededBy: null,
    metadata: {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// ── Query helpers ────────────────────────────────────────────────────

async function queryRecentEntries(
  workspaceId: string,
  agentId: string,
): Promise<MemoryEntry[]> {
  const cutoff = new Date(Date.now() - RECENT_DAYS * 86_400_000)

  // New table: recent entries for this agent
  const newEntries = await db.select().from(memoryEntries)
    .where(and(
      eq(memoryEntries.workspaceId, workspaceId),
      eq(memoryEntries.agentId, agentId),
      isNull(memoryEntries.supersededBy),
      sql`${memoryEntries.createdAt} >= ${cutoff}`,
    ))
    .orderBy(desc(memoryEntries.createdAt))
    .limit(30)

  // Legacy table: recent agent memories
  const legacyEntries = await db.select().from(agentMemories)
    .where(and(
      eq(agentMemories.agentId, agentId),
      sql`${agentMemories.createdAt} >= ${cutoff}`,
    ))
    .orderBy(desc(agentMemories.createdAt))
    .limit(20)

  return [
    ...(newEntries as MemoryEntry[]),
    ...legacyEntries.map(legacyAgentMemoryToEntry),
  ]
}

async function querySummaryEntries(
  workspaceId: string,
  agentId: string,
): Promise<MemoryEntry[]> {
  // Weekly and monthly consolidation summaries
  const summaries = await db.select().from(memoryEntries)
    .where(and(
      eq(memoryEntries.workspaceId, workspaceId),
      or(
        eq(memoryEntries.agentId, agentId),
        isNull(memoryEntries.agentId),
      ),
      isNull(memoryEntries.supersededBy),
      or(
        eq(memoryEntries.entryType, "weekly"),
        eq(memoryEntries.entryType, "monthly"),
      ),
    ))
    .orderBy(desc(memoryEntries.createdAt))
    .limit(15)

  return summaries as MemoryEntry[]
}

async function querySharedEntries(
  workspaceId: string,
): Promise<MemoryEntry[]> {
  // New table: shared memories (agentId = null)
  const newShared = await db.select().from(memoryEntries)
    .where(and(
      eq(memoryEntries.workspaceId, workspaceId),
      isNull(memoryEntries.agentId),
      isNull(memoryEntries.supersededBy),
    ))
    .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt))
    .limit(15)

  // Legacy company memories
  const legacyShared = await db.select().from(companyMemories)
    .where(eq(companyMemories.workspaceId, workspaceId))
    .orderBy(desc(companyMemories.importance))
    .limit(10)

  return [
    ...(newShared as MemoryEntry[]),
    ...legacyShared.map(legacyCompanyMemoryToEntry),
  ]
}

async function queryEntityObservations(
  workspaceId: string,
  query?: string,
): Promise<MemoryEntry[]> {
  if (!query || query.trim().length === 0) return []

  // Find entities whose name matches any query terms
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
  if (queryTerms.length === 0) return []

  // Use ILIKE for basic text matching on entity names
  const likeConditions = queryTerms.map((term) =>
    sql`LOWER(${entities.name}) LIKE ${"%" + term + "%"}`,
  )

  const matchedEntities = await db.select().from(entities)
    .where(and(
      eq(entities.workspaceId, workspaceId),
      or(...likeConditions),
    ))
    .limit(10)

  if (matchedEntities.length === 0) return []

  const entityIds = matchedEntities.map((e) => e.id)
  const observations = await db.select().from(entityObservations)
    .where(inArray(entityObservations.entityId, entityIds))
    .orderBy(desc(entityObservations.importance), desc(entityObservations.createdAt))
    .limit(15)

  // Convert entity observations to MemoryEntry shape
  return observations.map((obs): MemoryEntry => {
    const entity = matchedEntities.find((e) => e.id === obs.entityId)
    return {
      id: obs.id,
      workspaceId,
      agentId: obs.sourceAgentId,
      entryType: "insight",
      title: `[${entity?.entityType ?? "entity"}] ${entity?.name ?? "Unknown"}`,
      content: obs.content,
      importance: obs.importance,
      tags: ["entity-observation", entity?.entityType ?? "unknown", entity?.name ?? "unknown"],
      contentHash: null,
      supersededBy: null,
      metadata: { entityId: obs.entityId },
      createdAt: obs.createdAt,
      updatedAt: obs.createdAt,
    }
  })
}

// ── Main retriever ───────────────────────────────────────────────────

/**
 * Tiered memory retrieval with scoring and MMR re-ranking.
 *
 * Queries across multiple memory sources, scores each entry using the
 * Park et al. formula with tier-appropriate weights, then re-ranks
 * using MMR for diversity.
 */
export async function retrieveContext(params: RetrievalParams): Promise<RetrievalResult> {
  const {
    workspaceId,
    agentId,
    query,
    maxEntries = DEFAULT_MAX_ENTRIES,
    includeTiers = DEFAULT_TIERS,
  } = params

  const now = new Date()
  const allScored: ScoredEntry[] = []
  const tierBuckets: Record<TierName, ScoredEntry[]> = {
    recent: [],
    summary: [],
    shared: [],
    archive: [],
  }

  // Run tier queries in parallel
  const [recentEntries, summaryEntries, sharedEntries, entityEntries] = await Promise.all([
    includeTiers.includes("recent") ? queryRecentEntries(workspaceId, agentId) : Promise.resolve([]),
    includeTiers.includes("summary") ? querySummaryEntries(workspaceId, agentId) : Promise.resolve([]),
    includeTiers.includes("shared") ? querySharedEntries(workspaceId) : Promise.resolve([]),
    queryEntityObservations(workspaceId, query),
  ])

  // Score each tier
  if (includeTiers.includes("recent")) {
    const scored = scoreEntries(recentEntries, "recent", query, now)
    tierBuckets.recent = scored
    allScored.push(...scored)
  }

  if (includeTiers.includes("summary")) {
    const scored = scoreEntries(summaryEntries, "summary", query, now)
    tierBuckets.summary = scored
    allScored.push(...scored)
  }

  if (includeTiers.includes("shared")) {
    const scored = scoreEntries(sharedEntries, "shared", query, now)
    tierBuckets.shared = scored
    allScored.push(...scored)
  }

  // Entity observations are treated as shared tier for scoring
  if (entityEntries.length > 0) {
    const scored = scoreEntries(entityEntries, "shared", query, now)
    tierBuckets.shared.push(...scored)
    allScored.push(...scored)
  }

  // Sort all entries by composite score
  allScored.sort((a, b) => b.scores.composite - a.scores.composite)

  // MMR re-rank for diversity
  const reranked = mmrRerank(allScored, maxEntries)

  // Re-bucket after MMR
  const finalTiers: Record<TierName, ScoredEntry[]> = {
    recent: [],
    summary: [],
    shared: [],
    archive: [],
  }
  for (const entry of reranked) {
    finalTiers[entry.tier].push(entry)
  }

  return {
    entries: reranked,
    tiers: finalTiers,
    totalConsidered: allScored.length,
  }
}
