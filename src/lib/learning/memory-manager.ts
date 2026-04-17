/**
 * Memory Manager — pruning and capacity management.
 *
 * Prevents memory bloat by pruning low-importance, old entries when
 * the total count exceeds a configurable budget. Preserves high-importance
 * entries (importance >= 4) and prioritizes deleting the oldest,
 * lowest-importance entries first.
 */

import { db } from "@/lib/db"
import { memoryEntries } from "@/lib/db/schema"
import { eq, and, lte, isNull, sql, count as drizzleCount } from "drizzle-orm"

// ── Constants ───────────────────────────────────────────────────

const DEFAULT_MAX_ENTRIES = 500

// ── Pruning ─────────────────────────────────────────────────────

/**
 * Prune low-importance, old memories to stay within budget.
 *
 * Strategy:
 * 1. Count total non-superseded entries for this agent+workspace
 * 2. If over budget, calculate how many to delete
 * 3. Delete from importance 1 first, then importance 2, oldest first
 * 4. Never delete importance >= 4 entries
 *
 * Returns the number of entries deleted.
 */
export async function pruneAgentMemories(
  agentId: string,
  workspaceId: string,
  maxEntries = DEFAULT_MAX_ENTRIES,
): Promise<number> {
  // Count total active entries for this agent
  const [result] = await db
    .select({ total: drizzleCount() })
    .from(memoryEntries)
    .where(
      and(
        eq(memoryEntries.agentId, agentId),
        eq(memoryEntries.workspaceId, workspaceId),
        isNull(memoryEntries.supersededBy),
      ),
    )

  const total = result?.total ?? 0
  if (total <= maxEntries) return 0

  const excess = total - maxEntries
  let deleted = 0

  // Phase 1: Delete importance 1 entries (oldest first)
  if (deleted < excess) {
    const toDeletePhase1 = excess - deleted
    const imp1Entries = await db
      .select({ id: memoryEntries.id })
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.agentId, agentId),
          eq(memoryEntries.workspaceId, workspaceId),
          lte(memoryEntries.importance, 1),
          isNull(memoryEntries.supersededBy),
        ),
      )
      .orderBy(memoryEntries.createdAt)
      .limit(toDeletePhase1)

    for (const entry of imp1Entries) {
      await db.delete(memoryEntries).where(eq(memoryEntries.id, entry.id))
      deleted++
    }
  }

  // Phase 2: Delete importance 2 entries (oldest first) if still over budget
  if (deleted < excess) {
    const toDeletePhase2 = excess - deleted
    const imp2Entries = await db
      .select({ id: memoryEntries.id })
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.agentId, agentId),
          eq(memoryEntries.workspaceId, workspaceId),
          eq(memoryEntries.importance, 2),
          isNull(memoryEntries.supersededBy),
        ),
      )
      .orderBy(memoryEntries.createdAt)
      .limit(toDeletePhase2)

    for (const entry of imp2Entries) {
      await db.delete(memoryEntries).where(eq(memoryEntries.id, entry.id))
      deleted++
    }
  }

  // Phase 3: Delete importance 3 entries (oldest first) if still over budget
  if (deleted < excess) {
    const toDeletePhase3 = excess - deleted
    const imp3Entries = await db
      .select({ id: memoryEntries.id })
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.agentId, agentId),
          eq(memoryEntries.workspaceId, workspaceId),
          eq(memoryEntries.importance, 3),
          isNull(memoryEntries.supersededBy),
        ),
      )
      .orderBy(memoryEntries.createdAt)
      .limit(toDeletePhase3)

    for (const entry of imp3Entries) {
      await db.delete(memoryEntries).where(eq(memoryEntries.id, entry.id))
      deleted++
    }
  }

  return deleted
}

/**
 * Prune shared/company memories (agentId = null) for a workspace.
 * Same strategy as agent-level pruning but for workspace-wide entries.
 */
export async function pruneWorkspaceMemories(
  workspaceId: string,
  maxEntries = DEFAULT_MAX_ENTRIES,
): Promise<number> {
  const [result] = await db
    .select({ total: drizzleCount() })
    .from(memoryEntries)
    .where(
      and(
        eq(memoryEntries.workspaceId, workspaceId),
        isNull(memoryEntries.agentId),
        isNull(memoryEntries.supersededBy),
      ),
    )

  const total = result?.total ?? 0
  if (total <= maxEntries) return 0

  const excess = total - maxEntries
  let deleted = 0

  // Delete lowest importance, oldest first (only importance <= 2)
  const entriesToDelete = await db
    .select({ id: memoryEntries.id })
    .from(memoryEntries)
    .where(
      and(
        eq(memoryEntries.workspaceId, workspaceId),
        isNull(memoryEntries.agentId),
        lte(memoryEntries.importance, 2),
        isNull(memoryEntries.supersededBy),
      ),
    )
    .orderBy(memoryEntries.createdAt)
    .limit(excess)

  for (const entry of entriesToDelete) {
    await db.delete(memoryEntries).where(eq(memoryEntries.id, entry.id))
    deleted++
  }

  return deleted
}
