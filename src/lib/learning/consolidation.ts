/**
 * Consolidation Pipeline — 6-phase weekly memory consolidation.
 *
 * Runs as a cron job each Sunday. For each workspace:
 *   Phase A - Scan:     Gather daily entries + legacy agent memories from past 7 days
 *   Phase B - Extract:  Use LLM to extract insights, patterns, decisions
 *   Phase C - Compress: Generate weekly summary, save as weekly entry
 *   Phase D - Decay:    Apply Ebbinghaus decay to daily entries
 *   Phase E - Entities: Process extracted entities — upsert + observations + relations
 *   Phase F - Skills:   Extract reusable skills from completed tasks
 */

import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { db } from "@/lib/db"
import {
  memoryEntries,
  agentMemories,
  entities,
  entityObservations,
  entityRelations,
  tasks,
} from "@/lib/db/schema"
import { eq, and, gte, sql, isNull } from "drizzle-orm"
import { extractEntitiesWithLLM, type ExtractedEntity } from "./entity-extractor"
import { extractSkillFromTask } from "./skill-library"
import { sha256 } from "./memory-writer"

// ── Types ────────────────────────────────────────────────────

interface ConsolidationResult {
  phasesCompleted: string[]
  insightsExtracted: number
  entitiesProcessed: number
  skillsExtracted: number
  dailiesDecayed: number
  weeklySummaryId: string | null
  errors: string[]
}

interface LLMInsight {
  title: string
  content: string
  importance: number
  type: string
  relatedEntities: string[]
}

// ── Main Entry Point ─────────────────────────────────────────

/**
 * Run the full 6-phase consolidation pipeline for a workspace.
 */
