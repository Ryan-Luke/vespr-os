import { db } from "@/lib/db"
import { agents as agentsTable, teams as teamsTable, tasks as tasksTable, activityLog as activityLogTable } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { Badge } from "@/components/ui/badge"
import {
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  BookOpen,
  FileText,
  Flag,
  Activity,
} from "lucide-react"
import { AgentActivityChart, CostByTeamChart, TaskStatusChart } from "@/components/dashboard-charts"
import { MorningCheckin } from "@/components/morning-checkin"
import { ApprovalQueue } from "@/components/approval-queue"
import { AgentLeaderboard, CompanyAchievements } from "@/components/gamification-widgets"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [allAgents, allTeams, allTasks, recentActivity] = await Promise.all([
    db.select().from(agentsTable),
    db.select().from(teamsTable),
    db.select().from(tasksTable),
    db.select().from(activityLogTable).orderBy(desc(activityLogTable.createdAt)).limit(10),
  ])

  const workingAgents = allAgents.filter((a) => a.status === "working").length
  const idleAgents = allAgents.filter((a) => a.status === "idle").length
  const errorAgents = allAgents.filter((a) => a.status === "error").length
  const pausedAgents = allAgents.filter((a) => a.status === "paused").length
  const totalCost = allAgents.reduce((sum, a) => sum + (a.costThisMonth ?? 0), 0)
  const totalTasksCompleted = allAgents.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0)
  const hoursSaved = Math.round(totalTasksCompleted * 0.15)

  const costByTeamData = allTeams.map((team) => {
    const teamAgents = allAgents.filter((a) => a.teamId === team.id)
    return { team: team.name, cost: teamAgents.reduce((sum, a) => sum + (a.costThisMonth ?? 0), 0) }
  })

  const taskStatusData = (["backlog", "todo", "in_progress", "review", "done"] as const).map((status) => ({
    status, count: allTasks.filter((t) => t.status === status).length,
  }))

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full">
      <MorningCheckin />

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of your AI workforce</p>
      </div>

      <ApprovalQueue />

      {/* KPIs — clean, typographic, no decoration */}
      <div className="grid gap-px bg-border rounded-lg overflow-hidden md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tasks Completed", value: totalTasksCompleted.toLocaleString(), change: 12.5, sub: "vs last month" },
          { label: "Hours Saved", value: hoursSaved.toLocaleString(), change: 18.3, sub: "vs last month" },
          { label: "Active Agents", value: String(allAgents.length), change: 0, sub: `${workingAgents} currently working` },
          { label: "Monthly Cost", value: `$${totalCost.toFixed(2)}`, change: -8.2, sub: "vs last month" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            <p className="text-2xl font-semibold tracking-tight mt-1.5 tabular-nums">{kpi.value}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {kpi.change > 0 && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />}
              {kpi.change < 0 && <ArrowDownRight className="h-3.5 w-3.5 text-emerald-500" />}
              {kpi.change !== 0 && <span className="text-xs text-emerald-500 font-medium">{Math.abs(kpi.change)}%</span>}
              <span className="text-xs text-muted-foreground">{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {[
          { title: "Agent Activity", content: <AgentActivityChart /> },
          { title: "Cost by Team", content: <CostByTeamChart data={costByTeamData} /> },
          { title: "Task Distribution", content: <TaskStatusChart data={taskStatusData} /> },
        ].map((chart) => (
          <div key={chart.title} className="bg-card border border-border rounded-lg p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">{chart.title}</p>
            {chart.content}
          </div>
        ))}
      </div>

      {/* Workforce + Activity */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Workforce Health */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Workforce</p>
          <div className="space-y-3">
            {[
              { label: "Working", count: workingAgents, dotClass: "status-working" },
              { label: "Idle", count: idleAgents, dotClass: "status-idle" },
              { label: "Paused", count: pausedAgents, dotClass: "status-paused" },
              ...(errorAgents > 0 ? [{ label: "Errors", count: errorAgents, dotClass: "status-error" }] : []),
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2 w-2 rounded-full ${s.dotClass}`} />
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                </div>
                <span className="text-sm font-medium tabular-nums">{s.count}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border mt-4 pt-4 space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By Team</p>
            {allTeams.map((team) => {
              const teamAgents = allAgents.filter((a) => a.teamId === team.id)
              const teamWorking = teamAgents.filter((a) => a.status === "working").length
              return (
                <div key={team.id} className="flex items-center justify-between text-sm">
                  <span>{team.icon} {team.name}</span>
                  <span className="text-muted-foreground tabular-nums">{teamWorking}/{teamAgents.length}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-3 bg-card border border-border rounded-lg p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Activity</p>
          <div className="space-y-0.5">
            {recentActivity.map((entry) => {
              const icons: Record<string, React.ReactNode> = {
                completed_task: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
                sent_message: <MessageSquare className="h-3.5 w-3.5 text-blue-500" />,
                updated_knowledge: <BookOpen className="h-3.5 w-3.5 text-violet-500" />,
                created_sop: <FileText className="h-3.5 w-3.5 text-blue-400" />,
                flagged: <Flag className="h-3.5 w-3.5 text-red-500" />,
              }
              const icon = icons[entry.action] ?? <Activity className="h-3.5 w-3.5 text-muted-foreground" />

              const diffMs = Date.now() - new Date(entry.createdAt).getTime()
              const diffMin = Math.floor(diffMs / 60000)
              const diffHr = Math.floor(diffMin / 60)
              const timeAgo = diffHr > 0 ? `${diffHr}h` : diffMin > 0 ? `${diffMin}m` : "now"

              return (
                <div key={entry.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50 transition-colors">
                  <div className="w-4 flex justify-center shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm"><span className="font-medium">{entry.agentName}</span> <span className="text-muted-foreground truncate">{entry.description}</span></span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{timeAgo}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Gamification */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AgentLeaderboard />
        <CompanyAchievements />
      </div>

      {/* Task Pipeline */}
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Task Pipeline</p>
        <div className="grid gap-4 md:grid-cols-5">
          {(["backlog", "todo", "in_progress", "review", "done"] as const).map((status) => {
            const c = allTasks.filter((t) => t.status === status).length
            const labels: Record<string, string> = { backlog: "Backlog", todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" }
            return (
              <div key={status} className="text-center py-3 rounded-md bg-muted/50">
                <p className="text-xl font-semibold tabular-nums">{c}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{labels[status]}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
