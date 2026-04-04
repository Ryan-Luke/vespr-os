"use client"

import { useState, useEffect, useMemo } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { CheckCircle2, UserPlus, Trophy, FileText, Brain, Zap, Filter } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineEvent {
  id: string
  type: "milestone" | "hire" | "task" | "sop" | "decision" | "system"
  title: string
  description: string
  agentPixelIndex?: number
  agentRole?: string
  timestamp: string
}

type FilterType = "all" | "task" | "milestone" | "hire" | "system"

const filterChips: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Tasks", value: "task" },
  { label: "Milestones", value: "milestone" },
  { label: "Agents", value: "hire" },
  { label: "System", value: "system" },
]

const eventConfig: Record<string, { icon: typeof CheckCircle2; color: string; dotColor: string }> = {
  task:      { icon: CheckCircle2, color: "text-emerald-500", dotColor: "bg-emerald-500" },
  hire:      { icon: UserPlus,     color: "text-blue-500",    dotColor: "bg-blue-500" },
  milestone: { icon: Trophy,       color: "text-amber-500",   dotColor: "bg-amber-500" },
  sop:       { icon: FileText,     color: "text-violet-500",  dotColor: "bg-violet-500" },
  decision:  { icon: Brain,        color: "text-purple-500",  dotColor: "bg-purple-500" },
  system:    { icon: Zap,          color: "text-muted-foreground", dotColor: "bg-muted-foreground" },
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function groupByDate(events: TimelineEvent[]): { date: string; label: string; events: TimelineEvent[] }[] {
  const groups: Map<string, TimelineEvent[]> = new Map()
  for (const event of events) {
    const key = new Date(event.timestamp).toLocaleDateString("en-CA") // YYYY-MM-DD
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(event)
  }
  return Array.from(groups.entries()).map(([date, evts]) => ({
    date,
    label: formatDateHeader(evts[0].timestamp),
    events: evts,
  }))
}

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [stats, setStats] = useState<{ agents: number; tasks: number }>({ agents: 0, tasks: 0 })
  const [loaded, setLoaded] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")

  useEffect(() => {
    Promise.all([
      fetch("/api/agents").then((r) => r.json()),
      fetch("/api/activity?limit=30").then((r) => r.json()),
      fetch("/api/gamification").then((r) => r.json()),
    ]).then(([agents, activity, milestones]) => {
      const totalTasks = agents.reduce((sum: number, a: any) => sum + (a.tasksCompleted ?? 0), 0)
      setStats({ agents: agents.length, tasks: totalTasks })

      const tl: TimelineEvent[] = []

      tl.push({
        id: "founding",
        type: "system",
        title: "Workspace created",
        description: "Business OS initialized",
        timestamp: new Date(Date.now() - 30 * 24 * 3600000).toISOString(),
      })

      for (const agent of agents) {
        tl.push({
          id: `hire-${agent.id}`,
          type: "hire",
          title: `${agent.name} joined`,
          description: agent.role,
          agentPixelIndex: agent.pixelAvatarIndex,
          agentRole: agent.role,
          timestamp: agent.createdAt,
        })
      }

      if (Array.isArray(milestones)) {
        for (const m of milestones) {
          tl.push({
            id: `m-${m.id}`,
            type: "milestone",
            title: `${m.icon} ${m.name}`,
            description: m.description,
            timestamp: m.unlockedAt,
          })
        }
      }

      if (Array.isArray(activity)) {
        for (const a of activity.slice(0, 15)) {
          tl.push({
            id: `a-${a.id}`,
            type: "task",
            title: a.agentName,
            description: a.description,
            timestamp: a.createdAt,
          })
        }
      }

      tl.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setEvents(tl)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const filtered = useMemo(() => {
    if (activeFilter === "all") return events
    return events.filter((e) => e.type === activeFilter)
  }, [events, activeFilter])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hr = Math.floor(diff / 3600000)
    if (hr < 1) return "just now"
    if (hr < 24) return `${hr}h ago`
    const days = Math.floor(hr / 24)
    return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" })
  }

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Timeline</h1>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span><span className="text-foreground font-medium tabular-nums">{stats.agents}</span> agents</span>
          <span><span className="text-foreground font-medium tabular-nums">{stats.tasks.toLocaleString()}</span> tasks</span>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5">
        <Filter className="h-3 w-3 text-muted-foreground mr-1" />
        {filterChips.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setActiveFilter(chip.value)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
              activeFilter === chip.value
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {!loaded ? (
        <div className="text-xs text-muted-foreground text-center py-16">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-16">No events found</div>
      ) : (
        <div className="relative border-l-2 border-border ml-1.5 space-y-6">
          {grouped.map((group) => (
            <div key={group.date} className="space-y-2">
              {/* Date header */}
              <div className="flex items-center -ml-[9px] gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-border shrink-0" />
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  {group.label}
                </span>
              </div>

              {/* Events in this date group */}
              <div className="space-y-2">
                {group.events.map((event) => {
                  const config = eventConfig[event.type] || eventConfig.system
                  const Icon = config.icon
                  const isMilestone = event.type === "milestone"
                  const isHire = event.type === "hire"

                  return (
                    <div key={event.id} className="flex items-start gap-3 relative -ml-[5px]">
                      {/* Dot on the timeline line */}
                      <div className="h-[15px] w-[15px] rounded-full shrink-0 flex items-center justify-center z-10 bg-background border-2 border-background mt-3">
                        <span className={cn("h-2.5 w-2.5 rounded-full", config.dotColor)} />
                      </div>

                      {/* Event card */}
                      <div
                        className={cn(
                          "flex-1 min-w-0 border rounded-md p-3",
                          isMilestone
                            ? "bg-amber-500/5 border-amber-500/10"
                            : "bg-card border-border"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Icon or avatar */}
                          {isHire && event.agentPixelIndex != null ? (
                            <PixelAvatar characterIndex={event.agentPixelIndex} size={24} className="rounded-sm shrink-0 mt-0.5" />
                          ) : (
                            <div className={cn("shrink-0 mt-0.5", config.color)}>
                              <Icon className="h-4 w-4" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                            {isHire && event.agentRole && (
                              <span className="inline-block mt-1 text-[10px] text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full font-medium">
                                {event.agentRole}
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums mt-0.5">
                            {timeAgo(event.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
