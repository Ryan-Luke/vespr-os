"use client"

import { useState, useEffect, useRef } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { cn } from "@/lib/utils"
import { X, Printer, FileText, TrendingUp, Users, DollarSign, CheckCircle2, Clock, AlertCircle } from "lucide-react"

// ── Types ────────────────────────────────────────────────────

interface Agent {
  id: string
  name: string
  role: string
  pixelAvatarIndex: number
  teamId: string | null
  status: string
  xp: number
  level: number
  streak: number
  tasksCompleted: number
  costThisMonth: number
}

interface Task {
  id: string
  title: string
  status: string
  assigneeId: string | null
  createdAt: string
}

interface ActivityEntry {
  id: string
  agentName: string
  action: string
  description: string
  createdAt: string
}

interface Team {
  id: string
  name: string
  icon: string
  agents: Agent[]
}

// ── Helpers ──────────────────────────────────────────────────

function getWeekRange(): { start: Date; end: Date; label: string } {
  const now = new Date()
  const day = now.getDay()
  const start = new Date(now)
  start.setDate(now.getDate() - ((day + 6) % 7)) // Monday
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6) // Sunday
  end.setHours(23, 59, 59, 999)

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return { start, end, label: `${fmt(start)} - ${fmt(end)}, ${end.getFullYear()}` }
}

function generateSummary(agents: Agent[], tasks: Task[], activity: ActivityEntry[]): string {
  const active = agents.filter((a) => a.status === "working").length
  const totalTasks = agents.reduce((s, a) => s + (a.tasksCompleted ?? 0), 0)
  const totalCost = agents.reduce((s, a) => s + (a.costThisMonth ?? 0), 0)
  const done = tasks.filter((t) => t.status === "done").length

  const lines = [
    `The team of ${agents.length} agents completed ${totalTasks} tasks this period, with ${active} currently active.`,
    done > 0
      ? `${done} tasks moved to done status across all teams.`
      : "Task throughput is ramping up with several items in progress.",
    totalCost > 0
      ? `Total operational cost came in at $${totalCost.toFixed(2)}, averaging $${(totalCost / Math.max(agents.length, 1)).toFixed(2)} per agent.`
      : "Cost tracking is active with no spend recorded yet.",
    activity.length > 0
      ? `Recent highlights include ${activity[0]?.agentName ?? "the team"} ${activity[0]?.description?.toLowerCase() ?? "completing key work"}.`
      : "Activity logs show steady progress throughout the week.",
  ]
  return lines.join(" ")
}

// ── Component ────────────────────────────────────────────────

