/**
 * Context builder for agent dispatch.
 *
 * Assembles a pre-dispatch briefing from retrieved memories, entity
 * knowledge, skills, and reflexions into a structured text block that
 * can be appended to an agent's system prompt.
 *
 * Budget allocation (user-aware mode):
 *   - userMemories: 25%     (memories tagged with current user)
 *   - memories: 20%         (general agent memories)
 *   - entities: 10%         (knowledge graph entities)
 *   - skills: 10%           (proven procedures)
 *   - crossUserInsights: 15% (insights from other users' conversations)
 *   - reflexions: 10%       (self-assessments)
 *   - policies: 10%         (company-wide guidelines)
 *
 * Budget allocation (no user context):
 *   - memories: 30%
 *   - entities: 20%
 *   - skills: 15%
 *   - reflexions: 25%
 *   - policies: 10%
 */

import { db } from "@/lib/db"
import {
  memoryEntries,
  entities,
  entityObservations,
  skills as skillsTable,
} from "@/lib/db/schema"
import { eq, and, desc, or, isNull, sql } from "drizzle-orm"
import { retrieveContext } from "./retriever"
import type {
  ContextBriefing,
  ContextBuilderParams,
  ScoredEntry,
} from "./types"

// ── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_MAX_CHARS = 4000

// Budget percentages — user-aware mode
const BUDGET_WITH_USER = {
  userMemories: 0.25,
  memories: 0.20,
  entities: 0.10,
  skills: 0.10,
  crossUserInsights: 0.15,
  reflexions: 0.10,
  policies: 0.10,
} as const

// Budget percentages — no user context
const BUDGET_NO_USER = {
  memories: 0.30,
  entities: 0.20,
  skills: 0.15,
  reflexions: 0.25,
  policies: 0.10,
} as const

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Truncate text to fit within a character budget. If truncated, appends
 * an ellipsis indicator so the agent knows content was clipped.
 */
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 3) + "..."
}

/**
 * Format scored entries into a readable text block for the system prompt.
 */
function formatMemories(entries: ScoredEntry[], budget: number): string {
  if (entries.length === 0) return ""

  const lines: string[] = []
  let charCount = 0

  for (const { entry, scores } of entries) {
    const line = `- [${entry.entryType}] ${entry.title}: ${entry.content}`
    if (charCount + line.length > budget) {
      // Try to fit a truncated version
      const remaining = budget - charCount
      if (remaining > 50) {
        lines.push(truncate(line, remaining))
      }
      break
    }
    lines.push(line)
    charCount += line.length + 1 // +1 for newline
  }

  return lines.join("\n")
}

// ── Main builder ─────────────────────────────────────────────────────

/**
 * Build a context briefing for an agent, combining memories, entity
 * knowledge, skills, and reflexions within a character budget.
 *
 * When a userId is provided, the briefing includes:
 * - User-specific memories (highest priority)
 * - Cross-user insights (what other users discussed about the same topics)
 * - An "About this person" section summarizing what the agent knows
 *
 * Returns a ContextBriefing with individual sections and the assembled
 * full text ready for system prompt injection.
 */
