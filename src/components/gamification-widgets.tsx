"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PixelAvatar } from "@/components/pixel-avatar"
import { Trophy, Flame, Star, TrendingUp } from "lucide-react"
import { levelTitle } from "@/lib/gamification"

interface AgentStats {
  id: string
  name: string
  role: string
  pixelAvatarIndex: number
  level: number
  xp: number
  streak: number
  tasksCompleted: number
}

interface Milestone {
  id: string
  agentId: string
  name: string
  icon: string
  description: string
  unlockedAt: string
}

export function AgentLeaderboard() {
  const [agents, setAgents] = useState<AgentStats[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then((data) => {
      const sorted = (data as AgentStats[])
        .filter((a) => a.level > 0)
        .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))
      setAgents(sorted)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  if (!loaded || agents.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Agent Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {agents.slice(0, 8).map((agent, i) => (
            <div key={agent.id} className="flex items-center gap-3">
              <span className="text-sm font-mono w-5 text-center text-muted-foreground">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
              </span>
              <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={24} className="rounded border border-border" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{agent.name}</span>
                  <Badge variant="secondary" className="text-xs h-5 font-mono px-1.5">Lv.{agent.level ?? 1}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{agent.role}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-mono">{(agent.xp ?? 0).toLocaleString()} XP</p>
                {(agent.streak ?? 0) >= 3 && (
                  <p className="text-xs text-orange-500 flex items-center gap-0.5 justify-end">
                    <Flame className="h-3 w-3" />{agent.streak}d
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function CompanyAchievements() {
  const [milestones, setMilestones] = useState<(Milestone & { agentName?: string })[]>([])
  const [agents, setAgents] = useState<AgentStats[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/gamification").then((r) => r.json()),
      fetch("/api/agents").then((r) => r.json()),
    ]).then(([ms, ags]) => {
      const agentMap = new Map((ags as AgentStats[]).map((a) => [a.id, a]))
      const enriched = (Array.isArray(ms) ? ms : []).map((m: Milestone) => ({
        ...m,
        agentName: m.agentId ? agentMap.get(m.agentId)?.name : undefined,
      }))
      setMilestones(enriched.sort((a: any, b: any) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()))
      setAgents(ags as AgentStats[])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // Compute company-level stats for "company achievements"
  const totalTasks = agents.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0)
  const totalXP = agents.reduce((sum, a) => sum + (a.xp ?? 0), 0)
  const avgLevel = agents.length > 0 ? (agents.reduce((sum, a) => sum + (a.level ?? 1), 0) / agents.length).toFixed(1) : "0"

  if (!loaded) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Company Achievements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{totalTasks.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Tasks</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{totalXP.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total XP</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{avgLevel}</p>
            <p className="text-xs text-muted-foreground">Avg Level</p>
          </div>
        </div>

        {/* Recent milestones */}
        {milestones.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Recent Milestones</p>
            {milestones.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <span>{m.icon}</span>
                <span className="font-medium">{m.name}</span>
                {m.agentName && <span className="text-muted-foreground text-xs">— {m.agentName}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <Star className="h-6 w-6 mx-auto mb-1 opacity-30" />
            <p className="text-xs">Milestones unlock as your team works</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
