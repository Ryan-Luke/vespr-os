import { db } from "@/lib/db"
import { agents, milestones, evolutionEvents, trophyEvents, messages, channels } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { levelFromXp, MILESTONE_DEFINITIONS, XP_REWARDS, isValidXpSource } from "@/lib/gamification"
import { ARCHETYPES, type ArchetypeId } from "@/lib/archetypes"

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

export async function POST(req: Request) {
  const { agentId, xpAmount, reason, revenueAmount } = await req.json() as {
    agentId: string
    xpAmount?: number
    reason: string
    revenueAmount?: number // optional — for deal_closed events
  }

  // Enforce XP allowlist per engagement spec Section 6.3
  if (!isValidXpSource(reason)) {
    return Response.json({
      error: `Invalid XP source: "${reason}". Only outcome-based sources allowed.`,
      allowedSources: Object.keys(XP_REWARDS),
    }, { status: 400 })
  }

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 })

  // Calculate XP (use explicit xpAmount if provided, otherwise default from reward table)
  const defaultXp = XP_REWARDS[reason as keyof typeof XP_REWARDS] ?? 0
  const actualXp = xpAmount ?? defaultXp

  const newXp = (agent.xp ?? 0) + actualXp
  const newLevel = levelFromXp(newXp)
  const leveledUp = newLevel > (agent.level ?? 1)

  // Update outcome stats
  const currentOutcomes = (agent.outcomeStats as Record<string, number>) || {}
  const newOutcomes = { ...currentOutcomes }
  const outcomeMapping = REASON_TO_OUTCOME[reason]
  if (outcomeMapping) {
    newOutcomes[outcomeMapping.key] = (newOutcomes[outcomeMapping.key] ?? 0) + outcomeMapping.amount
  }
  if (revenueAmount && reason.startsWith("deal_closed")) {
    newOutcomes.revenue_sourced = (newOutcomes.revenue_sourced ?? 0) + revenueAmount
  }

  await db.update(agents).set({
    xp: newXp,
    level: newLevel,
    outcomeStats: newOutcomes,
  }).where(eq(agents.id, agentId))

  // Check for milestones
  const existingMilestones = await db.select().from(milestones).where(eq(milestones.agentId, agentId))
  const existingIds = new Set(existingMilestones.map((m) => m.name))

  const stats = {
    tasksCompleted: (agent.tasksCompleted ?? 0) + (reason === "task_shipped" ? 1 : 0),
    xp: newXp,
    level: newLevel,
    streak: 0, // streak removed per spec
  }

  const newMilestones: typeof MILESTONE_DEFINITIONS = []
  for (const def of MILESTONE_DEFINITIONS) {
    if (!existingIds.has(def.name) && def.check(stats)) {
      newMilestones.push(def)
      await db.insert(milestones).values({
        agentId, type: def.type, name: def.name, description: def.description, icon: def.icon,
      })
    }
  }

  // Check for evolution — per engagement spec Section 6
  let evolved = false
  let evolutionData: { fromForm: string; toForm: string; capabilities: string[]; tier: string } | null = null

  if (agent.archetype) {
    const archetypeId = agent.archetype as ArchetypeId
    const archetype = ARCHETYPES[archetypeId]
    if (archetype) {
      // Find highest form the agent qualifies for
      let highestForm = archetype.forms[0]
      for (let i = archetype.forms.length - 1; i >= 0; i--) {
        const form = archetype.forms[i]
        if (form.thresholds.length === 0) { highestForm = form; break }
        // ALL thresholds must be met (AND logic)
        const allMet = form.thresholds.every((t) => (newOutcomes[t.metric as keyof typeof newOutcomes] ?? 0) >= t.value)
        if (allMet) { highestForm = form; break }
      }

      const currentFormName = agent.currentForm || archetype.forms[0].name
      if (highestForm.name !== currentFormName) {
        // Evolution detected!
        evolved = true
        const triggerThreshold = highestForm.thresholds[0]
        const triggerValue = triggerThreshold ? (newOutcomes[triggerThreshold.metric as keyof typeof newOutcomes] ?? 0) : 0

        await db.insert(evolutionEvents).values({
          agentId,
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

        // Add to trophy feed
        await db.insert(trophyEvents).values({
          agentId,
          agentName: agent.name,
          type: "evolution",
          title: `${agent.name} evolved to ${highestForm.name}`,
          description: `Unlocked: ${highestForm.unlockedCapabilities.slice(0, 2).join(", ")}`,
          icon: archetype.icon,
        })

        // Post system message in team-leaders channel
        const [tlChannel] = await db.select().from(channels).where(eq(channels.name, "team-leaders")).limit(1)
        if (tlChannel) {
          await db.insert(messages).values({
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

  return Response.json({
    xp: newXp,
    level: newLevel,
    leveledUp,
    newMilestones: newMilestones.map((m) => ({ name: m.name, icon: m.icon, description: m.description })),
    evolved,
    evolution: evolutionData,
    outcomes: newOutcomes,
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")

  if (agentId) {
    const agentMilestones = await db.select().from(milestones).where(eq(milestones.agentId, agentId))
    return Response.json(agentMilestones)
  }

  const allMilestones = await db.select().from(milestones)
  return Response.json(allMilestones)
}
