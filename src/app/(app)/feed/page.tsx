"use client"

import { useState, useEffect } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { Trophy, TrendingUp, Zap, Star, DollarSign, Calendar, Loader2, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TrophyEvent {
  id: string
  workspaceId: string | null
  agentId: string | null
  agentName: string | null
  type: string
  title: string
  description: string | null
  icon: string | null
  amount: number | null
  createdAt: string
}

interface DBAgent {
  id: string
  name: string
  pixelAvatarIndex: number
  tier: string
}

const TYPE_STYLES: Record<string, { icon: typeof Trophy; color: string; label: string }> = {
  deal_closed: { icon: DollarSign, color: "text-[#635bff]", label: "Deal Closed" },
  meeting_booked: { icon: Calendar, color: "text-[#635bff]", label: "Meeting Booked" },
  milestone: { icon: Trophy, color: "text-amber-500", label: "Milestone" },
  evolution: { icon: TrendingUp, color: "text-[#635bff]", label: "Evolution" },
  first: { icon: Star, color: "text-amber-500", label: "First" },
  capability_unlocked: { icon: Zap, color: "text-[#635bff]", label: "New Capability" },
}

function groupByTimePeriod(events: TrophyEvent[]): { label: string; events: TrophyEvent[] }[] {
  const now = Date.now()
  const today: TrophyEvent[] = []
  const week: TrophyEvent[] = []
  const older: TrophyEvent[] = []

  for (const e of events) {
    const age = now - new Date(e.createdAt).getTime()
    if (age < 24 * 3600000) today.push(e)
    else if (age < 7 * 24 * 3600000) week.push(e)
    else older.push(e)
  }

  const groups: { label: string; events: TrophyEvent[] }[] = []
  if (today.length > 0) groups.push({ label: "While you were away", events: today })
  if (week.length > 0) groups.push({ label: "This week", events: week })
  if (older.length > 0) groups.push({ label: "Earlier", events: older })
  return groups
}

function formatTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  return `${days}d ago`
}

export default function TrophyFeedPage() {
  const [events, setEvents] = useState<TrophyEvent[]>([])
  const [agents, setAgents] = useState<DBAgent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const wsId = typeof window !== "undefined" ? localStorage.getItem("vespr-active-workspace") : null
      const [eventsRes, chatData] = await Promise.all([
        fetch(wsId ? `/api/trophy-events?workspaceId=${wsId}` : "/api/trophy-events").then((r) => r.json()),
        fetch(wsId ? `/api/chat-data?workspaceId=${wsId}` : "/api/chat-data").then((r) => r.json()),
      ])
      const eventsList = eventsRes.events ?? (Array.isArray(eventsRes) ? eventsRes : [])
      setEvents(eventsList)
      setAgents(chatData.agents || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[rgba(255,255,255,0.45)]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading your wins...
      </div>
    )
  }

  const groups = groupByTimePeriod(events)
  const totalWins = events.length
  const totalRevenue = events.reduce((sum, e) => sum + (e.amount ?? 0), 0)
  const dealsCount = events.filter((e) => e.type === "deal_closed").length
  const evolutionCount = events.filter((e) => e.type === "evolution").length
  const milestoneCount = events.filter((e) => e.type === "milestone").length

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h1 className="text-lg font-semibold tracking-tight">What your team shipped</h1>
          </div>
          <p className="text-[11px] text-[#6b7280]">{totalWins} wins while you were building</p>
        </div>

        {/* Stats header */}
        {events.length > 0 && (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {totalRevenue > 0 && (
              <div className="stripe-card p-4">
                <p className="text-[11px] text-[#6b7280] uppercase tracking-[0.1em] font-semibold flex items-center gap-1"><DollarSign className="h-3 w-3" />Revenue</p>
                <p className="text-[22px] font-bold tabular-nums text-[#635bff] mt-1">${totalRevenue.toLocaleString()}</p>
              </div>
            )}
            {dealsCount > 0 && (
              <div className="stripe-card p-4">
                <p className="text-[11px] text-[#6b7280] uppercase tracking-[0.1em] font-semibold flex items-center gap-1"><Trophy className="h-3 w-3" />Deals</p>
                <p className="text-[22px] font-bold tabular-nums mt-1">{dealsCount}</p>
              </div>
            )}
            {evolutionCount > 0 && (
              <div className="stripe-card p-4">
                <p className="text-[11px] text-[#6b7280] uppercase tracking-[0.1em] font-semibold flex items-center gap-1"><TrendingUp className="h-3 w-3" />Evolutions</p>
                <p className="text-[22px] font-bold tabular-nums text-[#635bff] mt-1">{evolutionCount}</p>
              </div>
            )}
            {milestoneCount > 0 && (
              <div className="stripe-card p-4">
                <p className="text-[11px] text-[#6b7280] uppercase tracking-[0.1em] font-semibold flex items-center gap-1"><Star className="h-3 w-3" />Milestones</p>
                <p className="text-[22px] font-bold tabular-nums text-amber-500 mt-1">{milestoneCount}</p>
              </div>
            )}
          </div>
        )}

        {events.length === 0 ? (
          <div className="text-center py-16 text-[#6b7280]">
            <Trophy className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No wins yet. Your team is just getting started.</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="section-label">{group.label}</span>
                <div className="flex-1 border-t border-[rgba(255,255,255,0.06)]" />
                <span className="text-[11px] text-[rgba(255,255,255,0.35)] tabular-nums">{group.events.length}</span>
              </div>

              <div className="space-y-3">
                {group.events.map((event) => {
                  const style = TYPE_STYLES[event.type] || { icon: Trophy, color: "text-[#6b7280]", label: event.type }
                  const Icon = style.icon
                  const agent = agents.find((a) => a.id === event.agentId)
                  return (
                    <div key={event.id} className="bg-[#1a1a2e] border border-[rgba(255,255,255,0.08)] rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        {/* Icon/Avatar */}
                        {agent ? (
                          <div className="shrink-0">
                            <PixelAvatar characterIndex={0} size={36} className="rounded-lg" />
                          </div>
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-[#16213e]/50 flex items-center justify-center shrink-0">
                            <Icon className={cn("h-4 w-4", style.color)} />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          {/* Type badge + timestamp */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] font-semibold", style.color)}>
                              <Icon className="h-3 w-3" />
                              {style.label}
                            </span>
                            <span className="text-[11px] text-[rgba(255,255,255,0.35)]">· {formatTimeAgo(event.createdAt)}</span>
                            {event.amount && (
                              <span className="ml-auto text-[13px] font-bold text-[#635bff] tabular-nums">
                                ${event.amount.toLocaleString()}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <p className="text-[14px] font-medium leading-snug text-[#f3f4f6]">{event.title}</p>

                          {/* Description */}
                          {event.description && (
                            <p className="text-[12px] text-[#6b7280] mt-1 leading-relaxed">{event.description}</p>
                          )}

                          {/* Share button */}
                          <div className="mt-2 flex justify-end">
                            <a
                              href={`/api/share-card/trophy?id=${event.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-[rgba(255,255,255,0.35)] hover:text-[#d1d5db] transition-colors"
                            >
                              <Share2 className="h-3 w-3" />
                              Share
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {events.length > 0 && (
          <div className="pt-4 text-center">
            <p className="text-[11px] text-[rgba(255,255,255,0.2)]">
              {totalWins} wins since you joined — your team is building.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
