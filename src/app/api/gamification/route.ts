import { db } from "@/lib/db"
import { milestones } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { XP_REWARDS, isValidXpSource } from "@/lib/gamification"
import { withAuth } from "@/lib/auth/with-auth"
import { awardXp } from "@/lib/gamification-core"

export async function POST(req: Request) {
  const auth = await withAuth()
  const { agentId, xpAmount, reason, revenueAmount } = await req.json() as {
    agentId: string
    xpAmount?: number
    reason: string
    revenueAmount?: number
  }

  if (!isValidXpSource(reason)) {
    return Response.json({
      error: `Invalid XP source: "${reason}". Only outcome-based sources allowed.`,
      allowedSources: Object.keys(XP_REWARDS),
    }, { status: 400 })
  }

  const result = await awardXp({
    agentId,
    workspaceId: auth.workspace.id,
    reason,
    xpAmount,
    revenueAmount,
  })

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 })
  }

  return Response.json({
    xp: result.xp,
    level: result.level,
    leveledUp: result.leveledUp,
    newMilestones: result.newMilestones,
    evolved: result.evolved,
    evolution: result.evolution,
    outcomes: result.outcomes,
    rosterUnlocks: result.rosterUnlocks,
    derivedTraits: result.derivedTraits,
  })
}

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")

  if (agentId) {
    const agentMilestones = await db.select().from(milestones).where(eq(milestones.agentId, agentId))
    return Response.json(agentMilestones)
  }

  const allMilestones = await db.select().from(milestones).where(eq(milestones.workspaceId, auth.workspace.id))
  return Response.json(allMilestones)
}
