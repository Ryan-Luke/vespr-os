"use client"

import { useState, useEffect } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineEvent {
  id: string
  type: "milestone" | "hire" | "task" | "goal" | "system"
  title: string
  description: string
  agentPixelIndex?: number
  timestamp: string
}

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [stats, setStats] = useState<{ agents: number; tasks: number }>({ agents: 0, tasks: 0 })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/agents").then((r) => r.json()),
      fetch("/api/activity?limit=30").then((r) => r.json()),
      fetch("/api/gamification").then((r) => r.json()),
    ]).then(([agents, activity, milestones]) => {
      const totalTasks = agents.reduce((sum: number, a: any) => sum + (a.tasksCompleted ?? 0), 0)
      setStats({ agents: agents.length, tasks: totalTasks })

      const tl: TimelineEvent[] = []

      tl.push({ id: "founding", type: "system", title: "Workspace created", description: "Business OS initialized", timestamp: new Date(Date.now() - 30 * 24 * 3600000).toISOString() })

      for (const agent of agents) {
        tl.push({ id: `hire-${agent.id}`, type: "hire", title: `${agent.name} joined`, description: agent.role, agentPixelIndex: agent.pixelAvatarIndex, timestamp: agent.createdAt })
      }

      if (Array.isArray(milestones)) {
        for (const m of milestones) {
          tl.push({ id: `m-${m.id}`, type: "milestone", title: `${m.icon} ${m.name}`, description: m.description, timestamp: m.unlockedAt })
        }
      }

      if (Array.isArray(activity)) {
        for (const a of activity.slice(0, 15)) {
          tl.push({ id: `a-${a.id}`, type: "task", title: a.agentName, description: a.description, timestamp: a.createdAt })
        }
      }

      tl.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setEvents(tl)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hr = Math.floor(diff / 3600000)
    if (hr < 24) return `${hr}h ago`
    const days = Math.floor(hr / 24)
    return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" })
  }

  const dotColor: Record<string, string> = {
    milestone: "bg-amber-500",
    hire: "bg-emerald-500",
    task: "bg-blue-500",
    system: "bg-muted-foreground",
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Timeline</h1>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span><span className="text-foreground font-medium tabular-nums">{stats.agents}</span> agents</span>
          <span><span className="text-foreground font-medium tabular-nums">{stats.tasks.toLocaleString()}</span> tasks</span>
        </div>
      </div>

      {!loaded ? (
        <div className="text-xs text-muted-foreground text-center py-16">Loading...</div>
      ) : (
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-1">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 relative py-1.5">
                <div className={cn("h-[15px] w-[15px] rounded-full shrink-0 flex items-center justify-center z-10 bg-background")}>
                  <span className={cn("h-[7px] w-[7px] rounded-full", dotColor[event.type] || "bg-muted-foreground")} />
                </div>
                <div className="flex-1 min-w-0 flex items-start gap-2">
                  {event.agentPixelIndex != null && (
                    <PixelAvatar characterIndex={event.agentPixelIndex} size={20} className="rounded-sm mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{timeAgo(event.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
