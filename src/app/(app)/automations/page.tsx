"use client"

import { useState, useEffect, useCallback } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import {
  Clock, Play, Pause, Trash2, Loader2, Zap, Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AgentSchedule {
  id: string
  agentId: string
  agentName: string
  agentRole: string
  name: string
  description: string | null
  cronExpression: string
  taskPrompt: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
}

function timeAgo(date: string | null): string {
  if (!date) return "Never"
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function timeUntil(date: string | null): string {
  if (!date) return "Unknown"
  const diff = new Date(date).getTime() - Date.now()
  if (diff < 0) return "Due now"
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `in ${days}d`
}

export default function AutomationsPage() {
  const [schedules, setSchedules] = useState<AgentSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  const fetchSchedules = useCallback(() => {
    fetch("/api/schedules")
      .then((r) => r.json())
      .then((data) => {
        setSchedules(data.schedules ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchSchedules()
    const poll = setInterval(fetchSchedules, 10000)
    return () => clearInterval(poll)
  }, [fetchSchedules])

  async function toggleSchedule(id: string, enabled: boolean) {
    setToggling((prev) => new Set([...prev, id]))
    await fetch("/api/schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    })
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled } : s)),
    )
    setToggling((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  async function deleteSchedule(id: string) {
    await fetch("/api/schedules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setSchedules((prev) => prev.filter((s) => s.id !== id))
  }

  const activeCount = schedules.filter((s) => s.enabled).length
  const pausedCount = schedules.filter((s) => !s.enabled).length

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Automations</h1>
      </div>

      {/* Stats */}
      <div className="grid gap-px bg-border rounded-md overflow-hidden md:grid-cols-3">
        {[
          { label: "Active", value: activeCount, icon: <Zap className="h-3.5 w-3.5 text-emerald-500/50" /> },
          { label: "Paused", value: pausedCount, icon: <Pause className="h-3.5 w-3.5 text-amber-500/50" /> },
          { label: "Total Schedules", value: schedules.length, icon: <Calendar className="h-3.5 w-3.5 text-muted-foreground/50" /> },
        ].map((s) => (
          <div key={s.label} className="bg-card p-4">
            <div className="flex items-center gap-1.5">{s.icon}<span className="section-label">{s.label}</span></div>
            <p className="text-xl font-semibold tabular-nums mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Schedules list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-md">
          <Clock className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground/60">No scheduled tasks yet.</p>
          <p className="text-xs text-muted-foreground/40 mt-1">
            Your agents will create automations as they work. Ask the copywriter to post daily, or the finance lead to send weekly reports.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md divide-y divide-border">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", schedule.enabled ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                    <span className="text-[13px] font-medium truncate">{schedule.name}</span>
                  </div>
                  {schedule.description && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5 ml-3.5 truncate">{schedule.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleSchedule(schedule.id, !schedule.enabled)}
                    disabled={toggling.has(schedule.id)}
                    className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors"
                    title={schedule.enabled ? "Pause" : "Resume"}
                  >
                    {toggling.has(schedule.id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : schedule.enabled ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteSchedule(schedule.id)}
                    className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 ml-3.5 text-[11px] text-muted-foreground/50">
                <span className="font-mono">{schedule.cronExpression}</span>
                <span>Last: {timeAgo(schedule.lastRunAt)}</span>
                {schedule.nextRunAt && schedule.enabled && (
                  <span>Next: {timeUntil(schedule.nextRunAt)}</span>
                )}
                <span className="flex items-center gap-1">
                  {schedule.agentName} ({schedule.agentRole})
                </span>
              </div>
              {/* Task prompt preview */}
              <div className="mt-2 ml-3.5">
                <p className="text-[11px] text-muted-foreground/40 truncate">
                  {schedule.taskPrompt.slice(0, 120)}{schedule.taskPrompt.length > 120 ? "..." : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