export async function runConsolidation(
  workspaceId: string,
  apiKey: string,
): Promise<ConsolidationResult> {
  const result: ConsolidationResult = {
    phasesCompleted: [],
    insightsExtracted: 0,
    entitiesProcessed: 0,
    skillsExtracted: 0,
    dailiesDecayed: 0,
    weeklySummaryId: null,
    errors: [],
  }

  try {
    // ── Phase A: Scan ──────────────────────────────────────
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const dailyEntries = await db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.workspaceId, workspaceId),
          eq(memoryEntries.entryType, "daily"),
          gte(memoryEntries.createdAt, sevenDaysAgo),
          isNull(memoryEntries.supersededBy),
        ),
      )

    const legacyMemories = await db
      .select()
      .from(agentMemories)
      .where(gte(agentMemories.createdAt, sevenDaysAgo))

    // Filter legacy memories to workspace if possible
    const workspaceMemories = legacyMemories.filter(
      (m) => !m.workspaceId || m.workspaceId === workspaceId,
    )

    result.phasesCompleted.push("A-scan")

    // If nothing to consolidate, exit early
    if (dailyEntries.length === 0 && workspaceMemories.length === 0) {
      return result
    }

    // Build combined text for LLM analysis
    const combinedText = [
      ...dailyEntries.map((e) => `[${e.createdAt.toISOString().slice(0, 10)}] ${e.title}: ${e.content}`),
      ...workspaceMemories.map((m) => `[${m.createdAt.toISOString().slice(0, 10)}] [legacy:${m.memoryType}] ${m.content}`),
    ].join("\n\n")

    // ── Phase B: Extract Insights ───────────────────────────
    let insights: LLMInsight[] = []
    let extractedEntities: ExtractedEntity[] = []

    try {
      const anthropic = createAnthropic({ apiKey })

      const { text: insightResponse } = await generateText({
        model: anthropic("claude-haiku-4-5"),
        maxOutputTokens: 4096,
        system: `You are analyzing a week of agent activity logs for a business workspace.
Extract the most important insights, decisions, and patterns.
For each insight, assign an importance level 1-5:
  5 = Critical business decision or breakthrough
  4 = Important pattern or strategic insight
  3 = Useful observation worth remembering
  2 = Minor detail, may be relevant later
  1 = Trivial, can be forgotten

Return as JSON: { insights: [{ title, content, importance, type, relatedEntities }] }
Where type is one of: "decision", "pattern", "open_thread", "action_item", "observation"
And relatedEntities is an array of entity names mentioned in the insight.`,
        prompt: `Analyze this week's activity logs and extract insights:\n\n${combinedText.slice(0, 12000)}`,
      })

      try {
        const jsonMatch = insightResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          insights = (parsed.insights || []) as LLMInsight[]
        }
      } catch {
        result.errors.push("Failed to parse LLM insight response")
      }

      // Save insights as memory entries
      for (const insight of insights) {
        try {
          const contentHash = await sha256(insight.content)
          await db.insert(memoryEntries).values({
            workspaceId,
            entryType: "insight",
            title: insight.title,
            content: insight.content,
            importance: Math.max(1, Math.min(5, insight.importance)),
            tags: [insight.type, ...(insight.relatedEntities || [])],
            contentHash,
            metadata: {
              insightType: insight.type,
              relatedEntities: insight.relatedEntities || [],
              consolidatedFrom: dailyEntries.length + workspaceMemories.length,
            },
          })
          result.insightsExtracted++
        } catch {
          // Dedup collision or DB error — skip
        }
      }

      // Extract entities with LLM
      extractedEntities = await extractEntitiesWithLLM(combinedText.slice(0, 8000), apiKey)

      result.phasesCompleted.push("B-extract")
    } catch (e) {
      result.errors.push(`Phase B error: ${e instanceof Error ? e.message : "unknown"}`)
    }

    // ── Phase C: Compress (Weekly Summary) ──────────────────
    try {
      const anthropic = createAnthropic({ apiKey })

      const insightsSummary = insights.length > 0
        ? insights.map((i) => `- [${i.type}] ${i.title}: ${i.content}`).join("\n")
        : "No specific insights extracted."

      const { text: weeklySummary } = await generateText({
        model: anthropic("claude-haiku-4-5"),
        maxOutputTokens: 1024,
        system: `You are creating a concise weekly summary for a business workspace. Summarize the key events, decisions, and patterns from the past week. Be factual and specific. 3-5 paragraphs max.`,
        prompt: `Create a weekly summary from these insights and activity logs:\n\nInsights:\n${insightsSummary}\n\nRaw entries (${dailyEntries.length} daily, ${workspaceMemories.length} legacy):\n${combinedText.slice(0, 4000)}`,
      })

      const summaryHash = await sha256(weeklySummary)
      const weekLabel = `Week of ${sevenDaysAgo.toISOString().slice(0, 10)}`

      const [weeklyEntry] = await db
        .insert(memoryEntries)
        .values({
          workspaceId,
          entryType: "weekly",
          title: weekLabel,
          content: weeklySummary,
          importance: 4,
          tags: ["weekly-summary"],
          contentHash: summaryHash,
          metadata: {
            periodStart: sevenDaysAgo.toISOString(),
            periodEnd: new Date().toISOString(),
            entriesConsolidated: dailyEntries.length + workspaceMemories.length,
            insightsCount: insights.length,
          },
        })
        .returning()

      result.weeklySummaryId = weeklyEntry.id

      result.phasesCompleted.push("C-compress")
    } catch (e) {
      result.errors.push(`Phase C error: ${e instanceof Error ? e.message : "unknown"}`)
    }

    // ── Phase D: Decay ──────────────────────────────────────
    try {
      for (const entry of dailyEntries) {
        if (entry.importance <= 1) {
          // importance 1: mark superseded immediately
          await db
            .update(memoryEntries)
            .set({
              supersededBy: result.weeklySummaryId,
              updatedAt: new Date(),
            })
            .where(eq(memoryEntries.id, entry.id))
          result.dailiesDecayed++
        } else if (entry.importance === 2) {
          // importance 2: decay to 1 (will be cleaned next cycle)
          await db
            .update(memoryEntries)
            .set({
              importance: 1,
              updatedAt: new Date(),
            })
            .where(eq(memoryEntries.id, entry.id))
          result.dailiesDecayed++
        } else {
          // importance 3+: preserve, mark as consolidated
          await db
            .update(memoryEntries)
            .set({
              tags: [...(entry.tags || []), "consolidated"],
              updatedAt: new Date(),
            })
            .where(eq(memoryEntries.id, entry.id))
        }
      }

      result.phasesCompleted.push("D-decay")
    } catch (e) {
      result.errors.push(`Phase D error: ${e instanceof Error ? e.message : "unknown"}`)
    }

    // ── Phase E: Entity Updates ─────────────────────────────
    try {
      // Combine LLM-extracted entities with entities from insights
      const allEntities: ExtractedEntity[] = [...extractedEntities]

      // Add entities referenced in insights
      for (const insight of insights) {
        for (const entityName of insight.relatedEntities || []) {
          if (!allEntities.find((e) => e.name.toLowerCase() === entityName.toLowerCase())) {
            allEntities.push({
              name: entityName,
              entityType: "concept",
              observations: [insight.content.slice(0, 200)],
              relations: [],
            })
          }
        }
      }

      for (const extracted of allEntities) {
        try {
          // Upsert entity
          const [existing] = await db
            .select()
            .from(entities)
            .where(
              and(
                eq(entities.workspaceId, workspaceId),
                sql`LOWER(${entities.name}) = LOWER(${extracted.name})`,
              ),
            )
            .limit(1)

          let entityId: string

          if (existing) {
            entityId = existing.id
            // Update timestamp
            await db
              .update(entities)
              .set({ updatedAt: new Date() })
              .where(eq(entities.id, entityId))
          } else {
            const validTypes = ["person", "company", "project", "tool", "concept", "agent"] as const
            const entityType = validTypes.includes(extracted.entityType as any)
              ? extracted.entityType
              : "concept"

            const [created] = await db
              .insert(entities)
              .values({
                workspaceId,
                name: extracted.name,
                entityType: entityType as string,
              })
              .returning()
            entityId = created.id
          }

          // Add observations
          for (const obs of extracted.observations || []) {
            await db.insert(entityObservations).values({
              entityId,
              content: obs.slice(0, 500),
              source: "consolidation",
              importance: 3,
            })
          }

          // Create/update relations
          for (const rel of extracted.relations || []) {
            // Find or create target entity
            const [targetEntity] = await db
              .select()
              .from(entities)
              .where(
                and(
                  eq(entities.workspaceId, workspaceId),
                  sql`LOWER(${entities.name}) = LOWER(${rel.targetName})`,
                ),
              )
              .limit(1)

            if (targetEntity) {
              // Check if relation already exists
              const [existingRel] = await db
                .select()
                .from(entityRelations)
                .where(
                  and(
                    eq(entityRelations.fromEntityId, entityId),
                    eq(entityRelations.toEntityId, targetEntity.id),
                    eq(entityRelations.relationType, rel.relationType),
                  ),
                )
                .limit(1)

              if (!existingRel) {
                await db.insert(entityRelations).values({
                  workspaceId,
                  fromEntityId: entityId,
                  toEntityId: targetEntity.id,
                  relationType: rel.relationType,
                  strength: 0.5,
                })
              } else {
                // Strengthen existing relation
                await db
                  .update(entityRelations)
                  .set({
                    strength: Math.min(1, (existingRel.strength ?? 0.5) + 0.1),
                    updatedAt: new Date(),
                  })
                  .where(eq(entityRelations.id, existingRel.id))
              }
            }
          }

          result.entitiesProcessed++
        } catch {
          // Individual entity processing failure — continue
        }
      }

      result.phasesCompleted.push("E-entities")
    } catch (e) {
      result.errors.push(`Phase E error: ${e instanceof Error ? e.message : "unknown"}`)
    }

    // ── Phase F: Skill Extraction ───────────────────────────
    try {
      const completedTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.workspaceId, workspaceId),
            eq(tasks.status, "done"),
            gte(tasks.completedAt, sevenDaysAgo),
          ),
        )

      for (const task of completedTasks) {
        if (!task.assignedAgentId || task.assignedToUser) continue

        try {
          const skillResult = await extractSkillFromTask(
            {
              id: task.id,
              title: task.title,
              description: task.description,
              instructions: task.instructions,
              result: task.result as Record<string, unknown> | null,
            },
            task.assignedAgentId,
            workspaceId,
          )
          if (skillResult) result.skillsExtracted++
        } catch {
          // Individual skill extraction failure — continue
        }
      }

      result.phasesCompleted.push("F-skills")
    } catch (e) {
      result.errors.push(`Phase F error: ${e instanceof Error ? e.message : "unknown"}`)
    }
  } catch (e) {
    result.errors.push(`Consolidation error: ${e instanceof Error ? e.message : "unknown"}`)
  }

  return result
}
