/**
 * Memory Writer — utility to create memory entries from various sources.
 *
 * Auto-generates SHA-256 content hashes for dedup. Skips if hash
 * already exists in the workspace.
 */

import { db } from "@/lib/db"
import { memoryEntries, companyMemories } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import type { UserInteractionParams } from "./types"

// ── Types ────────────────────────────────────────────────────

export interface DailyEntryParams {
  workspaceId: string
  agentId?: string
  title: string
  content: string
  importance?: number // 1-5, default 3
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface InsightParams {
  workspaceId: string
  agentId?: string
  title: string
  content: string
  importance: number
  type: string // "decision" | "pattern" | "open_thread" | "action_item"
  relatedEntities?: string[]
  tags?: string[]
}

export interface ReflexionParams {
  workspaceId: string
  agentId: string
  title: string
  content: string
  taskId?: string
  outcome: "success" | "failure" | "partial"
  importance?: number
}

// ── SHA-256 Hashing ──────────────────────────────────────────

/**
 * Generate a SHA-256 hex digest from content string.
 * Uses the Web Crypto API (available in Node 18+ and Edge runtimes).
 */
export async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// ── Dedup check ──────────────────────────────────────────────

async function hashExists(workspaceId: string, hash: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: memoryEntries.id })
    .from(memoryEntries)
    .where(
      and(
        eq(memoryEntries.workspaceId, workspaceId),
        eq(memoryEntries.contentHash, hash),
      ),
    )
    .limit(1)
  return !!existing
}

// ── Writers ──────────────────────────────────────────────────

/**
 * Record a daily memory entry from a conversation or task.
 * Returns the created entry or null if deduped.
 */
export async function recordDailyEntry(params: DailyEntryParams) {
  const contentHash = await sha256(params.content)

  if (await hashExists(params.workspaceId, contentHash)) {
    return null // Already recorded
  }

  const [entry] = await db
    .insert(memoryEntries)
    .values({
      workspaceId: params.workspaceId,
      agentId: params.agentId ?? null,
      entryType: "daily",
      title: params.title,
      content: params.content,
      importance: params.importance ?? 3,
      tags: params.tags ?? [],
      contentHash,
      metadata: params.metadata ?? {},
    })
    .returning()

  return entry
}

/**
 * Record an extracted insight (from consolidation or real-time analysis).
 */
export async function recordInsight(params: InsightParams) {
  const contentHash = await sha256(params.content)

  if (await hashExists(params.workspaceId, contentHash)) {
    return null
  }

  const [entry] = await db
    .insert(memoryEntries)
    .values({
      workspaceId: params.workspaceId,
      agentId: params.agentId ?? null,
      entryType: "insight",
      title: params.title,
      content: params.content,
      importance: params.importance,
      tags: [...(params.tags ?? []), params.type],
      contentHash,
      metadata: {
        insightType: params.type,
        relatedEntities: params.relatedEntities ?? [],
      },
    })
    .returning()

  return entry
}

/**
 * Record a self-reflection from task outcome.
 * Agents learn from their own successes and failures.
 */
export async function recordReflexion(params: ReflexionParams) {
  const contentHash = await sha256(params.content)

  if (await hashExists(params.workspaceId, contentHash)) {
    return null
  }

  const [entry] = await db
    .insert(memoryEntries)
    .values({
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      entryType: "reflexion",
      title: params.title,
      content: params.content,
      importance: params.importance ?? 3,
      tags: ["reflexion", params.outcome],
      contentHash,
      metadata: {
        taskId: params.taskId,
        outcome: params.outcome,
      },
    })
    .returning()

  return entry
}

// ── User Interaction Recording ──────────────────────────────

/**
 * Record a structured user interaction memory, tagged with the user's ID.
 * Creates:
 * 1. A user-specific daily memory (tagged with userId)
 * 2. Company memories for any decisions detected (shared across all agents)
 *
 * Returns an object with the created entries.
 */
