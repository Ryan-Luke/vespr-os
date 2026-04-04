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
  const errorAgents = allAgents.filter((a) => a.status === "error").length
  const totalCost = allAgents.reduce((sum, a) => sum + (a.costThisMonth ?? 0), 0)
  const totalTasksCompleted = allAgents.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0)

  const kpis = [
    { label: "Tasks Completed", value: totalTasksCompleted.toLocaleString(), change: 12.5, changeLabel: "vs last month" },
    { label: "Hours Saved", value: Math.round(totalTasksCompleted * 0.15).toLocaleString(), change: 18.3, changeLabel: "vs last month" },
    { label: "Active Agents", value: allAgents.length.toString(), change: 0, changeLabel: "all teams" },
    { label: "Monthly Cost", value: `$${totalCost.toFixed(2)}`, change: -8.2, changeLabel: "vs last month" },
  ]

  // Chart data: cost by team (from DB)
  const costByTeamData = allTeams.map((team) => {
    const teamAgents = allAgents.filter((a) => a.teamId === team.id)
    const cost = teamAgents.reduce((sum, a) => sum + (a.costThisMonth ?? 0), 0)
    return { team: team.name, cost }
  })

  // Chart data: task status distribution (from DB)
  const taskStatusData = (["backlog", "todo", "in_progress", "review", "done"] as const).map((status) => ({
    status,
    count: allTasks.filter((t) => t.status === status).length,
  }))

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <MorningCheckin />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your AI workforce at a glance</p>
      </div>

      <ApprovalQueue />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <Card key={kpi.label} className={i === 0 ? "glow-primary" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${i === 0 ? "gradient-bg-primary" : i === 1 ? "gradient-bg-success" : "bg-muted"}`}>
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight kpi-value">{kpi.value}</div>
              <div className="flex items-center gap-1 mt-1.5">
                {kpi.change > 0 ? <ArrowUpRight className="h-3 w-3 text-green-400" /> : kpi.change < 0 ? <ArrowDownRight className="h-3 w-3 text-green-400" /> : null}
                <span className={`text-xs ${kpi.change !== 0 ? "text-green-400" : "text-muted-foreground"}`}>
                  {kpi.change !== 0 && `${Math.abs(kpi.change)}%`} {kpi.changeLabel}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Agent Activity (Last 7 Days)</CardTitle></CardHeader>
          <CardContent>
            <AgentActivityChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Cost by Team</CardTitle></CardHeader>
          <CardContent>
            <CostByTeamChart data={costByTeamData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Task Status Distribution</CardTitle></CardHeader>
          <CardContent>
            <TaskStatusChart data={taskStatusData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Workforce Health</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Working</span>
              <Badge variant="secondary" className="bg-green-500/10 text-green-500">{workingAgents} agents</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Idle</span>
              <Badge variant="secondary">{allAgents.filter((a) => a.status === "idle").length} agents</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Paused</span>
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">{allAgents.filter((a) => a.status === "paused").length} agents</Badge>
            </div>
            {errorAgents > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Needs Attention</span>
                <Badge variant="destructive">{errorAgents} agents</Badge>
              </div>
            )}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium">Team Overview</p>
              {allTeams.map((team) => {
                const teamAgents = allAgents.filter((a) => a.teamId === team.id)
                const teamWorking = teamAgents.filter((a) => a.status === "working").length
                const teamError = teamAgents.filter((a) => a.status === "error").length
                return (
                  <div key={team.id} className="flex items-center justify-between">
                    <span className="text-sm">{team.icon} {team.name}</span>
                    <div className="flex items-center gap-2">
                      {teamError > 0 && <AlertCircle className="h-3 w-3 text-red-500" />}
                      <span className="text-xs text-muted-foreground">{teamWorking}/{teamAgents.length} active</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Activity Feed</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((entry) => {
                const iconMap: Record<string, React.ReactNode> = {
                  completed_task: <CheckCircle2 className="h-4 w-4 text-green-500" />,
                  sent_message: <MessageSquare className="h-4 w-4 text-blue-500" />,
                  updated_knowledge: <BookOpen className="h-4 w-4 text-purple-500" />,
                  created_sop: <FileText className="h-4 w-4 text-indigo-500" />,
                  flagged: <Flag className="h-4 w-4 text-red-500" />,
                }
                const icon = iconMap[entry.action] ?? <Activity className="h-4 w-4 text-muted-foreground" />

                const now = Date.now()
                const diffMs = now - new Date(entry.createdAt).getTime()
                const diffMin = Math.floor(diffMs / 60000)
                const diffHr = Math.floor(diffMin / 60)
                const timeAgo = diffHr > 0 ? `${diffHr}h ago` : diffMin > 0 ? `${diffMin}m ago` : "just now"

                return (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div className="mt-0.5">{icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm"><span className="font-medium">{entry.agentName}</span></p>
                      <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo}
                    </span>
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

      <Card>
        <CardHeader><CardTitle className="text-base">Task Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {(["backlog", "todo", "in_progress", "review", "done"] as const).map((status) => {
              const c = allTasks.filter((t) => t.status === status).length
              const labels: Record<string, string> = { backlog: "Backlog", todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" }
              return (
                <div key={status} className="text-center">
                  <p className="text-2xl font-bold">{c}</p>
                  <p className="text-xs text-muted-foreground">{labels[status]}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
