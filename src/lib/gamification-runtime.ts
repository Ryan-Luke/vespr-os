// ── Gamification Runtime ─────────────────────────────────
// Runtime checks for roster unlocks and emergent trait derivation.
// These functions bridge the static definitions in archetypes.ts
// and gamification.ts with actual business data.

import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

// ── Roster Unlock Triggers ────────────────────────────────
// Check business metrics and create roster unlocks when thresholds are met.
// Maps the UNLOCK_LADDER from archetypes.ts to runtime checks.

export async function checkRosterUnlocks(workspaceId: string) {
  const agents = await db.select().from(schema.agents).where(eq(schema.agents.workspaceId, workspaceId))
  const tasks = await db.select().from(schema.tasks).where(eq(schema.tasks.workspaceId, workspaceId))
  const trophies = await db.select().from(schema.trophyEvents).where(eq(schema.trophyEvents.workspaceId, workspaceId))
  const existingUnlocks = await db.select().from(schema.rosterUnlocks).where(eq(schema.rosterUnlocks.workspaceId, workspaceId))

  const completedTasks = tasks.filter(t => t.status === "done").length
  const dealTrophies = trophies.filter(t => t.type === "deal_closed")
  const totalRevenue = dealTrophies.reduce((sum, t) => sum + (t.amount || 0), 0)

  // Unlock triggers aligned with UNLOCK_LADDER in archetypes.ts.
  // Uses verifiable business metrics rather than usage metrics.
  const UNLOCK_TRIGGERS = [
    { archetype: "scout", tier: "common", metric: "first_agent", check: () => agents.length >= 1 },
    { archetype: "operator", tier: "common", metric: "first_task_done", check: () => completedTasks >= 1 },
    { archetype: "writer", tier: "common", metric: "first_document", check: () => true }, // unlocked with template
    { archetype: "closer", tier: "uncommon", metric: "first_deal", check: () => dealTrophies.length >= 1 },
    { archetype: "analyst", tier: "uncommon", metric: "ten_tasks", check: () => completedTasks >= 10 },
    { archetype: "strategist", tier: "rare", metric: "fifty_tasks", check: () => completedTasks >= 50 },
    { archetype: "communicator", tier: "rare", metric: "five_deals", check: () => dealTrophies.length >= 5 },
    { archetype: "builder", tier: "epic", metric: "revenue_10k", check: () => totalRevenue >= 10000 },
  ]

  const newUnlocks = []
  for (const trigger of UNLOCK_TRIGGERS) {
    const alreadyUnlocked = existingUnlocks.some(u => u.archetype === trigger.archetype)
    if (!alreadyUnlocked && trigger.check()) {
      const [unlock] = await db.insert(schema.rosterUnlocks).values({
        workspaceId,
        archetype: trigger.archetype,
        tier: trigger.tier,
        triggerMetric: trigger.metric,
      }).returning()
      newUnlocks.push(unlock)
    }
  }
  return newUnlocks
}

// ── Emergent Trait Derivation ──────────────────────────────
// Derives descriptive traits from an agent's performance data.
// Per engagement spec Section 9: traits are descriptive, never judgmental.

export async function deriveAgentTraits(agentId: string, workspaceId: string) {
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, agentId)).limit(1)
  if (!agent) return []

  const tasks = await db.select().from(schema.tasks)
    .where(and(eq(schema.tasks.assignedAgentId, agentId), eq(schema.tasks.status, "done")))

  const feedback = await db.select().from(schema.agentFeedback)
    .where(eq(schema.agentFeedback.agentId, agentId))

  const positiveFeedback = feedback.filter(f => f.rating === "positive").length
  const totalFeedback = feedback.length

  const newTraits: { trait: string; sourceMetric: string; sourceValue: string }[] = []

  // Derive traits from data
  if (tasks.length >= 10) {
    newTraits.push({ trait: "Reliable executor", sourceMetric: "tasks_completed", sourceValue: `${tasks.length} tasks` })
  }
  if (tasks.length >= 50) {
    newTraits.push({ trait: "High-volume performer", sourceMetric: "tasks_completed", sourceValue: `${tasks.length} tasks` })
  }
  if (totalFeedback >= 5 && positiveFeedback / totalFeedback >= 0.9) {
    newTraits.push({ trait: "Consistently well-received", sourceMetric: "feedback_ratio", sourceValue: `${Math.round(positiveFeedback / totalFeedback * 100)}% positive` })
  }
  if (agent.outcomeStats && (agent.outcomeStats as Record<string, number>).qualified_leads >= 20) {
    newTraits.push({ trait: "Strong lead qualifier", sourceMetric: "qualified_leads", sourceValue: `${(agent.outcomeStats as Record<string, number>).qualified_leads} leads` })
  }
  if (agent.outcomeStats && (agent.outcomeStats as Record<string, number>).deals_closed >= 5) {
    newTraits.push({ trait: "Proven closer", sourceMetric: "deals_closed", sourceValue: `${(agent.outcomeStats as Record<string, number>).deals_closed} deals` })
  }

  // Upsert traits (avoid duplicates)
  for (const t of newTraits) {
    const existing = await db.select().from(schema.agentTraits)
      .where(and(eq(schema.agentTraits.agentId, agentId), eq(schema.agentTraits.trait, t.trait)))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(schema.agentTraits).values({
        workspaceId,
        agentId,
        trait: t.trait,
        sourceMetric: t.sourceMetric,
        sourceValue: t.sourceValue,
      })
    } else {
      await db.update(schema.agentTraits).set({
        sourceValue: t.sourceValue,
        updatedAt: new Date(),
      }).where(eq(schema.agentTraits.id, existing[0].id))
    }
  }

  return newTraits
}
