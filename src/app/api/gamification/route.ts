import { db } from "@/lib/db"
import { agents, milestones } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { levelFromXp, MILESTONE_DEFINITIONS } from "@/lib/gamification"

// Award XP to an agent and check for milestone unlocks
export async function POST(req: Request) {
  const { agentId, xpAmount, reason } = await req.json() as {
    agentId: string
    xpAmount: number
    reason: string
  }

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 })

  const newXp = (agent.xp ?? 0) + xpAmount
  const newLevel = levelFromXp(newXp)
  const leveledUp = newLevel > (agent.level ?? 1)

  await db.update(agents).set({
    xp: newXp,
    level: newLevel,
  }).where(eq(agents.id, agentId))

  // Check for new milestones
  const existingMilestones = await db.select().from(milestones).where(eq(milestones.agentId, agentId))
  const existingIds = new Set(existingMilestones.map((m) => m.name))

  const stats = {
    tasksCompleted: agent.tasksCompleted ?? 0,
    xp: newXp,
    level: newLevel,
    streak: agent.streak ?? 0,
  }

  const newMilestones: typeof MILESTONE_DEFINITIONS = []
  for (const def of MILESTONE_DEFINITIONS) {
    if (!existingIds.has(def.name) && def.check(stats)) {
      newMilestones.push(def)
      await db.insert(milestones).values({
        agentId,
        type: def.type,
        name: def.name,
        description: def.description,
        icon: def.icon,
      })
    }
  }

  return Response.json({
    xp: newXp,
    level: newLevel,
    leveledUp,
    newMilestones: newMilestones.map((m) => ({ name: m.name, icon: m.icon, description: m.description })),
  })
}

// Get milestones for an agent
export async function GET(req: Request) {
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")

  if (agentId) {
    const agentMilestones = await db.select().from(milestones).where(eq(milestones.agentId, agentId))
    return Response.json(agentMilestones)
  }

  // All milestones
  const allMilestones = await db.select().from(milestones)
  return Response.json(allMilestones)
}
