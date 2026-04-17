"use client"

import { useState, useEffect } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { Trophy, TrendingUp, Star } from "lucide-react"
import { levelProgress, MILESTONE_DEFINITIONS } from "@/lib/gamification"

import { cn } from "@/lib/utils"
import Link from "next/link"

interface AgentStats {
  id: string; name: string; role: string; pixelAvatarIndex: number; teamId: string | null
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

  const topAgent = agents[0]

  return (
    <div className="bg-card border border-border rounded-md p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Leaderboard</p>
        <span className="text-[11px] text-muted-foreground">{agents.length} agents</span>
      </div>

      {/* Top agent highlight */}
      {topAgent && (
        <Link href={topAgent.teamId ? `/teams/${topAgent.teamId}/agents/${topAgent.id}` : `/roster`} className="block mb-3 rounded-md bg-accent/40 border border-border p-3 hover:bg-accent/60 transition-colors">
          <div className="flex items-center gap-2.5">
            <PixelAvatar characterIndex={topAgent.pixelAvatarIndex} size={28} className="rounded-sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold">{topAgent.name}</span>
                <span className="text-[11px] text-muted-foreground/50">Lv.{topAgent.level ?? 1}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden max-w-[80px]">
                  <div className="h-full rounded-full bg-foreground/20 transition-all" style={{ width: `${levelProgress(topAgent.xp ?? 0)}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground/50 tabular-nums">{(topAgent.xp ?? 0).toLocaleString()} XP</span>
              </div>
            </div>
          </div>
        </Link>
      )}

      <div className="space-y-0.5">
        {agents.slice(1, 8).map((agent, i) => {
          const progress = levelProgress(agent.xp ?? 0)
          return (
            <Link key={agent.id} href={agent.teamId ? `/teams/${agent.teamId}/agents/${agent.id}` : `/roster`} className="flex items-center gap-2.5 py-1.5 rounded-md px-1 -mx-1 hover:bg-accent/40 transition-colors">
              <span className="text-xs font-mono w-4 text-center text-muted-foreground">{i + 2}</span>
              <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded-sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium">{agent.name}</span>
                  <span className="text-[11px] text-muted-foreground/50">Lv.{agent.level ?? 1}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-12 h-1 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-foreground/15 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground/50 tabular-nums w-12 text-right">{(agent.xp ?? 0).toLocaleString()}</span>
              </div>
            </Link>
          )
        })}
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
  const avgLevel = agents.length > 0 ? Math.round(agents.reduce((sum, a) => sum + (a.level ?? 1), 0) / agents.length) : 0

  // Milestone progress — how many of the 11 milestones are unlocked globally
  const unlockedIds = new Set(milestones.map((m) => m.id))
  const totalMilestoneDefs = MILESTONE_DEFINITIONS.length
  const unlockedCount = MILESTONE_DEFINITIONS.filter((d) => unlockedIds.has(d.id)).length

  if (!loaded) return null

  return (
    <div className="bg-card border border-border rounded-md p-5">
      <p className="section-label mb-3">Company Stats</p>

      <div className="grid grid-cols-2 gap-px bg-border rounded-md overflow-hidden mb-4">
        {[
          { label: "Tasks Shipped", value: totalTasks.toLocaleString(), icon: <Star className="h-3 w-3 text-muted-foreground/40" /> },
          { label: "Total XP", value: totalXP.toLocaleString(), icon: <TrendingUp className="h-3 w-3 text-muted-foreground/40" /> },
          { label: "Agents", value: String(agents.length), icon: null },
          { label: "Avg Level", value: `Lv.${avgLevel}`, icon: null },
        ].map((s) => (
          <div key={s.label} className="bg-card p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">{s.icon}{s.label}</p>
            <p className="text-lg font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Milestone progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-muted-foreground/50 flex items-center gap-1"><Trophy className="h-3 w-3" />Milestones</span>
          <span className="text-muted-foreground tabular-nums">{unlockedCount}/{totalMilestoneDefs}</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div className="h-full rounded-full bg-foreground/15 transition-all" style={{ width: `${totalMilestoneDefs > 0 ? (unlockedCount / totalMilestoneDefs) * 100 : 0}%` }} />
        </div>
      </div>

      {milestones.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Recent Unlocks</p>
          <div className="space-y-1">
            {milestones.slice(0, 5).map((m) => {
              const diffMs = Date.now() - new Date(m.unlockedAt).getTime()
              const diffHr = Math.floor(diffMs / 3600000)
              const t = diffHr < 24 ? `${diffHr}h` : `${Math.floor(diffHr / 24)}d`
              return (
                <div key={m.id} className="flex items-center gap-2 py-1">
                  <span className="text-sm">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium">{m.name}</span>
                    {m.agentName && <span className="text-xs text-muted-foreground ml-1.5">· {m.agentName}</span>}
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{t}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Next milestones to unlock */}
      {unlockedCount < totalMilestoneDefs && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Next Goals</p>
          <div className="space-y-1">
            {MILESTONE_DEFINITIONS.filter((d) => !unlockedIds.has(d.id)).slice(0, 3).map((d) => (
              <div key={d.id} className="flex items-center gap-2 py-0.5">
                <span className="text-sm opacity-30">{d.icon}</span>
                <span className="text-[13px] text-muted-foreground">{d.name}</span>
                <span className="text-[11px] text-muted-foreground/50 ml-auto">{d.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
