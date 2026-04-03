import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/status-dot"
import { PixelAvatar } from "@/components/pixel-avatar"
import { db } from "@/lib/db"
import { teams as teamsTable, agents as agentsTable } from "@/lib/db/schema"
import { Users, Target, Crown, Plus } from "lucide-react"
import { CreateDepartmentButton } from "./create-department"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
  const [allTeams, allAgents] = await Promise.all([
    db.select().from(teamsTable),
    db.select().from(agentsTable),
  ])

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Your AI workforce organized by business function
          </p>
        </div>
        <CreateDepartmentButton />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {allTeams.map((team) => {
          const teamAgents = allAgents.filter((a) => a.teamId === team.id)
          const lead = team.leadAgentId ? teamAgents.find((a) => a.id === team.leadAgentId) : null
          return (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-xl">{team.icon}</span>
                    {team.name}
                  </CardTitle>
                  <Badge variant="secondary" className="font-mono text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {teamAgents.length} agents
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{team.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {teamAgents.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/teams/${team.id}/agents/${agent.id}`}
                    className="flex items-center gap-3 rounded-md p-2 -mx-2 hover:bg-accent transition-colors"
                  >
                    <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={32} className="rounded-lg border border-border" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{agent.name}</span>
                        <StatusDot status={agent.status as any} />
                        {agent.isTeamLead && <Crown className="h-3 w-3 text-amber-400" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {agent.role} · {agent.model}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-muted-foreground">
                        {agent.tasksCompleted} tasks
                      </p>
                    </div>
                  </Link>
                ))}
                <Link
                  href={`/builder?team=${encodeURIComponent(team.name)}&teamId=${team.id}`}
                  className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border p-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Hire for {team.name}
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
