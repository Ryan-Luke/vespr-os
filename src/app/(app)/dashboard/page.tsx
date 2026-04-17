import { db } from "@/lib/db"
import { agents as agentsTable, teams as teamsTable, tasks as tasksTable, activityLog as activityLogTable } from "@/lib/db/schema"
import { desc, eq, inArray, or, isNull } from "drizzle-orm"
import { getActiveWorkspace } from "@/lib/workspace-server"
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
import { WorkflowPhaseWidget } from "@/components/workflow-phase-widget"
import { GettingStarted } from "@/components/getting-started"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const activeWs = await getActiveWorkspace()

  const allTeams = activeWs
    ? await db.select().from(teamsTable).where(eq(teamsTable.workspaceId, activeWs.id))
    : await db.select().from(teamsTable)
  const teamIds = allTeams.map((t) => t.id)

  const [allAgents, allTasks, recentActivity] = await Promise.all([
    teamIds.length > 0
      ? db.select().from(agentsTable).where(or(inArray(agentsTable.teamId, teamIds), isNull(agentsTable.teamId)))
      : db.select().from(agentsTable).where(isNull(agentsTable.teamId)),
    teamIds.length > 0 ? db.select().from(tasksTable).where(inArray(tasksTable.teamId, teamIds)) : db.select().from(tasksTable),
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

  const statusLabels: Record<string, string> = { backlog: "Backlog", todo: "To Do", in_progress: "Active", review: "Review", done: "Done" }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-8 max-w-[1400px]">
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="section-label">Dashboard</h1>
          <div className="flex items-center gap-2">
            <FocusModeToggle />
            <DailyDigestButton />
            <WeeklyReportButton />
          </div>
        </div>

        <GettingStarted />
        <ActivityTicker />

        {/* ── KPI STRIP ───────────────────────────────────── */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {([
            { label: "Tasks Completed", value: totalTasks > 0 ? totalTasks.toLocaleString() : "\u2014", change: null },
            { label: "Hours Saved", value: totalTasks > 0 ? Math.round(totalTasks * 0.15).toLocaleString() : "\u2014", change: null },
            { label: "Active Agents", value: String(allAgents.length), change: null, sub: workingAgents > 0 ? `${workingAgents} working` : undefined },
            { label: "Monthly Spend", value: totalCost > 0 ? `$${totalCost.toFixed(0)}` : "\u2014", change: null },
            { label: "Error Rate", value: errorAgents > 0 ? `${errorAgents}` : "\u2014", change: null },
          ] as { label: string; value: string; change: number | null; sub?: string }[]).map((kpi) => (
            <div key={kpi.label} className="kpi-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500 mb-3">{kpi.label}</p>
              <p className="text-[28px] font-bold tabular-nums leading-none">{kpi.value}</p>
              <div className="flex items-center gap-1.5 mt-2">
                {kpi.change != null && kpi.change > 0 && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
                {kpi.change != null && kpi.change < 0 && <ArrowDownRight className="h-3 w-3 text-red-500" />}
                {kpi.change != null ? (
                  <span className={cn("text-[11px] font-medium tabular-nums", kpi.change >= 0 ? "text-emerald-500" : "text-red-500")}>{Math.abs(kpi.change)}%</span>
                ) : (
                  <span className="text-[11px] text-stone-500 tabular-nums">&mdash;</span>
                )}
                {kpi.sub && <span className="text-[11px] text-stone-500">{kpi.sub}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="divider-glass" />

        {/* ── WORKFLOW PHASE ───────────────────────────────── */}
        <WorkflowPhaseWidget />
        <MorningCheckin />
        <OvernightSummary />

        <div className="grid gap-4 md:grid-cols-2">
          <GoalTracker />
          <ROICalculator />
        </div>
        <ApprovalQueue />

        <div className="divider-glass" />

        {/* ── WORKFORCE HEALTH ─────────────────────────────── */}
        <div>
          <p className="section-label mb-4 mt-8">Workforce</p>
          <div className="glass-card p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: "Working", count: workingAgents, dot: "status-working" },
                { label: "Idle", count: idleAgents, dot: "status-idle" },
                { label: "Paused", count: pausedAgents, dot: "status-paused" },
                ...(errorAgents > 0 ? [{ label: "Error", count: errorAgents, dot: "status-error" }] : []),
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                  <div>
                    <span className="text-[22px] font-bold tabular-nums leading-none">{s.count}</span>
                    <p className="text-[11px] text-stone-500 mt-0.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
            {allTeams.length > 0 && (
              <div className="border-t border-[rgba(255,255,255,0.06)] mt-5 pt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {allTeams.map((team) => {
                  const ta = allAgents.filter((a) => a.teamId === team.id)
                  const tw = ta.filter((a) => a.status === "working").length
                  return (
                    <div key={team.id} className="flex items-center justify-between text-xs px-1">
                      <span className="text-stone-500">{team.icon} {team.name}</span>
                      <span className="tabular-nums text-stone-400 font-medium">{tw}/{ta.length}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── CHARTS ──────────────────────────────────────── */}
        <div>
          <p className="section-label mb-4 mt-8">Analytics</p>
          <div data-dashboard-section="charts" className="grid gap-4 lg:grid-cols-3">
            <div className="glass-card p-5">
              <p className="section-label mb-4">Activity</p>
              <AgentActivityChart />
            </div>
            <div className="glass-card p-5">
              <p className="section-label mb-4">Cost by Team</p>
              <CostByTeamChart data={costByTeamData} />
            </div>
            <div className="glass-card p-5">
              <p className="section-label mb-4">Pipeline</p>
              <div className="grid grid-cols-5 gap-2">
                {taskStatusData.map((s) => (
                  <div key={s.status} className="text-center py-3">
                    <p className="text-[22px] font-bold tabular-nums">{s.count}</p>
                    <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-wider">{statusLabels[s.status]}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── TEAM HEALTH SCORES ─────────────────────────────── */}
        <div>
          <p className="section-label mb-4 mt-8">Team Health</p>
          <div data-dashboard-section="health" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {allTeams.map((team) => {
              const ta = allAgents.filter((a) => a.teamId === team.id)
              const goals = allTasks.filter((t) => t.teamId === team.id)
              const completed = goals.filter((t) => t.status === "done").length
              const total = goals.length || 1
              const completionRate = Math.round((completed / total) * 100)
              const errorCount = ta.filter((a) => a.status === "error").length
              const avgLevel = ta.length > 0 ? Math.round(ta.reduce((sum, a) => sum + (a.level ?? 1), 0) / ta.length) : 0
              const healthScore = Math.min(100, Math.max(0, completionRate - (errorCount * 15) + Math.min(avgLevel, 20)))
              const healthColor = healthScore >= 70 ? "text-teal-500" : healthScore >= 40 ? "text-amber-500" : "text-red-500"
              const barColor = healthScore >= 70 ? "bg-teal-500" : healthScore >= 40 ? "bg-amber-500" : "bg-red-500"
              return (
                <div key={team.id} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium">{team.icon} {team.name}</span>
                    <span className={cn("text-lg font-bold tabular-nums", healthColor)}>{healthScore}</span>
                  </div>
                  <div className="progress-glass h-1 mb-3">
                    <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${healthScore}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-stone-500">
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
            <div>
              <p className="section-label mb-4 mt-8">Cost by Agent</p>
              <div className="glass-card p-5">
                <div className="flex items-center justify-end mb-4">
                  <span className="text-[11px] text-stone-500 tabular-nums">${totalCost.toFixed(0)} total</span>
                </div>
                <div className="space-y-2.5">
                  {agentCosts.map((agent) => {
                    const pct = maxCost > 0 ? ((agent.costThisMonth ?? 0) / maxCost) * 100 : 0
                    return (
                      <div key={agent.id} className="flex items-center gap-3">
                        <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={16} className="rounded-sm shrink-0" />
                        <span className="text-xs w-20 truncate text-stone-300">{agent.name}</span>
                        <div className="progress-glass flex-1 h-1.5">
                          <div className="h-full rounded-full bg-teal-500/60 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-stone-500 tabular-nums w-14 text-right">${(agent.costThisMonth ?? 0).toFixed(2)}</span>
                      </div>
                    )
                  })}
                </div>
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
                  href={agent.teamId ? `/teams/${agent.teamId}/agents/${agent.id}` : `/roster`}
                  className="glass-subtle rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={24} className="rounded-md" />
                    <span className="text-[13px] font-medium truncate">{agent.name}</span>
                    <span className={cn("h-2 w-2 rounded-full shrink-0 ml-auto", statusDot)} />
                  </div>
                  <p className="text-[11px] text-stone-500 mt-2 truncate">
                    {agent.currentTask || "Idle"}
                  </p>
                  <p className="text-[10px] text-stone-600 truncate">{agent.role}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[10px] font-semibold bg-teal-500/10 text-teal-500 px-2 py-0.5 rounded-full">Lv.{agent.level}</span>
                    <span className="text-[10px] text-stone-500 ml-auto tabular-nums">
                      {agent.tasksCompleted} tasks
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </CollapsibleSection>

        <div className="divider-glass" />

        {/* ── ACTIVITY FEED + GAMIFICATION ─────────────────── */}
        <div>
          <p className="section-label mb-4 mt-8">Activity & Leaderboard</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Activity feed */}
            <div className="glass-card p-5">
              <p className="section-label mb-4">Recent Activity</p>
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {recentActivity.slice(0, 8).map((entry) => {
                  const icons: Record<string, React.ReactNode> = {
                    completed_task: <CheckCircle2 className="h-3 w-3 text-teal-500" />,
                    sent_message: <MessageSquare className="h-3 w-3 text-stone-400" />,
                    updated_knowledge: <BookOpen className="h-3 w-3 text-stone-400" />,
                    created_sop: <FileText className="h-3 w-3 text-stone-400" />,
                    flagged: <Flag className="h-3 w-3 text-red-500" />,
                  }
                  const icon = icons[entry.action] ?? <Activity className="h-3 w-3 text-stone-500" />
                  const diffMs = Date.now() - new Date(entry.createdAt).getTime()
                  const diffMin = Math.floor(diffMs / 60000)
                  const diffHr = Math.floor(diffMin / 60)
                  const t = diffHr > 0 ? `${diffHr}h` : diffMin > 0 ? `${diffMin}m` : "now"

                  return (
                    <div key={entry.id} className="flex items-center gap-2.5 py-2.5 text-xs">
                      <span className="shrink-0 w-3">{icon}</span>
                      <span className="font-medium shrink-0 text-stone-300">{entry.agentName}</span>
                      <span className="text-stone-500 truncate flex-1">{entry.description}</span>
                      <span className="text-stone-600 tabular-nums shrink-0">{t}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <AgentLeaderboard />
            <CompanyAchievements />
          </div>
        </div>

        <div className="pt-8 pb-4 text-center">
          <p className="text-[10px] text-stone-700">Cmd+K to search · Cmd+/ for shortcuts</p>
        </div>
      </div>
    </div>
  )
}
