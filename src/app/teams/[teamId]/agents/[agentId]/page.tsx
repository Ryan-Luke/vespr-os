import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { StatusDot } from "@/components/status-dot"
import { agents, teams } from "@/lib/mock-data"
import {
  ArrowLeft,
  Brain,
  DollarSign,
  CheckCircle2,
  Pause,
  Play,
  MessageSquare,
  Cpu,
} from "lucide-react"
import Link from "next/link"

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ teamId: string; agentId: string }>
}) {
  const { teamId, agentId } = await params
  const agent = agents.find((a) => a.id === agentId)
  const team = teams.find((t) => t.id === teamId)

  if (!agent || !team) return notFound()

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link
        href="/teams"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Teams
      </Link>

      {/* Agent Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg bg-primary/10 text-primary">
            {agent.avatar}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{agent.name}</h1>
            <StatusDot status={agent.status} showLabel />
          </div>
          <p className="text-muted-foreground">
            {agent.role} &middot; {team.icon} {team.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <MessageSquare className="h-4 w-4 mr-1" />
            Chat
          </Button>
          <Button
            variant="outline"
            size="sm"
          >
            {agent.status === "paused" ? (
              <>
                <Play className="h-4 w-4 mr-1" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Current Task */}
      {agent.currentTask && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Task
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{agent.currentTask}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tasks Completed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{agent.tasksCompleted.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cost This Month</span>
            </div>
            <p className="text-2xl font-bold mt-1">${agent.costThisMonth.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Model</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-base">{agent.model}</p>
            <p className="text-xs text-muted-foreground capitalize">{agent.provider}</p>
          </CardContent>
        </Card>
      </div>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Skills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {agent.skills.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
