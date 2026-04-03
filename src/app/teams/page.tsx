import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { StatusDot } from "@/components/status-dot"
import { teams } from "@/lib/mock-data"
import { Users, Target } from "lucide-react"

export default function TeamsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground">
          Your AI workforce organized by business function
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-xl">{team.icon}</span>
                  {team.name}
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {team.agents.length} agents
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{team.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Team Members */}
              <div className="space-y-3">
                {team.agents.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/teams/${team.id}/agents/${agent.id}`}
                    className="flex items-center gap-3 rounded-md p-2 -mx-2 hover:bg-accent transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {agent.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{agent.name}</span>
                        <StatusDot status={agent.status} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {agent.role} &middot; {agent.model}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-muted-foreground">
                        {agent.tasksCompleted} tasks
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Team Goals */}
              {team.goals.length > 0 && (
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Target className="h-3.5 w-3.5" />
                    Sprint Goals
                  </div>
                  {team.goals.map((goal) => (
                    <div key={goal.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{goal.title}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {goal.progress}/{goal.target}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(
                          (goal.progress / goal.target) * 100,
                          100
                        )}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
