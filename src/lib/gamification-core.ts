// Core gamification XP logic extracted from /api/gamification route.
// Can be called directly from cron jobs and other server contexts
// without needing HTTP auth cookies.

import { db } from "@/lib/db"
import { agents, milestones, evolutionEvents, trophyEvents, messages, channels } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { levelFromXp, MILESTONE_DEFINITIONS, XP_REWARDS, isValidXpSource } from "@/lib/gamification"
import { ARCHETYPES, type ArchetypeId } from "@/lib/archetypes"
import { checkRosterUnlocks, deriveAgentTraits } from "@/lib/gamification-runtime"

// Map XP reasons to outcome stat keys they increment
const REASON_TO_OUTCOME: Record<string, { key: string; amount: number }> = {
  qualified_lead: { key: "qualified_leads", amount: 1 },
  meeting_booked: { key: "meetings_booked", amount: 1 },
  deal_closed_small: { key: "deals_closed", amount: 1 },
  deal_closed_medium: { key: "deals_closed", amount: 1 },
  deal_closed_large: { key: "deals_closed", amount: 1 },
  task_shipped: { key: "tasks_shipped", amount: 1 },
  sop_authored: { key: "sops_authored", amount: 1 },
  document_delivered: { key: "documents_delivered", amount: 1 },
}

export interface AwardXpInput {
  agentId: string
  workspaceId: string
  reason: string
  xpAmount?: number
  revenueAmount?: number
}

export interface AwardXpResult {
  ok: boolean
  error?: string
  xp?: number
  level?: number
  leveledUp?: boolean
  newMilestones?: { name: string; icon: string; description: string }[]
  evolved?: boolean
  evolution?: { fromForm: string; toForm: string; capabilities: string[]; tier: string } | null
  outcomes?: Record<string, number>
  rosterUnlocks?: unknown[]
  derivedTraits?: unknown[]
}

/**
 * Award XP to an agent and process milestones/evolution.
 * This is the same logic as POST /api/gamification but callable
 * directly without HTTP auth.
 */
