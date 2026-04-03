import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
} from "lucide-react"
import { kpis, activityFeed, teams, agents } from "@/lib/mock-data"
import { StatusDot } from "@/components/status-dot"

export default function DashboardPage() {
  const workingAgents = agents.filter((a) => a.status === "working").length
  const errorAgents = agents.filter((a) => a.status === "error").length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your AI workforce at a glance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center gap-1 mt-1">
                {kpi.change > 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                ) : kpi.change < 0 ? (
                  <ArrowDownRight className="h-3 w-3 text-green-500" />
                ) : null}
                <span
                  className={`text-xs ${
                    kpi.change > 0
                      ? "text-green-500"
                      : kpi.change < 0
                      ? "text-green-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {kpi.change !== 0 && `${Math.abs(kpi.change)}%`} {kpi.changeLabel}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Workforce Health */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Workforce Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Working</span>
              <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                {workingAgents} agents
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Idle</span>
              <Badge variant="secondary">
                {agents.filter((a) => a.status === "idle").length} agents
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Paused</span>
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">
                {agents.filter((a) => a.status === "paused").length} agents
              </Badge>
            </div>
            {errorAgents > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Needs Attention</span>
                <Badge variant="destructive">{errorAgents} agents</Badge>
              </div>
            )}

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium">Team Overview</p>
              {teams.map((team) => {
                const teamWorking = team.agents.filter((a) => a.status === "working").length
                const teamError = team.agents.filter((a) => a.status === "error").length
                return (
                  <div key={team.id} className="flex items-center justify-between">
                    <span className="text-sm">
                      {team.icon} {team.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {teamError > 0 && (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {teamWorking}/{team.agents.length} active
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Activity Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityFeed.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : item.status === "error" ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{item.agent}</span>{" "}
                      <span className="text-muted-foreground">{item.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.detail}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sprint Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sprint Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) =>
              team.goals.map((goal) => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {team.icon} {goal.title}
                    </span>
                  </div>
                  <Progress
                    value={Math.min((goal.progress / goal.target) * 100, 100)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {goal.progress} / {goal.target} {goal.unit}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