export function WeeklyReport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      fetch("/api/agents").then((r) => r.json()),
      fetch("/api/tasks?limit=100").then((r) => r.json()),
      fetch("/api/activity?limit=100").then((r) => r.json()),
      fetch("/api/teams").then((r) => r.json()),
    ])
      .then(([ag, tk, ac, tm]) => {
        setAgents(ag as Agent[])
        setTasks((tk.tasks ?? tk) as Task[])
        setActivity((ac.entries ?? ac) as ActivityEntry[])
        setTeams(tm as Team[])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [open])

  if (!open) return null

  const week = getWeekRange()

  // KPIs
  const totalTasks = agents.reduce((s, a) => s + (a.tasksCompleted ?? 0), 0)
  const hoursSaved = Math.round(totalTasks * 0.15)
  const totalCost = agents.reduce((s, a) => s + (a.costThisMonth ?? 0), 0)
  const activeAgents = agents.filter((a) => a.status === "working").length

  // Top performers by XP
  const topPerformers = [...agents].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0)).slice(0, 3)

  // Task breakdown
  const taskBreakdown = {
    done: tasks.filter((t) => t.status === "done").length,
    inProgress: tasks.filter((t) => t.status === "in_progress" || t.status === "review").length,
    backlog: tasks.filter((t) => t.status === "backlog" || t.status === "todo").length,
  }

  // Notable events
  const notableEvents = activity.slice(0, 5)

  // Cost by team
  const costByTeam = teams.map((team) => {
    const teamAgents = team.agents ?? agents.filter((a) => a.teamId === team.id)
    const cost = teamAgents.reduce((s: number, a: Agent) => s + (a.costThisMonth ?? 0), 0)
    return { name: team.name, icon: team.icon, cost }
  }).filter((t) => t.cost > 0)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 print:bg-white print:backdrop-blur-none">
      {/* Overlay click to close */}
      <div className="absolute inset-0 print:hidden" onClick={onClose} />

      <div
        ref={reportRef}
        className="relative z-10 my-8 w-full max-w-2xl mx-auto modal-glass rounded-2xl p-6 print:my-0 print:border-none print:shadow-none print:bg-white print:text-black"
        id="weekly-report"
      >
        {/* ── Toolbar ─────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 mb-5 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs bg-teal-500 text-white px-3 py-1.5 rounded-lg hover:bg-teal-400 transition-colors font-medium"
          >
            <Printer className="h-3 w-3" />
            Print
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-7 w-7 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="h-4 w-4 text-stone-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-sm text-stone-500 animate-pulse">Loading report data...</div>
          </div>
        ) : (
          <>
            {/* ── Header ──────────────────────────────── */}
            <div className="border-b border-[rgba(255,255,255,0.06)] pb-4 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-teal-500 print:text-black" />
                <span className="section-label print:text-gray-500">
                  VESPR
                </span>
              </div>
              <h1 className="text-lg font-semibold text-stone-200">Weekly Report</h1>
              <p className="text-[11px] text-stone-500 mt-0.5 print:text-gray-500">{week.label}</p>
            </div>

            {/* ── Executive Summary ───────────────────── */}
            <section className="mb-6">
              <h2 className="section-label mb-2">Executive Summary</h2>
              <p className="text-xs text-stone-400 leading-relaxed print:text-gray-600">
                {generateSummary(agents, tasks, activity)}
              </p>
            </section>

            {/* ── KPI Grid ────────────────────────────── */}
            <section className="mb-6">
              <h2 className="section-label mb-3">Key Metrics</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Tasks Completed", value: totalTasks.toLocaleString(), icon: <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" /> },
                  { label: "Hours Saved", value: hoursSaved.toLocaleString(), icon: <Clock className="h-3.5 w-3.5 text-stone-500" /> },
                  { label: "Total Cost", value: `$${totalCost.toFixed(2)}`, icon: <DollarSign className="h-3.5 w-3.5 text-stone-500" /> },
                  { label: "Active Agents", value: `${activeAgents}/${agents.length}`, icon: <Users className="h-3.5 w-3.5 text-stone-500" /> },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="glass-subtle rounded-xl p-3 print:bg-gray-50 print:border print:border-gray-200"
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {kpi.icon}
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider print:text-gray-500">{kpi.label}</span>
                    </div>
                    <p className="text-[22px] font-bold tabular-nums">{kpi.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Top Performers ──────────────────────── */}
            {topPerformers.length > 0 && (
              <section className="mb-6">
                <h2 className="section-label mb-3">Top Performers</h2>
                <div className="space-y-2">
                  {topPerformers.map((agent, i) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-3 glass-subtle rounded-xl p-3 print:bg-gray-50 print:border-gray-200"
                    >
                      <span className="text-[11px] font-mono text-stone-600 w-4 text-center tabular-nums print:text-gray-400">
                        {i + 1}
                      </span>
                      <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={24} className="rounded-lg" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-stone-300">{agent.name}</span>
                        <span className="text-[11px] text-stone-600 ml-1.5 print:text-gray-500">{agent.role}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] tabular-nums shrink-0">
                        <span className="text-[10px] font-semibold bg-teal-500/10 text-teal-500 px-1.5 py-0.5 rounded-full">Lv.{agent.level}</span>
                        <span className="font-medium text-stone-300">{(agent.xp ?? 0).toLocaleString()} XP</span>
                        <span className="text-stone-600 print:text-gray-500">{agent.tasksCompleted} tasks</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Task Breakdown ──────────────────────── */}
            <section className="mb-6">
              <h2 className="section-label mb-3">Task Breakdown</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Done", count: taskBreakdown.done, color: "text-teal-500" },
                  { label: "In Progress", count: taskBreakdown.inProgress, color: "text-amber-500" },
                  { label: "Backlog", count: taskBreakdown.backlog, color: "text-stone-500" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="glass-subtle rounded-xl p-3 text-center print:bg-gray-50 print:border print:border-gray-200"
                  >
                    <p className={cn("text-[22px] font-bold tabular-nums", item.color)}>{item.count}</p>
                    <p className="text-[10px] text-stone-500 mt-0.5 uppercase tracking-wider print:text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Notable Events ──────────────────────── */}
            {notableEvents.length > 0 && (
              <section className="mb-6">
                <h2 className="section-label mb-3">Notable Events</h2>
                <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                  {notableEvents.map((entry) => {
                    const diffMs = Date.now() - new Date(entry.createdAt).getTime()
                    const diffHr = Math.floor(diffMs / 3600000)
                    const t = diffHr < 24 ? `${diffHr}h ago` : `${Math.floor(diffHr / 24)}d ago`
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 py-2.5 text-xs print:border-gray-100"
                      >
                        <span className="font-medium shrink-0 text-stone-300">{entry.agentName}</span>
                        <span className="text-stone-500 truncate flex-1 print:text-gray-500">
                          {entry.description}
                        </span>
                        <span className="text-stone-600 tabular-nums shrink-0 print:text-gray-400">{t}</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Cost Summary ────────────────────────── */}
            <section className="mb-2">
              <h2 className="section-label mb-3">Cost Summary</h2>
              <div className="glass-subtle rounded-xl p-4 print:bg-gray-50 print:border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider print:text-gray-500">Total Spend</span>
                  <span className="text-lg font-bold tabular-nums">${totalCost.toFixed(2)}</span>
                </div>
                {costByTeam.length > 0 && (
                  <div className="space-y-2 border-t border-[rgba(255,255,255,0.04)] pt-3 print:border-gray-200">
                    {costByTeam.map((team) => (
                      <div key={team.name} className="flex items-center justify-between text-xs">
                        <span className="text-stone-500 print:text-gray-500">
                          {team.icon} {team.name}
                        </span>
                        <span className="tabular-nums font-medium text-stone-300">${team.cost.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {costByTeam.length === 0 && (
                  <p className="text-[11px] text-stone-600 print:text-gray-400">
                    No per-team cost breakdown available.
                  </p>
                )}
              </div>
            </section>

            {/* ── Footer ──────────────────────────────── */}
            <div className="border-t border-[rgba(255,255,255,0.06)] pt-3 mt-6 print:border-gray-200">
              <p className="text-[10px] text-stone-700 text-center print:text-gray-400">
                Generated by VESPR on{" "}
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Print styles ─────────────────────────── */}
      <style>{`
        @media print {
          body > *:not(#weekly-report):not(:has(#weekly-report)) {
            display: none !important;
          }
          body {
            background: white !important;
          }
          #weekly-report {
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}

// ── Trigger Button ───────────────────────────────────────────

export function WeeklyReportButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs btn-glass rounded-xl px-3 py-1.5 print:hidden"
      >
        <TrendingUp className="h-3 w-3 text-stone-500" />
        <span className="text-stone-400">Weekly Report</span>
      </button>
      <WeeklyReport open={open} onClose={() => setOpen(false)} />
    </>
  )
}
