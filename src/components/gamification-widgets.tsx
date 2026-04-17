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
    <div className="bg-[#1a1a2e] border border-[rgba(255,255,255,0.08)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="section-label">Leaderboard</p>
        <span className="text-[11px] text-[rgba(255,255,255,0.35)] tabular-nums">{agents.length} agents</span>
      </div>

      {/* Top agent highlight */}
      {topAgent && (
        <Link href={topAgent.teamId ? `/teams/${topAgent.teamId}/agents/${topAgent.id}` : `/roster`} className="block mb-4 rounded-xl bg-[#635bff]/5 border border-[#635bff]/10 p-3.5 hover:border-[#635bff]/20 transition-colors">
          <div className="flex items-center gap-3">
            <PixelAvatar characterIndex={topAgent.pixelAvatarIndex} size={32} className="rounded-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold">{topAgent.name}</span>
                <span className="text-[10px] font-semibold bg-[#635bff]/10 text-[#635bff] px-2 py-0.5 rounded-full">Lv.{topAgent.level ?? 1}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="bg-[#16213e] rounded-full flex-1 h-1 max-w-[100px]">
                  <div className="h-full rounded-full bg-[#635bff] transition-all" style={{ width: `${levelProgress(topAgent.xp ?? 0)}%` }} />
                </div>
                <span className="text-[11px] text-[#6b7280] tabular-nums">{(topAgent.xp ?? 0).toLocaleString()} XP</span>
              </div>
            </div>
          </div>
        </Link>
      )}

      <div className="divide-y divide-[rgba(255,255,255,0.04)]">
        {agents.slice(1, 8).map((agent, i) => {
          const progress = levelProgress(agent.xp ?? 0)
          return (
            <Link key={agent.id} href={agent.teamId ? `/teams/${agent.teamId}/agents/${agent.id}` : `/roster`} className="flex items-center gap-2.5 py-2.5 hover:bg-[#16213e]/30 transition-colors -mx-1 px-1 rounded-lg">
              <span className="text-[11px] font-mono w-5 text-center text-[rgba(255,255,255,0.35)] tabular-nums">{i + 2}</span>
              <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded-md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium">{agent.name}</span>
                  <span className="text-[10px] font-semibold bg-[#635bff]/10 text-[#635bff] px-1.5 py-0.5 rounded-full">Lv.{agent.level ?? 1}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-[#16213e] rounded-full w-14 h-1">
                  <div className="h-full rounded-full bg-[#635bff] transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[11px] text-[#6b7280] tabular-nums w-12 text-right">{(agent.xp ?? 0).toLocaleString()}</span>
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

  // Milestone progress
  const unlockedIds = new Set(milestones.map((m) => m.id))
  const totalMilestoneDefs = MILESTONE_DEFINITIONS.length
  const unlockedCount = MILESTONE_DEFINITIONS.filter((d) => unlockedIds.has(d.id)).length

  if (!loaded) return null

  return (
    <div className="bg-[#1a1a2e] border border-[rgba(255,255,255,0.08)] rounded-xl p-5">
      <p className="section-label mb-4">Company Stats</p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: "Tasks Shipped", value: totalTasks.toLocaleString() },
          { label: "Total XP", value: totalXP.toLocaleString() },
          { label: "Agents", value: String(agents.length) },
          { label: "Avg Level", value: `Lv.${avgLevel}` },
        ].map((s) => (
          <div key={s.label} className="bg-[#16213e] rounded-lg p-3">
            <p className="text-[11px] text-[#6b7280] uppercase tracking-wider">{s.label}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Milestone progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-[#6b7280] flex items-center gap-1 uppercase tracking-wider"><Trophy className="h-3 w-3" />Milestones</span>
          <span className="text-[#9ca3af] tabular-nums font-medium">{unlockedCount}/{totalMilestoneDefs}</span>
        </div>
        <div className="bg-[#16213e] rounded-full h-1.5">
          <div className="h-full rounded-full bg-[#635bff] transition-all" style={{ width: `${totalMilestoneDefs > 0 ? (unlockedCount / totalMilestoneDefs) * 100 : 0}%` }} />
        </div>
      </div>

      {milestones.length > 0 && (
        <div>
          <p className="section-label mb-2">Recent Unlocks</p>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {milestones.slice(0, 5).map((m) => {
              const diffMs = Date.now() - new Date(m.unlockedAt).getTime()
              const diffHr = Math.floor(diffMs / 3600000)
              const t = diffHr < 24 ? `${diffHr}h` : `${Math.floor(diffHr / 24)}d`
              return (
                <div key={m.id} className="flex items-center gap-2.5 py-2">
                  <span className="text-sm">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium">{m.name}</span>
                    {m.agentName && <span className="text-[11px] text-[#6b7280] ml-1.5">· {m.agentName}</span>}
                  </div>
                  <span className="text-[11px] text-[rgba(255,255,255,0.35)] tabular-nums">{t}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Next milestones to unlock */}
      {unlockedCount < totalMilestoneDefs && (
        <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)]">
          <p className="section-label mb-2">Next Goals</p>
          <div className="space-y-1.5">
            {MILESTONE_DEFINITIONS.filter((d) => !unlockedIds.has(d.id)).slice(0, 3).map((d) => (
              <div key={d.id} className="flex items-center gap-2 py-0.5">
                <span className="text-sm opacity-30">{d.icon}</span>
                <span className="text-[13px] text-[#9ca3af]">{d.name}</span>
                <span className="text-[11px] text-[rgba(255,255,255,0.35)] ml-auto">{d.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
