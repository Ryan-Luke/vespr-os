import { db } from "@/lib/db"
import { agents as agentsTable, teams as teamsTable, tasks as tasksTable, activityLog as activityLogTable } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import {
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock,
  AlertCircle, MessageSquare, BookOpen, FileText, Flag, Activity,
} from "lucide-react"
import { AgentActivityChart, CostByTeamChart, TaskStatusChart } from "@/components/dashboard-charts"
import { MorningCheckin } from "@/components/morning-checkin"
import { OvernightSummary } from "@/components/overnight-summary"
import { ApprovalQueue } from "@/components/approval-queue"
import { AgentLeaderboard, CompanyAchievements } from "@/components/gamification-widgets"
import { PixelAvatar } from "@/components/pixel-avatar"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { CollapsibleSection } from "@/components/collapsible-section"
import { FocusModeToggle } from "@/components/focus-mode-toggle"
import { ActivityTicker } from "@/components/activity-ticker"
import { GoalTracker } from "@/components/goal-tracker"
import { ROICalculator } from "@/components/roi-calculator"
import { WeeklyReportButton } from "@/components/weekly-report"
import { DailyDigestButton } from "@/components/daily-digest"
import { UtilizationHeatmap } from "@/components/utilization-heatmap"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [allAgents, allTeams, allTasks, recentActivity] = await Promise.all([
    db.select().from(agentsTable),
    db.select().from(teamsTable),
    db.select().from(tasksTable),
    db.select().from(activityLogTable).orderBy(desc(activityLogTable.createdAt)).limit(12),
  ])

  const workingAgents = allAgents.filter((a) => a.status === "working").length
  const idleAgents = allAgents.filter((a) => a.status === "idle").length
  const errorAgents = allAgents.filter((a) => a.status === "error").length
  const pausedAgents = allAgents.filter((a) => a.status === "paused").length
  const totalCost = allAgents.reduce((sum, a) => sum + (a.costThisMonth ?? 0), 0)
  const totalTasks = allAgents.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0)

  const costByTeamData = allTeams.map((team) => {
    const ta = allAgents.filter((a) => a.teamId === team.id)
    return { team: team.name, cost: ta.reduce((sum, a) => sum + (a.costThisMonth ?? 0), 0) }
  })

  const taskStatusData = (["backlog", "todo", "in_progress", "review", "done"] as const).map((s) => ({
    status: s, count: allTasks.filter((t) => t.status === s).length,
  }))

  const statusColors = ["text-muted-foreground", "text-blue-400", "text-amber-400", "text-violet-400", "text-emerald-400"]
  const statusLabels: Record<string, string> = { backlog: "Backlog", todo: "To Do", in_progress: "Active", review: "Review", done: "Done" }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-[1400px]">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-muted-foreground">Dashboard</h1>
          <div className="flex items-center gap-2">
            <FocusModeToggle />
            <DailyDigestButton />
            <WeeklyReportButton />
          </div>
        </div>
        <ActivityTicker />
        <MorningCheckin />
        <OvernightSummary />
        <div className="grid gap-3 md:grid-cols-2">
          <GoalTracker />
          <ROICalculator />
        </div>
        <ApprovalQueue />

        {/* ── PRIMARY ZONE: KPIs + Activity ────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr_1fr_minmax(320px,1.2fr)]">
          {/* 4 KPI cells */}
          {[
            { label: "Tasks", value: totalTasks.toLocaleString(), change: 12.5 },
            { label: "Hours Saved", value: Math.round(totalTasks * 0.15).toLocaleString(), change: 18.3 },
            { label: "Agents", value: String(allAgents.length), change: 0, sub: `${workingAgents} active` },
            { label: "Cost", value: `$${totalCost.toFixed(0)}`, change: -8.2 },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-card border border-border rounded-md p-4">
              <p className="section-label">{kpi.label}</p>
              <p className="text-2xl font-semibold tabular-nums mt-2">{kpi.value}</p>
              <div className="flex items-center gap-1 mt-1">
                {kpi.change > 0 && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
                {kpi.change < 0 && <ArrowDownRight className="h-3 w-3 text-emerald-500" />}
                {kpi.change !== 0 && <span className="text-[11px] text-emerald-500 font-medium tabular-nums">{Math.abs(kpi.change)}%</span>}
                {kpi.sub && <span className="text-[11px] text-muted-foreground">{kpi.sub}</span>}
              </div>
            </div>
          ))}

          {/* Workforce health — sits alongside KPIs */}
          <div className="bg-card border border-border rounded-md p-4 row-span-1">
            <p className="section-label mb-3">Workforce</p>
            <div className="space-y-2">
              {[
                { label: "Working", count: workingAgents, dot: "status-working" },
                { label: "Idle", count: idleAgents, dot: "status-idle" },
                { label: "Paused", count: pausedAgents, dot: "status-paused" },
                ...(errorAgents > 0 ? [{ label: "Error", count: errorAgents, dot: "status-error" }] : []),
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <span className="text-xs font-medium tabular-nums">{s.count}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-3 pt-3 space-y-1.5">
              {allTeams.map((team) => {
                const ta = allAgents.filter((a) => a.teamId === team.id)
                const tw = ta.filter((a) => a.status === "working").length
                return (
                  <div key={team.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{team.icon} {team.name}</span>
                    <span className="tabular-nums text-muted-foreground">{tw}/{ta.length}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── SECONDARY ZONE: Charts + Pipeline ────────────── */}
        <div data-dashboard-section="charts" className="grid gap-5 lg:grid-cols-3">
          <div className="bg-card border border-border rounded-md p-4">
            <p className="section-label mb-3">Activity</p>
            <AgentActivityChart />
          </div>
          <div className="bg-card border border-border rounded-md p-4">
            <p className="section-label mb-3">Cost by Team</p>
            <CostByTeamChart data={costByTeamData} />
          </div>
          <div className="bg-card border border-border rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Pipeline</p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {taskStatusData.map((s, i) => (
                <div key={s.status} className="text-center py-2">
                  <p className={cn("text-lg font-semibold tabular-nums", statusColors[i])}>{s.count}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{statusLabels[s.status]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── TEAM HEALTH SCORES ─────────────────────────────── */}
        <div data-dashboard-section="health" className="bg-card border border-border rounded-md p-4">
          <p className="section-label mb-3">Team Health</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-{allTeams.length > 4 ? 4 : allTeams.length}">
            {allTeams.map((team) => {
              const ta = allAgents.filter((a) => a.teamId === team.id)
              const goals = allTasks.filter((t) => t.teamId === team.id)
              const completed = goals.filter((t) => t.status === "done").length
              const total = goals.length || 1
              const completionRate = Math.round((completed / total) * 100)
              const errorCount = ta.filter((a) => a.status === "error").length
              const avgLevel = ta.length > 0 ? Math.round(ta.reduce((sum, a) => sum + (a.level ?? 1), 0) / ta.length) : 0
              // Health score: completion rate, minus error penalty, plus small team-level bonus
              const healthScore = Math.min(100, Math.max(0, completionRate - (errorCount * 15) + Math.min(avgLevel, 20)))
              const healthColor = healthScore >= 70 ? "text-emerald-500" : healthScore >= 40 ? "text-amber-500" : "text-red-500"
              const barColor = healthScore >= 70 ? "bg-emerald-500" : healthScore >= 40 ? "bg-amber-500" : "bg-red-500"
              return (
                <div key={team.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">{team.icon} {team.name}</span>
                    <span className={cn("text-sm font-bold tabular-nums", healthColor)}>{healthScore}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden mb-2">
                    <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${healthScore}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{completionRate}% done</span>
                    <span>{ta.length} agents</span>
                    {errorCount > 0 && <span className="text-red-400">{errorCount} error</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── COST PER AGENT ────────────────────────────────── */}
        {(() => {
          const agentCosts = allAgents
            .filter((a) => (a.costThisMonth ?? 0) > 0)
            .sort((a, b) => (b.costThisMonth ?? 0) - (a.costThisMonth ?? 0))
            .slice(0, 8)
          const maxCost = agentCosts[0]?.costThisMonth ?? 1
          if (agentCosts.length === 0) return null
          return (
            <div className="bg-card border border-border rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Cost by Agent</p>
                <span className="text-xs text-muted-foreground tabular-nums">${totalCost.toFixed(0)} total</span>
              </div>
              <div className="space-y-1.5">
                {agentCosts.map((agent) => {
                  const pct = maxCost > 0 ? ((agent.costThisMonth ?? 0) / maxCost) * 100 : 0
                  return (
                    <div key={agent.id} className="flex items-center gap-2.5">
                      <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={16} className="rounded-sm shrink-0" />
                      <span className="text-xs w-16 truncate">{agent.name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums w-12 text-right">${(agent.costThisMonth ?? 0).toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── UTILIZATION HEATMAP ────────────────────────────── */}
        <CollapsibleSection id="dashboard-utilization" title="Utilization">
          <UtilizationHeatmap agents={allAgents.map((a) => ({
            id: a.id,
            name: a.name,
            pixelAvatarIndex: a.pixelAvatarIndex,
            status: a.status,
            tasksCompleted: a.tasksCompleted ?? 0,
            currentTask: a.currentTask,
          }))} />
        </CollapsibleSection>

        {/* ── AGENT GRID ───────────────────────────────────── */}
        <CollapsibleSection id="dashboard-agents" title="Agent Grid">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {allAgents.map((agent) => {
              const team = allTeams.find((t) => t.id === agent.teamId)
              const statusDot =
                agent.status === "working" ? "status-working"
                : agent.status === "error" ? "status-error"
                : agent.status === "paused" ? "status-paused"
                : "status-idle"

              return (
                <Link
                  key={agent.id}
                  href={`/teams/${agent.teamId}/agents/${agent.id}`}
                  className="bg-card border border-border rounded-md p-3 hover:border-muted-foreground/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded-sm" />
                    <span className="text-xs font-medium truncate">{agent.name}</span>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0 ml-auto", statusDot)} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                    {agent.currentTask || "Idle"}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 truncate">{agent.role}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">Lv.{agent.level}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                      {agent.tasksCompleted} tasks
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </CollapsibleSection>

        {/* ── TERTIARY ZONE: Activity feed + Gamification ──── */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
          {/* Activity feed — takes 1 col */}
          <div className="bg-card border border-border rounded-md p-4">
            <p className="section-label mb-3">Recent Activity</p>
            <div className="space-y-px">
              {recentActivity.slice(0, 8).map((entry) => {
                const icons: Record<string, React.ReactNode> = {
                  completed_task: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
                  sent_message: <MessageSquare className="h-3 w-3 text-blue-500" />,
                  updated_knowledge: <BookOpen className="h-3 w-3 text-violet-500" />,
                  created_sop: <FileText className="h-3 w-3 text-blue-400" />,
                  flagged: <Flag className="h-3 w-3 text-red-500" />,
                }
                const icon = icons[entry.action] ?? <Activity className="h-3 w-3 text-muted-foreground" />
                const diffMs = Date.now() - new Date(entry.createdAt).getTime()
                const diffMin = Math.floor(diffMs / 60000)
                const diffHr = Math.floor(diffMin / 60)
                const t = diffHr > 0 ? `${diffHr}h` : diffMin > 0 ? `${diffMin}m` : "now"

                return (
                  <div key={entry.id} className="flex items-center gap-2 py-1.5 text-xs">
                    <span className="shrink-0 w-3">{icon}</span>
                    <span className="font-medium shrink-0">{entry.agentName}</span>
                    <span className="text-muted-foreground truncate flex-1">{entry.description}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">{t}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <AgentLeaderboard />
          <CompanyAchievements />
        </div>
        <div className="pt-8 pb-4 text-center">
          <p className="text-[10px] text-muted-foreground/30">Cmd+K to search · Cmd+/ for shortcuts</p>
        </div>
      </div>
    </div>
  )
}
