"use client"

import { useState, useEffect, useCallback } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import {
  Clock, Play, Pause, Trash2, Loader2, Zap, Calendar, Plus, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AgentOption {
  id: string
  name: string
  role: string
}

const CRON_PRESETS = [
  { label: "Every 5 minutes", cron: "*/5 * * * *" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every day at 9am", cron: "0 9 * * *" },
  { label: "Every Monday", cron: "0 9 * * 1" },
  { label: "Custom", cron: "" },
]

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
  const [showNewSchedule, setShowNewSchedule] = useState(false)
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [newAgentId, setNewAgentId] = useState("")
  const [newName, setNewName] = useState("")
  const [newCronPreset, setNewCronPreset] = useState(CRON_PRESETS[0].cron)
  const [newCronCustom, setNewCronCustom] = useState("")
  const [newTaskPrompt, setNewTaskPrompt] = useState("")
  const [newEnabled, setNewEnabled] = useState(true)
  const [creating, setCreating] = useState(false)

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

  // Fetch agents for the new schedule form
  useEffect(() => {
    const wsId = typeof window !== "undefined" ? localStorage.getItem("vespr-active-workspace") : null
    const url = wsId ? `/api/chat-data?workspaceId=${wsId}` : "/api/chat-data"
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.agents) {
          setAgents(data.agents.map((a: AgentOption) => ({ id: a.id, name: a.name, role: a.role })))
        }
      })
      .catch(() => {})
  }, [])

  async function createSchedule() {
    const cronExpression = newCronPreset === "" ? newCronCustom : newCronPreset
    if (!newAgentId || !newName.trim() || !cronExpression.trim() || !newTaskPrompt.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: newAgentId,
          name: newName.trim(),
          cronExpression: cronExpression.trim(),
          taskPrompt: newTaskPrompt.trim(),
          enabled: newEnabled,
        }),
      })
      if (res.ok) {
        fetchSchedules()
        setShowNewSchedule(false)
        setNewAgentId("")
        setNewName("")
        setNewCronPreset(CRON_PRESETS[0].cron)
        setNewCronCustom("")
        setNewTaskPrompt("")
        setNewEnabled(true)
      }
    } catch {
      // ignore
    }
    setCreating(false)
  }

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
        <button
          onClick={() => setShowNewSchedule(true)}
          className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
        >
          <Plus className="h-3 w-3" />
          New Schedule
        </button>
      </div>

      {/* New Schedule Modal */}
      {showNewSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNewSchedule(false)}>
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">New Schedule</h2>
              <button onClick={() => setShowNewSchedule(false)} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Agent select */}
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Agent</label>
                <select
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors"
                >
                  <option value="">Select an agent...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                  ))}
                </select>
              </div>

              {/* Schedule name */}
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Daily content review"
                  className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors"
                />
              </div>

              {/* Cron expression */}
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Frequency</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {CRON_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setNewCronPreset(preset.cron)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] transition-colors border",
                        newCronPreset === preset.cron
                          ? "bg-primary/10 border-primary/30 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {newCronPreset === "" && (
                  <input
                    value={newCronCustom}
                    onChange={(e) => setNewCronCustom(e.target.value)}
                    placeholder="Custom cron e.g. 0 */2 * * *"
                    className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] font-mono outline-none focus:border-muted-foreground/30 transition-colors"
                  />
                )}
              </div>

              {/* Task prompt */}
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Task Prompt</label>
                <textarea
                  value={newTaskPrompt}
                  onChange={(e) => setNewTaskPrompt(e.target.value)}
                  rows={3}
                  placeholder="What should the agent do each time?"
                  className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors"
                />
              </div>

              {/* Enabled toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Start enabled</span>
                <button
                  onClick={() => setNewEnabled(!newEnabled)}
                  className={cn(
                    "h-5 w-9 rounded-full transition-colors relative",
                    newEnabled ? "bg-emerald-500" : "bg-muted-foreground/30",
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                    newEnabled ? "translate-x-4" : "translate-x-0.5",
                  )} />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowNewSchedule(false)}
                className="h-7 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createSchedule}
                disabled={creating || !newAgentId || !newName.trim() || !newTaskPrompt.trim() || (newCronPreset === "" && !newCronCustom.trim())}
                className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-1.5"
              >
                {creating && <Loader2 className="h-3 w-3 animate-spin" />}
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}

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
