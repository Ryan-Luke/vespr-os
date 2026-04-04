import Link from "next/link"
import { PixelAvatar } from "@/components/pixel-avatar"
import { db } from "@/lib/db"
import { teams as teamsTable, agents as agentsTable, teamGoals as goalsTable, milestones as milestonesTable } from "@/lib/db/schema"
import { Plus, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import { BulkAgentActions } from "@/components/bulk-agent-actions"
import { AddDepartmentButton } from "@/components/add-department-button"
import { levelTitle } from "@/lib/gamification"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
  const [allTeams, allAgents, allGoals, allMilestones] = await Promise.all([
    db.select().from(teamsTable),
    db.select().from(agentsTable),
    db.select().from(goalsTable),
    db.select().from(milestonesTable),
  ])

  // Build milestone count per agent
  const milestoneCounts: Record<string, number> = {}
  const topMilestone: Record<string, { icon: string; name: string }> = {}
  for (const m of allMilestones) {
    if (!m.agentId) continue
    milestoneCounts[m.agentId] = (milestoneCounts[m.agentId] || 0) + 1
    // Keep the "highest" milestone (last in insertion order tends to be highest)
    topMilestone[m.agentId] = { icon: m.icon, name: m.name }
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

          return (
            <div key={team.id} className="bg-card border border-border rounded-md">
              {/* Team header */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{team.icon}</span>
                    <span className="text-[13px] font-semibold">{team.name}</span>
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
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-accent transition-colors"
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
                        {(agent.streak ?? 0) >= 7 && (
                          <span className="text-[10px]" title={`${agent.streak}d streak`}>🔥</span>
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
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
