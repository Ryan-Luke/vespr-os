"use client"

import { useState, useEffect } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { Flame } from "lucide-react"
import { levelTitle } from "@/lib/gamification"

interface AgentStats {
  id: string; name: string; role: string; pixelAvatarIndex: number
  level: number; xp: number; streak: number; tasksCompleted: number
}

interface Milestone {
  id: string; agentId: string; name: string; icon: string; description: string; unlockedAt: string
}

export function AgentLeaderboard() {
  const [agents, setAgents] = useState<AgentStats[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then((data) => {
      setAgents((data as AgentStats[]).filter((a) => a.level > 0).sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0)))
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  if (!loaded || agents.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-md p-5">
      <p className="section-label mb-3">Leaderboard</p>
      <div className="space-y-1.5">
        {agents.slice(0, 8).map((agent, i) => (
          <div key={agent.id} className="flex items-center gap-2.5 py-1">
            <span className="text-xs font-mono w-4 text-center text-muted-foreground">{i + 1}</span>
            <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded-sm" />
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-medium">{agent.name}</span>
              <span className="text-xs text-muted-foreground ml-1.5">Lv.{agent.level ?? 1}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(agent.streak ?? 0) >= 7 && (
                <span className="text-xs text-amber-500 flex items-center gap-0.5"><Flame className="h-3 w-3" />{agent.streak}</span>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">{(agent.xp ?? 0).toLocaleString()} xp</span>
            </div>
          </div>
        ))}
      </div>
    </div>
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
        ...m, agentName: m.agentId ? agentMap.get(m.agentId)?.name : undefined,
      }))
      setMilestones(enriched.sort((a: any, b: any) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()))
      setAgents(ags as AgentStats[])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const totalTasks = agents.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0)
  const totalXP = agents.reduce((sum, a) => sum + (a.xp ?? 0), 0)

  if (!loaded) return null

  return (
    <div className="bg-card border border-border rounded-md p-5">
      <p className="section-label mb-3">Company Stats</p>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-lg font-semibold tabular-nums">{totalTasks.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Tasks</p>
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums">{totalXP.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total XP</p>
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums">{agents.length}</p>
          <p className="text-xs text-muted-foreground">Agents</p>
        </div>
      </div>

      {milestones.length > 0 && (
        <div>
          <p className="section-label mb-2">Recent Milestones</p>
          <div className="space-y-1.5">
            {milestones.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-[13px]">
                <span className="text-sm">{m.icon}</span>
                <span className="font-medium">{m.name}</span>
                {m.agentName && <span className="text-muted-foreground">· {m.agentName}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