export async function recordUserInteraction(params: UserInteractionParams) {
  const {
    workspaceId,
    agentId,
    userId,
    userName,
    userMessage,
    agentResponse,
    topics,
    decisions,
    preferences,
    actionItems,
    people,
    numbers,
    dates,
  } = params

  const results: {
    userMemory: typeof memoryEntries.$inferSelect | null
    companyMemories: (typeof companyMemories.$inferSelect)[]
    preferenceMemory: typeof memoryEntries.$inferSelect | null
    actionMemory: typeof memoryEntries.$inferSelect | null
  } = {
    userMemory: null,
    companyMemories: [],
    preferenceMemory: null,
    actionMemory: null,
  }

  // Score importance based on richness of extracted data
  let importance = 2
  if (decisions.length > 0) importance = 4
  else if (preferences.length > 0 || actionItems.length > 0) importance = 3
  else if (numbers.length > 0 || dates.length > 0) importance = 3

  // Build structured content summary
  const contentParts: string[] = [
    `${userName} said: ${userMessage.slice(0, 200)}${userMessage.length > 200 ? "..." : ""}`,
    `Agent responded: ${agentResponse.slice(0, 200)}${agentResponse.length > 200 ? "..." : ""}`,
  ]
  if (topics.length > 0) contentParts.push(`Topics: ${topics.join(", ")}`)
  if (decisions.length > 0) contentParts.push(`Decisions: ${decisions.join("; ")}`)
  if (preferences.length > 0) contentParts.push(`Preferences: ${preferences.join("; ")}`)
  if (actionItems.length > 0) contentParts.push(`Action items: ${actionItems.join("; ")}`)
  if (numbers.length > 0) contentParts.push(`Numbers/metrics: ${numbers.join(", ")}`)
  if (dates.length > 0) contentParts.push(`Dates/deadlines: ${dates.join(", ")}`)
  if (people.length > 0) contentParts.push(`People mentioned: ${people.join(", ")}`)

  const content = contentParts.join("\n")

  // 1. Record user-specific interaction memory
  const contentHash = await sha256(content)
  if (!(await hashExists(workspaceId, contentHash))) {
    const [entry] = await db
      .insert(memoryEntries)
      .values({
        workspaceId,
        agentId,
        entryType: "daily",
        title: `Chat with ${userName}: ${userMessage.slice(0, 60).trim() || "conversation"}`,
        content,
        importance,
        tags: [
          "user-interaction",
          `user:${userId}`,
          `user-name:${userName}`,
          ...topics.slice(0, 5),
          ...people.slice(0, 3),
        ],
        contentHash,
        metadata: {
          userId,
          userName,
          topics,
          decisions,
          preferences,
          actionItems,
          people,
          numbers,
          dates,
          interactionType: "conversation",
        },
      })
      .returning()
    results.userMemory = entry
  }

  // 2. Create company memories for decisions (shared across all agents)
  for (const decision of decisions.slice(0, 3)) {
    const decisionContent = `${userName} decided: ${decision}`
    const decisionHash = await sha256(decisionContent)
    if (!(await hashExists(workspaceId, decisionHash))) {
      try {
        const [companyMem] = await db
          .insert(companyMemories)
          .values({
            workspaceId,
            category: "fact",
            title: `Decision: ${decision.slice(0, 80)}`,
            content: decisionContent,
            importance: 0.9,
            source: "agent",
            sourceAgentId: agentId,
            tags: ["decision", `user:${userId}`, ...topics.slice(0, 3)],
          })
          .returning()
        results.companyMemories.push(companyMem)
      } catch { /* best-effort */ }
    }
  }

  // 3. Record user preferences as a separate high-priority memory
  if (preferences.length > 0) {
    const prefContent = `${userName}'s preferences: ${preferences.join("; ")}`
    const prefHash = await sha256(prefContent)
    if (!(await hashExists(workspaceId, prefHash))) {
      const [prefEntry] = await db
        .insert(memoryEntries)
        .values({
          workspaceId,
          agentId,
          entryType: "insight",
          title: `${userName}'s preferences`,
          content: prefContent,
          importance: 4,
          tags: [
            "user-preference",
            `user:${userId}`,
            `user-name:${userName}`,
            ...topics.slice(0, 3),
          ],
          contentHash: prefHash,
          metadata: {
            userId,
            userName,
            insightType: "preference",
            preferences,
          },
        })
        .returning()
      results.preferenceMemory = prefEntry
    }
  }

  // 4. Record action items as a separate memory
  if (actionItems.length > 0) {
    const actionContent = `Action items from ${userName}: ${actionItems.join("; ")}`
    const actionHash = await sha256(actionContent)
    if (!(await hashExists(workspaceId, actionHash))) {
      const [actionEntry] = await db
        .insert(memoryEntries)
        .values({
          workspaceId,
          agentId,
          entryType: "insight",
          title: `Action items from ${userName}`,
          content: actionContent,
          importance: 4,
          tags: [
            "action-item",
            `user:${userId}`,
            `user-name:${userName}`,
            ...topics.slice(0, 3),
          ],
          contentHash: actionHash,
          metadata: {
            userId,
            userName,
            insightType: "action_item",
            actionItems,
          },
        })
        .returning()
      results.actionMemory = actionEntry
    }
  }

  return results
}
