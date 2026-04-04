import Link from "next/link"
import { PixelAvatar } from "@/components/pixel-avatar"
import { db } from "@/lib/db"
import { teams as teamsTable, agents as agentsTable, teamGoals as goalsTable } from "@/lib/db/schema"
import { Plus, Crown, Flame } from "lucide-react"
import { levelTitle } from "@/lib/gamification"
import { getMood, MOOD_EMOJI } from "@/lib/agent-mood"
import { cn } from "@/lib/utils"
import { Sparkline } from "@/components/sparkline"
import { BulkAgentActions } from "@/components/bulk-agent-actions"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
  const [allTeams, allAgents, allGoals] = await Promise.all([
    db.select().from(teamsTable),
    db.select().from(agentsTable),
    db.select().from(goalsTable),
  ])

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Teams</h1>
        <div className="flex items-center gap-2">
          <BulkAgentActions />
          <Link href="/builder" className="h-7 px-2.5 rounded-md text-xs font-medium bg-primary text-primary-foreground flex items-center gap-1.5 hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Department
          </Link>
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
                {teamAgents.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/teams/${team.id}/agents/${agent.id}`}
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-accent transition-colors"
                  >
                    <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={24} className="rounded-sm shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium">{agent.name}</span>
                        <span className="text-sm">{MOOD_EMOJI[getMood({ streak: agent.streak ?? 0, tasksCompleted: agent.tasksCompleted ?? 0, status: agent.status })]}</span>
                        {agent.isTeamLead && <Crown className="h-3 w-3 text-amber-500" />}
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", agent.status === "working" ? "status-working" : agent.status === "error" ? "status-error" : agent.status === "paused" ? "status-paused" : "status-idle")} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                        {(agent.level ?? 0) > 0 && <span className="text-[10px] font-mono text-muted-foreground/60">Lv.{agent.level}</span>}
                        {(agent.streak ?? 0) >= 3 && <span className="text-[10px] text-orange-400 flex items-center"><Flame className="h-2.5 w-2.5" />{agent.streak}</span>}
                      </div>
                      {agent.currentTask && <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{agent.currentTask}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Sparkline
                        data={(() => {
                          const seed = (agent.tasksCompleted ?? 0) + (agent.pixelAvatarIndex ?? 0)
                          return Array.from({ length: 7 }, (_, i) => Math.max(0, Math.sin(seed + i * 1.5) * 3 + (agent.tasksCompleted ?? 0) / 50 + Math.cos(seed * 0.7 + i) * 2))
                        })()}
                        className="text-muted-foreground"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{agent.tasksCompleted}</span>
                    </div>
                  </Link>
                ))}

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