export async function buildAgentContext(params: ContextBuilderParams): Promise<ContextBriefing> {
  const {
    workspaceId,
    agentId,
    taskPrompt,
    userId,
    userName,
    maxChars = DEFAULT_MAX_CHARS,
  } = params

  const hasUser = !!userId
  const budgetConfig = hasUser ? BUDGET_WITH_USER : BUDGET_NO_USER

  // Calculate per-section budgets
  const budgets = {
    userMemories: Math.floor(maxChars * (hasUser ? BUDGET_WITH_USER.userMemories : 0)),
    memories: Math.floor(maxChars * budgetConfig.memories),
    entities: Math.floor(maxChars * budgetConfig.entities),
    skills: Math.floor(maxChars * budgetConfig.skills),
    crossUserInsights: Math.floor(maxChars * (hasUser ? BUDGET_WITH_USER.crossUserInsights : 0)),
    reflexions: Math.floor(maxChars * budgetConfig.reflexions),
    policies: Math.floor(maxChars * budgetConfig.policies),
  }

  // ── 0. Load user-specific memories (highest priority) ────────────
  let userContextText = ""
  let userMemoriesUsed = 0
  if (userId) {
    try {
      // Get memories tagged with this user
      const userTag = `user:${userId}`
      const userMemories = await db.select().from(memoryEntries)
        .where(and(
          eq(memoryEntries.workspaceId, workspaceId),
          or(
            eq(memoryEntries.agentId, agentId),
            isNull(memoryEntries.agentId),
          ),
          isNull(memoryEntries.supersededBy),
          sql`${memoryEntries.tags}::jsonb @> ${JSON.stringify([userTag])}::jsonb`,
        ))
        .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt))
        .limit(15)

      if (userMemories.length > 0) {
        // Build an "About this person" summary
        const topicsSet = new Set<string>()
        const preferencesSet = new Set<string>()
        const decisionsSet = new Set<string>()
        const actionItemsSet = new Set<string>()

        for (const mem of userMemories) {
          const meta = (mem.metadata ?? {}) as Record<string, unknown>
          const topics = (meta.topics ?? []) as string[]
          const preferences = (meta.preferences ?? []) as string[]
          const decisions = (meta.decisions ?? []) as string[]
          const actionItems = (meta.actionItems ?? []) as string[]
          topics.forEach((t) => topicsSet.add(t))
          preferences.forEach((p) => preferencesSet.add(p))
          decisions.forEach((d) => decisionsSet.add(d))
          actionItems.forEach((a) => actionItemsSet.add(a))
        }

        const aboutLines: string[] = []
        aboutLines.push(`- Name: ${userName ?? "Unknown"}`)
        if (topicsSet.size > 0) {
          aboutLines.push(`- Past topics discussed: ${[...topicsSet].slice(0, 8).join(", ")}`)
        }
        if (preferencesSet.size > 0) {
          aboutLines.push(`- Known preferences: ${[...preferencesSet].slice(0, 5).join("; ")}`)
        }
        if (decisionsSet.size > 0) {
          aboutLines.push(`- Recent decisions: ${[...decisionsSet].slice(0, 5).join("; ")}`)
        }
        if (actionItemsSet.size > 0) {
          aboutLines.push(`- Open action items: ${[...actionItemsSet].slice(0, 5).join("; ")}`)
        }
        aboutLines.push(`- Total past interactions: ${userMemories.length}`)

        // Format recent user memories
        const memLines: string[] = []
        let charCount = 0
        const aboutText = aboutLines.join("\n")
        charCount += aboutText.length + 10

        for (const mem of userMemories) {
          const line = `- [${mem.entryType}] ${mem.title}: ${mem.content.slice(0, 200)}`
          if (charCount + line.length > budgets.userMemories) {
            if (budgets.userMemories - charCount > 50) {
              memLines.push(truncate(line, budgets.userMemories - charCount))
              userMemoriesUsed++
            }
            break
          }
          memLines.push(line)
          charCount += line.length + 1
          userMemoriesUsed++
        }

        userContextText = aboutText
        if (memLines.length > 0) {
          userContextText += `\n\nRecent interactions:\n${memLines.join("\n")}`
        }
      }
    } catch {
      // User memory loading is best-effort
    }
  }

  // ── 1. Retrieve scored memories (general) ────────────────────────
  const retrieval = await retrieveContext({
    workspaceId,
    agentId,
    query: taskPrompt,
    maxEntries: 20,
  })

  const memoriesText = formatMemories(retrieval.entries, budgets.memories)

  // ── 1b. Cross-user insights ──────────────────────────────────────
  let crossUserInsightsText = ""
  let crossUserInsightsUsed = 0
  if (userId && taskPrompt) {
    try {
      // Find memories from OTHER users about similar topics
      // Uses tag-based filtering: entries tagged with user:* but NOT the current user
      const currentUserTag = `user:${userId}`

      // Get recent conversation memories from other users
      const otherUserMemories = await db.select().from(memoryEntries)
        .where(and(
          eq(memoryEntries.workspaceId, workspaceId),
          or(
            eq(memoryEntries.agentId, agentId),
            isNull(memoryEntries.agentId),
          ),
          isNull(memoryEntries.supersededBy),
          // Has a user tag (is a user-interaction memory)
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${memoryEntries.tags}::jsonb) elem WHERE elem LIKE 'user:%')`,
          // But NOT the current user's tag
          sql`NOT (${memoryEntries.tags}::jsonb @> ${JSON.stringify([currentUserTag])}::jsonb)`,
        ))
        .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt))
        .limit(10)

      if (otherUserMemories.length > 0) {
        const crossLines: string[] = []
        let charCount = 0

        for (const mem of otherUserMemories) {
          const meta = (mem.metadata ?? {}) as Record<string, unknown>
          const sourceUser = (meta.userName ?? "team member") as string
          const line = `- ${sourceUser}: ${mem.content.slice(0, 150)}`
          if (charCount + line.length > budgets.crossUserInsights) {
            if (budgets.crossUserInsights - charCount > 50) {
              crossLines.push(truncate(line, budgets.crossUserInsights - charCount))
              crossUserInsightsUsed++
            }
            break
          }
          crossLines.push(line)
          charCount += line.length + 1
          crossUserInsightsUsed++
        }

        crossUserInsightsText = crossLines.join("\n")
      }
    } catch {
      // Cross-user insights are best-effort
    }
  }

  // ── 2. Load relevant entities ────────────────────────────────────
  let entitiesText = ""
  let entitiesUsed = 0
  try {
    // If we have a userId, prioritize the user's entity
    const relevantEntities = await db.select().from(entities)
      .where(eq(entities.workspaceId, workspaceId))
      .orderBy(desc(entities.updatedAt))
      .limit(10)

    if (relevantEntities.length > 0) {
      const entityLines: string[] = []
      let charCount = 0

      for (const entity of relevantEntities) {
        // Load observations for this entity
        const observations = await db.select().from(entityObservations)
          .where(eq(entityObservations.entityId, entity.id))
          .orderBy(desc(entityObservations.importance))
          .limit(3)

        const obsText = observations.map((o) => o.content).join("; ")
        const line = `- [${entity.entityType}] ${entity.name}${entity.summary ? `: ${entity.summary}` : ""}${obsText ? ` | ${obsText}` : ""}`

        if (charCount + line.length > budgets.entities) {
          if (budgets.entities - charCount > 50) {
            entityLines.push(truncate(line, budgets.entities - charCount))
            entitiesUsed++
          }
          break
        }
        entityLines.push(line)
        charCount += line.length + 1
        entitiesUsed++
      }

      entitiesText = entityLines.join("\n")
    }
  } catch {
    // Entity loading is best-effort
  }

  // ── 3. Load skills ──────────────────────────────────────────────
  let skillsText = ""
  let skillsUsed = 0
  try {
    const agentSkills = await db.select().from(skillsTable)
      .where(and(
        eq(skillsTable.workspaceId, workspaceId),
        or(
          eq(skillsTable.agentId, agentId),
          isNull(skillsTable.agentId),
        ),
      ))
      .orderBy(desc(skillsTable.successCount), desc(skillsTable.importance))
      .limit(8)

    if (agentSkills.length > 0) {
      const skillLines: string[] = []
      let charCount = 0

      for (const skill of agentSkills) {
        const successRate = skill.successCount + skill.failureCount > 0
          ? Math.round((skill.successCount / (skill.successCount + skill.failureCount)) * 100)
          : null
        const rateStr = successRate !== null ? ` (${successRate}% success)` : ""
        const line = `- ${skill.name}${rateStr}: ${skill.description}`

        if (charCount + line.length > budgets.skills) {
          if (budgets.skills - charCount > 50) {
            skillLines.push(truncate(line, budgets.skills - charCount))
            skillsUsed++
          }
          break
        }
        skillLines.push(line)
        charCount += line.length + 1
        skillsUsed++
      }

      skillsText = skillLines.join("\n")
    }
  } catch {
    // Skills loading is best-effort
  }

  // ── 4. Load reflexions ──────────────────────────────────────────
  let reflexionsText = ""
  let reflexionsUsed = 0
  try {
    const reflexions = await db.select().from(memoryEntries)
      .where(and(
        eq(memoryEntries.workspaceId, workspaceId),
        or(
          eq(memoryEntries.agentId, agentId),
          isNull(memoryEntries.agentId),
        ),
        eq(memoryEntries.entryType, "reflexion"),
      ))
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt))
      .limit(5)

    if (reflexions.length > 0) {
      const refLines: string[] = []
      let charCount = 0

      for (const ref of reflexions) {
        const line = `- ${ref.title}: ${ref.content}`
        if (charCount + line.length > budgets.reflexions) {
          if (budgets.reflexions - charCount > 50) {
            refLines.push(truncate(line, budgets.reflexions - charCount))
            reflexionsUsed++
          }
          break
        }
        refLines.push(line)
        charCount += line.length + 1
        reflexionsUsed++
      }

      reflexionsText = refLines.join("\n")
    }
  } catch {
    // Reflexions loading is best-effort
  }

  // ── 5. Policies (from company-level insights) ────────────────────
  let policiesText = ""
  try {
    const policyEntries = await db.select().from(memoryEntries)
      .where(and(
        eq(memoryEntries.workspaceId, workspaceId),
        isNull(memoryEntries.agentId),
        eq(memoryEntries.entryType, "insight"),
      ))
      .orderBy(desc(memoryEntries.importance))
      .limit(5)

    if (policyEntries.length > 0) {
      const policyLines: string[] = []
      let charCount = 0

      for (const policy of policyEntries) {
        const line = `- ${policy.title}: ${policy.content}`
        if (charCount + line.length > budgets.policies) break
        policyLines.push(line)
        charCount += line.length + 1
      }

      policiesText = truncate(policyLines.join("\n"), budgets.policies)
    }
  } catch {
    // Policies loading is best-effort
  }

  // ── Assemble the full briefing ───────────────────────────────────
  const sections: string[] = []

  // User context goes first (highest priority)
  if (userContextText) {
    sections.push(`ABOUT THE PERSON YOU'RE TALKING TO:\n${userContextText}`)
  }
  if (memoriesText) {
    sections.push(`MEMORIES (recent observations and learnings):\n${memoriesText}`)
  }
  if (crossUserInsightsText) {
    sections.push(`CROSS-TEAM CONTEXT (what other team members have discussed):\n${crossUserInsightsText}`)
  }
  if (entitiesText) {
    sections.push(`KNOWLEDGE GRAPH (people, companies, tools, projects):\n${entitiesText}`)
  }
  if (skillsText) {
    sections.push(`SKILLS (proven procedures):\n${skillsText}`)
  }
  if (reflexionsText) {
    sections.push(`REFLEXIONS (self-assessments and improvements):\n${reflexionsText}`)
  }
  if (policiesText) {
    sections.push(`POLICIES (company-wide guidelines):\n${policiesText}`)
  }

  const full = sections.length > 0
    ? `\n\nLEARNING CONTEXT:\n${sections.join("\n\n")}`
    : ""

  return {
    memories: memoriesText,
    entities: entitiesText,
    skills: skillsText,
    reflexions: reflexionsText,
    policies: policiesText,
    userContext: userContextText,
    crossUserInsights: crossUserInsightsText,
    full: truncate(full, maxChars),
    stats: {
      memoriesUsed: retrieval.entries.length,
      entitiesUsed,
      skillsUsed,
      reflexionsUsed,
      userMemoriesUsed,
      crossUserInsightsUsed,
      totalChars: full.length,
    },
  }
}