export async function awardXp(input: AwardXpInput): Promise<AwardXpResult> {
  const { agentId, workspaceId, reason, xpAmount, revenueAmount } = input

  if (!isValidXpSource(reason)) {
    return { ok: false, error: `Invalid XP source: "${reason}"` }
  }

  const [agent] = await db.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId))).limit(1)
  if (!agent) return { ok: false, error: "Agent not found" }

  const defaultXp = XP_REWARDS[reason as keyof typeof XP_REWARDS] ?? 0
  const actualXp = xpAmount ?? defaultXp

  const newXp = (agent.xp ?? 0) + actualXp
  const newLevel = levelFromXp(newXp)
  const leveledUp = newLevel > (agent.level ?? 1)

  const currentOutcomes = (agent.outcomeStats as Record<string, number>) || {}
  const newOutcomes = { ...currentOutcomes }
  const outcomeMapping = REASON_TO_OUTCOME[reason]
  if (outcomeMapping) {
    newOutcomes[outcomeMapping.key] = (newOutcomes[outcomeMapping.key] ?? 0) + outcomeMapping.amount
  }
  if (revenueAmount && reason.startsWith("deal_closed")) {
    newOutcomes.revenue_sourced = (newOutcomes.revenue_sourced ?? 0) + revenueAmount
  }

  const updatedTasksCompleted = (agent.tasksCompleted ?? 0) + (reason === "task_shipped" ? 1 : 0)

  await db.update(agents).set({
    xp: newXp,
    level: newLevel,
    outcomeStats: newOutcomes,
    tasksCompleted: updatedTasksCompleted,
  }).where(eq(agents.id, agentId))

  // Check for milestones
  const existingMilestones = await db.select().from(milestones).where(eq(milestones.agentId, agentId))
  const existingIds = new Set(existingMilestones.map((m) => m.name))

  const stats = {
    tasksCompleted: updatedTasksCompleted,
    xp: newXp,
    level: newLevel,
    streak: 0,
  }

  const newMilestones: typeof MILESTONE_DEFINITIONS = []
  for (const def of MILESTONE_DEFINITIONS) {
    if (!existingIds.has(def.name) && def.check(stats)) {
      newMilestones.push(def)
      await db.insert(milestones).values({
        agentId, workspaceId, type: def.type, name: def.name, description: def.description, icon: def.icon,
      })
      await db.insert(trophyEvents).values({
        agentId,
        workspaceId,
        agentName: agent.name,
        type: "milestone",
        title: `${agent.name} earned milestone: ${def.name}`,
        description: def.description,
        icon: def.icon,
      })
    }
  }

  // Check for evolution
  let evolved = false
  let evolutionData: { fromForm: string; toForm: string; capabilities: string[]; tier: string } | null = null

  if (agent.archetype) {
    const archetypeId = agent.archetype as ArchetypeId
    const archetype = ARCHETYPES[archetypeId]
    if (archetype) {
      let highestForm = archetype.forms[0]
      for (let i = archetype.forms.length - 1; i >= 0; i--) {
        const form = archetype.forms[i]
        if (form.thresholds.length === 0) { highestForm = form; break }
        const allMet = form.thresholds.every((t) => (newOutcomes[t.metric as keyof typeof newOutcomes] ?? 0) >= t.value)
        if (allMet) { highestForm = form; break }
      }

      const currentFormName = agent.currentForm || archetype.forms[0].name
      if (highestForm.name !== currentFormName) {
        evolved = true
        const triggerThreshold = highestForm.thresholds[0]
        const triggerValue = triggerThreshold ? (newOutcomes[triggerThreshold.metric as keyof typeof newOutcomes] ?? 0) : 0

        await db.insert(evolutionEvents).values({
          agentId,
          workspaceId,
          fromForm: currentFormName,
          toForm: highestForm.name,
          triggerMetric: triggerThreshold?.metric || "unknown",
          triggerValue,
          unlockedCapabilities: highestForm.unlockedCapabilities,
        })

        await db.update(agents).set({
          tier: highestForm.tier,
          currentForm: highestForm.name,
          evolvedFromForm: currentFormName,
        }).where(eq(agents.id, agentId))

        evolutionData = {
          fromForm: currentFormName,
          toForm: highestForm.name,
          capabilities: highestForm.unlockedCapabilities,
          tier: highestForm.tier,
        }

        await db.insert(trophyEvents).values({
          agentId,
          workspaceId,
          agentName: agent.name,
          type: "evolution",
          title: `${agent.name} evolved to ${highestForm.name}`,
          description: `Unlocked: ${highestForm.unlockedCapabilities.slice(0, 2).join(", ")}`,
          icon: archetype.icon,
        })

        const [tlChannel] = await db.select().from(channels).where(eq(channels.name, "team-leaders")).limit(1)
        if (tlChannel) {
          await db.insert(messages).values({
            workspaceId,
            channelId: tlChannel.id,
            senderName: "System",
            senderAvatar: "🏆",
            content: `🏆 **${agent.name}** evolved to **${highestForm.name}** (${highestForm.tier}) after crossing ${triggerValue} ${triggerThreshold?.metric.replace(/_/g, " ")}.\n\n*New capabilities: ${highestForm.unlockedCapabilities.join(", ")}*`,
            messageType: "status",
          })
        }
      }
    }
  }

  let rosterUnlocks: Awaited<ReturnType<typeof checkRosterUnlocks>> = []
  let derivedTraits: Awaited<ReturnType<typeof deriveAgentTraits>> = []
  try {
    rosterUnlocks = await checkRosterUnlocks(workspaceId)
  } catch (e) {
    console.error("Roster unlock check failed:", e)
  }
  try {
    derivedTraits = await deriveAgentTraits(agentId, workspaceId)
  } catch (e) {
    console.error("Trait derivation failed:", e)
  }

  return {
    ok: true,
    xp: newXp,
    level: newLevel,
    leveledUp,
    newMilestones: newMilestones.map((m) => ({ name: m.name, icon: m.icon, description: m.description })),
    evolved,
    evolution: evolutionData,
    outcomes: newOutcomes,
    rosterUnlocks,
    derivedTraits,
  }
}
