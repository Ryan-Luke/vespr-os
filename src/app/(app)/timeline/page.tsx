"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PixelAvatar } from "@/components/pixel-avatar"
import { Rocket, Users, CheckCircle2, Trophy, Zap, MessageSquare, Target, Clock, TrendingUp } from "lucide-react"

interface TimelineEvent {
  id: string
  type: "milestone" | "hire" | "task" | "goal" | "system"
  title: string
  description: string
  icon: string
  agentName?: string
  agentPixelIndex?: number
  timestamp: string
}

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [stats, setStats] = useState<{ agents: number; tasks: number; days: number }>({ agents: 0, tasks: 0, days: 0 })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/agents").then((r) => r.json()),
      fetch("/api/activity?limit=30").then((r) => r.json()),
      fetch("/api/gamification").then((r) => r.json()),
    ]).then(([agents, activity, milestones]) => {
      const totalTasks = agents.reduce((sum: number, a: any) => sum + (a.tasksCompleted ?? 0), 0)
      setStats({ agents: agents.length, tasks: totalTasks, days: 30 })

      const timelineEvents: TimelineEvent[] = []

      // Company founding event
      timelineEvents.push({
        id: "founding",
        type: "system",
        title: "Business OS workspace created",
        description: "Your AI-powered team started here.",
        icon: "🚀",
        timestamp: new Date(Date.now() - 30 * 24 * 3600000).toISOString(),
      })

      // Agent hires
      for (const agent of agents) {
        timelineEvents.push({
          id: `hire-${agent.id}`,
          type: "hire",
          title: `${agent.name} joined as ${agent.role}`,
          description: agent.isTeamLead ? "Joined as department lead" : "Added to the team",
          icon: "👋",
          agentName: agent.name,
          agentPixelIndex: agent.pixelAvatarIndex,
          timestamp: agent.createdAt,
        })
      }

      // Milestones
      if (Array.isArray(milestones)) {
        for (const m of milestones) {
          timelineEvents.push({
            id: `milestone-${m.id}`,
            type: "milestone",
            title: `${m.icon} ${m.name}`,
            description: m.description,
            icon: m.icon,
            timestamp: m.unlockedAt,
          })
        }
      }

      // Recent activity
      if (Array.isArray(activity)) {
        for (const a of activity.slice(0, 15)) {
          timelineEvents.push({
            id: `activity-${a.id}`,
            type: "task",
            title: a.agentName,
            description: a.description,
            icon: a.action === "completed_task" ? "✅" : a.action === "flagged" ? "⚠️" : a.action === "created_sop" ? "📋" : "💬",
            agentName: a.agentName,
            timestamp: a.createdAt,
          })
        }
      }

      // Sort by timestamp descending
      timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setEvents(timelineEvents)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const days = Math.floor(hr / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" })
  }

  const typeColors: Record<string, string> = {
    milestone: "bg-amber-500",
    hire: "bg-green-500",
    task: "bg-blue-500",
    goal: "bg-purple-500",
    system: "bg-primary",
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          Company Timeline
        </h1>
        <p className="text-sm text-muted-foreground">Your journey from idea to execution</p>
      </div>

      {/* Company stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{stats.agents}</p>
            <p className="text-xs text-muted-foreground mt-1">Team Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{stats.tasks.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Tasks Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{stats.days}</p>
            <p className="text-xs text-muted-foreground mt-1">Days Running</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-4 relative">
              {/* Dot */}
              <div className={`h-3 w-3 rounded-full ${typeColors[event.type] || "bg-muted"} shrink-0 mt-1.5 z-10 ring-4 ring-background`} style={{ marginLeft: "10px" }} />

              {/* Content */}
              <Card className="flex-1">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    {event.agentPixelIndex != null && (
                      <PixelAvatar characterIndex={event.agentPixelIndex} size={28} className="rounded-md border border-border mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{event.title}</span>
                        <Badge variant="secondary" className="text-xs h-5 capitalize">{event.type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
