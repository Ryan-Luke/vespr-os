import { db } from "@/lib/db"
import { agents as agentsTable, teams as teamsTable, tasks as tasksTable, activityLog as activityLogTable } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  BookOpen,
  FileText,
  Flag,
  Activity,
  Users,
  DollarSign,
  Zap,
  Timer,
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

  const kpis = [
    { label: "Tasks Completed", value: totalTasksCompleted.toLocaleString(), change: 12.5, changeLabel: "vs last month", icon: CheckCircle2, gradient: "from-emerald-500 to-green-600", glow: "shadow-emerald-500/20", valueColor: "text-emerald-400" },
    { label: "Hours Saved", value: hoursSaved.toLocaleString(), change: 18.3, changeLabel: "vs last month", icon: Timer, gradient: "from-amber-500 to-orange-500", glow: "shadow-amber-500/20", valueColor: "text-amber-400" },
    { label: "Active Agents", value: allAgents.length.toString(), change: 0, changeLabel: `${workingAgents} working`, icon: Users, gradient: "from-pink-500 to-rose-600", glow: "shadow-pink-500/20", valueColor: "text-pink-400" },
    { label: "Monthly Cost", value: `$${totalCost.toFixed(0)}`, change: -8.2, changeLabel: "vs last month", icon: DollarSign, gradient: "from-red-500 to-rose-600", glow: "shadow-red-500/20", valueColor: "text-red-400" },
  ]

  const costByTeamData = allTeams.map((team) => {
    const teamAgents = allAgents.filter((a) => a.teamId === team.id)
    return { team: team.name, cost: teamAgents.reduce((sum, a) => sum + (a.costThisMonth ?? 0), 0) }
  })

  const taskStatusData = (["backlog", "todo", "in_progress", "review", "done"] as const).map((status) => ({
    status, count: allTasks.filter((t) => t.status === status).length,
  }))

  return (
    <div className="p-6 lg:p-8 space-y-8 overflow-y-auto h-full">
      <MorningCheckin />

      {/* Hero Banner with gradient — like Ofinans top bar */}
      <div className="hero-gradient rounded-2xl p-6 relative">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-white/60 mt-1 text-sm">Your AI workforce at a glance</p>
        </div>
      </div>

      <ApprovalQueue />

      {/* KPI Cards — colored values like Ofinans */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="relative overflow-hidden">
            {/* Subtle gradient glow in top-right */}
            <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${kpi.gradient} opacity-10 blur-2xl`} />
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{kpi.label}</span>
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-lg ${kpi.glow}`}>
                  <kpi.icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className={`text-3xl font-bold tracking-tight ${kpi.valueColor}`} style={{ fontFeatureSettings: '"tnum"' }}>{kpi.value}</div>
              <div className="flex items-center gap-1.5 mt-2">
                {kpi.change > 0 ? (
                  <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 rounded-full px-1.5 py-0.5">
                    <ArrowUpRight className="h-3 w-3" />{kpi.change}%
                  </span>
                ) : kpi.change < 0 ? (
                  <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 rounded-full px-1.5 py-0.5">
                    <ArrowDownRight className="h-3 w-3" />{Math.abs(kpi.change)}%
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">{kpi.changeLabel}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Agent Activity (7 Days)</CardTitle></CardHeader>
          <CardContent><AgentActivityChart /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Cost by Team</CardTitle></CardHeader>
          <CardContent><CostByTeamChart data={costByTeamData} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Task Distribution</CardTitle></CardHeader>
          <CardContent><TaskStatusChart data={taskStatusData} /></CardContent>
        </Card>
      </div>

      {/* Workforce + Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Workforce Health — with visual status dots */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Workforce Health</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Working", count: workingAgents, color: "bg-emerald-400", ring: "ring-emerald-400/20" },
              { label: "Idle", count: idleAgents, color: "bg-blue-400", ring: "ring-blue-400/20" },
              { label: "Paused", count: pausedAgents, color: "bg-amber-400", ring: "ring-amber-400/20" },
              ...(errorAgents > 0 ? [{ label: "Error", count: errorAgents, color: "bg-red-400", ring: "ring-red-400/20" }] : []),
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.color} ring-4 ${s.ring}`} />
                  <span className="text-sm">{s.label}</span>
                </div>
                <span className="text-sm font-mono font-medium">{s.count}</span>
              </div>
            ))}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Teams</p>
              {allTeams.map((team) => {
                const teamAgents = allAgents.filter((a) => a.teamId === team.id)
                const teamWorking = teamAgents.filter((a) => a.status === "working").length
                const teamError = teamAgents.filter((a) => a.status === "error").length
                return (
                  <div key={team.id} className="flex items-center justify-between">
                    <span className="text-sm">{team.icon} {team.name}</span>
                    <div className="flex items-center gap-2">
                      {teamError > 0 && <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                      <span className="text-xs text-muted-foreground font-mono">{teamWorking}/{teamAgents.length}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed — with icons and better layout */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Activity Feed</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentActivity.map((entry) => {
                const iconMap: Record<string, { icon: React.ReactNode; bg: string }> = {
                  completed_task: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />, bg: "bg-emerald-400/10" },
                  sent_message: { icon: <MessageSquare className="h-3.5 w-3.5 text-blue-400" />, bg: "bg-blue-400/10" },
                  updated_knowledge: { icon: <BookOpen className="h-3.5 w-3.5 text-violet-400" />, bg: "bg-violet-400/10" },
                  created_sop: { icon: <FileText className="h-3.5 w-3.5 text-indigo-400" />, bg: "bg-indigo-400/10" },
                  flagged: { icon: <Flag className="h-3.5 w-3.5 text-red-400" />, bg: "bg-red-400/10" },
                }
                const { icon, bg } = iconMap[entry.action] ?? { icon: <Activity className="h-3.5 w-3.5 text-muted-foreground" />, bg: "bg-muted" }

                const diffMs = Date.now() - new Date(entry.createdAt).getTime()
                const diffMin = Math.floor(diffMs / 60000)
                const diffHr = Math.floor(diffMin / 60)
                const timeAgo = diffHr > 0 ? `${diffHr}h` : diffMin > 0 ? `${diffMin}m` : "now"

                return (
                  <div key={entry.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/30 transition-colors">
                    <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm"><span className="font-medium">{entry.agentName}</span> <span className="text-muted-foreground">·</span> <span className="text-muted-foreground text-xs">{timeAgo}</span></p>
                      <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gamification */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AgentLeaderboard />
        <CompanyAchievements />
      </div>

      {/* Task Pipeline */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Task Pipeline</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {(["backlog", "todo", "in_progress", "review", "done"] as const).map((status, i) => {
              const c = allTasks.filter((t) => t.status === status).length
              const labels: Record<string, string> = { backlog: "Backlog", todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" }
              const colors = ["text-muted-foreground", "text-blue-400", "text-amber-400", "text-violet-400", "text-emerald-400"]
              return (
                <div key={status} className="text-center p-3 rounded-xl bg-muted/30">
                  <p className={`text-2xl font-bold ${colors[i]}`}>{c}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{labels[status]}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
