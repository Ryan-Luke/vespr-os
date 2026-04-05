import { db } from "@/lib/db"
import { workspaces, teams, agents, trophyEvents, agentBonds } from "@/lib/db/schema"
import { eq, inArray, or, isNull, desc } from "drizzle-orm"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1)
  if (!workspace) return Response.json({ error: "Not found" }, { status: 404 })
  if (!workspace.isPublic) return Response.json({ error: "This trainer profile is private" }, { status: 403 })

  // Get teams and agents in this workspace
  const wsTeams = await db.select().from(teams).where(eq(teams.workspaceId, workspace.id))
  const teamIds = wsTeams.map((t) => t.id)

  const wsAgents = teamIds.length > 0
    ? await db.select().from(agents).where(or(inArray(agents.teamId, teamIds), isNull(agents.teamId)))
    : await db.select().from(agents).where(isNull(agents.teamId))

  // Top trophy events for this workspace (limited for public display)
  const topTrophies = await db.select().from(trophyEvents)
    .where(eq(trophyEvents.workspaceId, workspace.id))
    .orderBy(desc(trophyEvents.createdAt))
    .limit(6)

  // Team bonds where both agents are in this workspace
  const agentIds = new Set(wsAgents.map((a) => a.id))
  const allBonds = await db.select().from(agentBonds).orderBy(desc(agentBonds.outcomeLift))
  const wsBonds = allBonds.filter((b) => agentIds.has(b.agentAId) && agentIds.has(b.agentBId)).slice(0, 5)

  // Aggregate metrics
  const totalTasks = wsAgents.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0)
  const totalXp = wsAgents.reduce((sum, a) => sum + (a.xp ?? 0), 0)
  const avgLevel = wsAgents.length > 0 ? Math.round(wsAgents.reduce((sum, a) => sum + (a.level ?? 1), 0) / wsAgents.length) : 0

  // Public agent cards — strip sensitive fields
  const publicAgents = wsAgents
    .filter((a) => a.teamId) // only team-affiliated agents visible publicly
    .map((a) => ({
      id: a.id,
      name: a.nickname || a.name,
      role: a.role,
      pixelAvatarIndex: a.pixelAvatarIndex,
      archetype: a.archetype,
      tier: a.tier,
      level: a.level,
      tasksCompleted: a.tasksCompleted,
      currentForm: a.currentForm,
      identityStats: a.identityStats,
    }))

  return Response.json({
    workspace: {
      name: workspace.name,
      slug: workspace.slug,
      icon: workspace.icon,
      description: workspace.description,
      publicTagline: workspace.publicTagline,
      website: workspace.website,
      businessType: workspace.businessType,
      industry: workspace.industry,
    },
    stats: {
      agentCount: publicAgents.length,
      totalTasks,
      totalXp,
      avgLevel,
    },
    agents: publicAgents,
    trophies: topTrophies,
    bonds: wsBonds,
  })
}
