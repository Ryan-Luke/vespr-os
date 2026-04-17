import Link from "next/link"
import { PixelAvatar } from "@/components/pixel-avatar"
import { db } from "@/lib/db"
import { teams as teamsTable, agents as agentsTable, teamGoals as goalsTable, milestones as milestonesTable, agentBonds as agentBondsTable } from "@/lib/db/schema"
import { eq, inArray, or, isNull } from "drizzle-orm"
import { Plus, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import { BulkAgentActions } from "@/components/bulk-agent-actions"
import { AddDepartmentButton } from "@/components/add-department-button"
import { levelTitle } from "@/lib/gamification"
import { getActiveWorkspace } from "@/lib/workspace-server"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
  const activeWs = await getActiveWorkspace()

  // Filter teams by workspace
  const allTeams = activeWs
    ? await db.select().from(teamsTable).where(eq(teamsTable.workspaceId, activeWs.id))
    : await db.select().from(teamsTable)

  const teamIds = allTeams.map((t) => t.id)

  // Filter agents by teams in this workspace (include unassigned agents like Nova)
  const [allAgents, allGoals, allMilestones, allBonds] = await Promise.all([
    teamIds.length > 0
      ? db.select().from(agentsTable).where(or(inArray(agentsTable.teamId, teamIds), isNull(agentsTable.teamId)))
      : db.select().from(agentsTable).where(isNull(agentsTable.teamId)),
    teamIds.length > 0 ? db.select().from(goalsTable).where(inArray(goalsTable.teamId, teamIds)) : Promise.resolve([]),
    db.select().from(milestonesTable),
    db.select().from(agentBondsTable),
  ])

  // Build milestone count per agent
  const milestoneCounts: Record<string, number> = {}
  const topMilestone: Record<string, { icon: string; name: string }> = {}
  for (const m of allMilestones) {
    if (!m.agentId) continue
    milestoneCounts[m.agentId] = (milestoneCounts[m.agentId] || 0) + 1
    topMilestone[m.agentId] = { icon: m.icon, name: m.name }
  }

  // Compute team chemistry score — average outcome lift of bonds where both agents are in the team
  const teamChemistry: Record<string, { score: number; bondCount: number }> = {}
  for (const team of allTeams) {
    const teamAgentIds = new Set(allAgents.filter((a) => a.teamId === team.id).map((a) => a.id))
    const teamBonds = allBonds.filter((b) => teamAgentIds.has(b.agentAId) && teamAgentIds.has(b.agentBId))
    const avgLift = teamBonds.length > 0
      ? teamBonds.reduce((sum, b) => sum + (b.outcomeLift ?? 0), 0) / teamBonds.length
      : 0
    teamChemistry[team.id] = { score: avgLift, bondCount: teamBonds.length }
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Teams</h1>
        <div className="flex items-center gap-2">
          <BulkAgentActions />
          <AddDepartmentButton />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {allTeams.map((team) => {
          const teamAgents = allAgents.filter((a) => a.teamId === team.id)
          const goals = allGoals.filter((g) => g.teamId === team.id && g.status === "active")

          const chemistry = teamChemistry[team.id]
          return (
            <div key={team.id} className="glass-card border border-border rounded-xl">
              {/* Team header */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{team.icon}</span>
                    <span className="text-[13px] font-semibold">{team.name}</span>
                    {chemistry && chemistry.bondCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5" title={`${chemistry.bondCount} tracked bond${chemistry.bondCount === 1 ? "" : "s"}`}>
                        +{Math.round(chemistry.score * 100)}% chemistry
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{teamAgents.length} {teamAgents.length === 1 ? "agent" : "agents"}</span>
                </div>
                {team.description && <p className="text-xs text-muted-foreground mt-1">{team.description}</p>}
              </div>

              {/* Goals */}
              {goals.length > 0 && (
                <div className="px-4 py-2.5 border-b border-border space-y-2">
                  {goals.map((goal) => {
                    const pct = goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0
                    return (
                      <div key={goal.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{goal.title}</span>
                          <span className="text-muted-foreground tabular-nums">{goal.progress}/{goal.target}</span>
                        </div>
                        <div className="h-1 rounded-full bg-border overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", pct >= 80 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Agent list */}
              <div className="divide-y divide-border">
                {teamAgents.map((agent) => {
                  const mc = milestoneCounts[agent.id] || 0
                  const tm = topMilestone[agent.id]
                  return (
                  <Link
                    key={agent.id}
                    href={`/teams/${team.id}/agents/${agent.id}`}
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/5 transition-colors"
                  >
                    <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={24} className="rounded-sm shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium">{agent.name}</span>
                        {agent.isTeamLead && <Crown className="h-3 w-3 text-muted-foreground/40" />}
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", agent.status === "working" ? "status-working" : agent.status === "error" ? "status-error" : agent.status === "paused" ? "status-paused" : "status-idle")} />
                        {(agent.level ?? 0) > 1 && (
                          <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted/40 rounded px-1 py-px">Lv.{agent.level}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground/50 truncate">{agent.role} · {levelTitle(agent.level ?? 1)}</p>
                        {mc > 0 && tm && (
                          <span className="text-[10px] shrink-0" title={`${mc} milestones — ${tm.name}`}>{tm.icon} {mc}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                  )
                })}

                {/* Hire button */}
                <Link
                  href={`/builder?team=${encodeURIComponent(team.name)}&teamId=${team.id}`}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs btn-glass text-teal-500 hover:text-teal-400 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Hire for {team.name}
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <div className="pt-8 pb-4 text-center">
        <p className="text-[10px] text-muted-foreground/30">Cmd+K to search · Cmd+/ for shortcuts</p>
      </div>
    </div>
  )
}
