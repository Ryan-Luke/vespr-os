"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Plus, Clock, CheckCircle2, Loader2, AlertCircle,
  ChevronRight, ChevronLeft, ChevronDown, Bell, Upload, Check,
  MessageSquare, X, Save, Search, ExternalLink,
  Link2, Lock, Unlink, Layout, FileText, Target, Bug, DollarSign, ClipboardList,
  Play, Square, CalendarDays, Columns3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TaskDetailModal } from "@/components/task-detail-modal"

// --- Dependency helpers ---
type DepsMap = Record<string, string[]> // taskId → array of taskIds that block it

function loadDeps(): DepsMap {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem("bos-task-deps") || "{}") } catch { return {} }
}
function saveDeps(deps: DepsMap) {
  localStorage.setItem("bos-task-deps", JSON.stringify(deps))
}
/** Return set of taskIds that block the given task */
function getBlockers(deps: DepsMap, taskId: string): string[] {
  return deps[taskId] ?? []
}
/** Return set of taskIds that the given task blocks */
function getBlocking(deps: DepsMap, taskId: string): string[] {
  return Object.entries(deps).filter(([, blockers]) => blockers.includes(taskId)).map(([id]) => id)
}

// --- Timer helpers ---
type TimerMap = Record<string, { totalSeconds: number; startedAt: string | null }>

function loadTimers(): TimerMap {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem("bos-task-timers") || "{}") } catch { return {} }
}
function saveTimers(timers: TimerMap) {
  localStorage.setItem("bos-task-timers", JSON.stringify(timers))
}
function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function getElapsed(timer: { totalSeconds: number; startedAt: string | null }): number {
  if (!timer.startedAt) return timer.totalSeconds
  return timer.totalSeconds + Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000)
}

// --- Subtask helpers ---
interface Subtask { id: string; title: string; done: boolean }
type SubtasksMap = Record<string, Subtask[]>

function loadSubtasks(): SubtasksMap {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem("bos-subtasks") || "{}") } catch { return {} }
}
function saveSubtasks(subtasks: SubtasksMap) {
  localStorage.setItem("bos-subtasks", JSON.stringify(subtasks))
}

interface DBAgent { id: string; name: string; role: string; pixelAvatarIndex: number; teamId: string | null; status: string }
interface DBTeam { id: string; name: string; icon: string }
interface DBTask {
  id: string; title: string; description: string | null
  assignedAgentId: string | null; assignedToUser: boolean; teamId: string | null
  status: string; priority: string
  linkedMessageIds: string[]
  instructions: string | null; resources: { label: string; url: string }[] | null; blockedReason: string | null
  requirement: { type: "file" | "url" | "text" | "checkbox" | null; label: string; fulfilled?: boolean; value?: string; fulfilledAt?: string } | null
  createdAt: string; completedAt: string | null
}

const columns = [
  { id: "backlog", label: "Backlog", icon: <Clock className="h-3.5 w-3.5" />, color: "text-muted-foreground" },
  { id: "todo", label: "To Do", icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-blue-400" },
  { id: "in_progress", label: "In Progress", icon: <Loader2 className="h-3.5 w-3.5" />, color: "text-yellow-400" },
  { id: "review", label: "Review", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-purple-400" },
  { id: "done", label: "Done", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-green-400" },
]

const priorityColors: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-amber-400",
  medium: "text-[#635bff]",
  low: "text-muted-foreground",
}

const priorityDots: Record<string, string> = {
  urgent: "bg-red-400",
  high: "bg-amber-400",
  medium: "bg-[#635bff]",
  low: "bg-[rgba(255,255,255,0.08)]",
}

// --- Task Templates ---
const TASK_TEMPLATES = [
  {
    id: "blog-post",
    title: "Blog Post Pipeline",
    description: "End-to-end blog post creation workflow",
    icon: FileText,
    subtasks: ["Research", "Outline", "Draft", "Edit", "Publish"],
  },
  {
    id: "client-onboarding",
    title: "Client Onboarding",
    description: "New client setup and first deliverable",
    icon: Layout,
    subtasks: ["Welcome email", "Intake call", "Setup account", "First deliverable"],
  },
  {
    id: "marketing-campaign",
    title: "Marketing Campaign",
    description: "Full campaign lifecycle from strategy to reporting",
    icon: Target,
    subtasks: ["Strategy", "Creative", "Launch", "Monitor", "Report"],
  },
  {
    id: "bug-fix",
    title: "Bug Fix",
    description: "Standard bug investigation and resolution flow",
    icon: Bug,
    subtasks: ["Reproduce", "Investigate", "Fix", "Test", "Deploy"],
  },
  {
    id: "financial-report",
    title: "Financial Report",
    description: "Data gathering through final submission",
    icon: DollarSign,
    subtasks: ["Gather data", "Reconcile", "Draft report", "Review", "Submit"],
  },
]

const TEMPLATE_TAG = "[template]"

// Owner tasks are now loaded from the database (tasks where assignedToUser=true)

interface TaskCardProps {
  task: DBTask
  agents: DBAgent[]
  teams: DBTeam[]
  allTasks: DBTask[]
  onMove: (id: string, status: string) => void
  // dependency props
  deps: DepsMap
  linkingFrom: string | null
  onStartLink: (taskId: string) => void
  onCompleteLink: (taskId: string) => void
  onRemoveDep: (blockedId: string, blockerId: string) => void
  hoveredTaskId: string | null
  onHover: (taskId: string | null) => void
  highlightedIds: Set<string>
  // timer props
  timerData: { totalSeconds: number; startedAt: string | null } | undefined
  isTimerRunning: boolean
  onToggleTimer: (taskId: string) => void
  now: number
  // subtask props
  subtasks: Subtask[]
  onAddSubtask: (taskId: string, title: string) => void
  onToggleSubtask: (taskId: string, subtaskId: string) => void
  // detail modal
  onOpenDetail: (task: DBTask) => void
}

function TaskCard({ task, agents, teams, allTasks, onMove, deps, linkingFrom, onStartLink, onCompleteLink, onRemoveDep, hoveredTaskId, onHover, highlightedIds, timerData, isTimerRunning, onToggleTimer, now, subtasks, onAddSubtask, onToggleSubtask, onOpenDetail }: TaskCardProps) {
  const agent = task.assignedAgentId ? agents.find((a) => a.id === task.assignedAgentId) : null
  const colIndex = columns.findIndex((c) => c.id === task.status)

  const blockers = getBlockers(deps, task.id)
  const blocking = getBlocking(deps, task.id)
  const isBlocked = blockers.length > 0
  const isLinkSource = linkingFrom === task.id
  const isHighlighted = highlightedIds.has(task.id)

  const elapsed = timerData ? getElapsed(timerData) : 0
  const assignedAgent = agent // alias for clarity in metadata row

  // Subtask state
  const [showAddSubtask, setShowAddSubtask] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [expanded, setExpanded] = useState(false)
  const subtaskInputRef = useRef<HTMLInputElement>(null)

  const doneCount = subtasks.filter((s) => s.done).length
  const totalCount = subtasks.length
  const COLLAPSE_THRESHOLD = 3
  const VISIBLE_WHEN_COLLAPSED = 2
  const visibleSubtasks = totalCount > COLLAPSE_THRESHOLD && !expanded ? subtasks.slice(0, VISIBLE_WHEN_COLLAPSED) : subtasks

  function handleAddSubtask() {
    if (!newSubtaskTitle.trim()) return
    onAddSubtask(task.id, newSubtaskTitle.trim())
    setNewSubtaskTitle("")
    setShowAddSubtask(false)
  }

  function titleForId(id: string) {
    return allTasks.find((t) => t.id === id)?.title ?? id.slice(0, 6)
  }

  return (
    <div
      data-task-id={task.id}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("taskId", task.id); e.dataTransfer.effectAllowed = "move" }}
      className={cn(
        "bg-[#1a1a2e] border border-[rgba(255,255,255,0.08)] rounded-xl border border-border rounded-lg p-3 group hover:border-[rgba(255,255,255,0.08)] transition-all relative cursor-grab active:cursor-grabbing active:opacity-70 active:ring-2 active:ring-[#635bff]",
        task.assignedToUser && !isBlocked && "border-l-2 border-l-amber-500",
        isBlocked && "border-l-2 border-l-red-500 opacity-60",
        isLinkSource && "ring-2 ring-[#635bff]",
        linkingFrom && !isLinkSource && "cursor-pointer",
        isHighlighted && "ring-1 ring-[#7c3aed]/60 shadow-[0_0_8px_rgba(99,91,255,0.25)]",
      )}
      onClick={() => { if (linkingFrom && linkingFrom !== task.id) { onCompleteLink(task.id) } else if (!linkingFrom) { onOpenDetail(task) } }}
      onMouseEnter={() => onHover(task.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: linkingFrom ? undefined : undefined }}
    >
      <div className="flex items-start gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0", priorityDots[task.priority] || "bg-zinc-500")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[13px] font-medium leading-snug flex-1 text-white">{task.title}</p>
            {task.description?.includes(TEMPLATE_TAG) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">📋 Template</span>
            )}
            {task.description?.includes("[recurring:") && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 shrink-0">🔄 {task.description.match(/\[recurring:(\w+)\]/)?.[1]}</span>
            )}
            {/* Timer button */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTimer(task.id) }}
              className={cn(
                "h-5 w-5 rounded flex items-center justify-center shrink-0 transition-opacity",
                isTimerRunning ? "opacity-100 text-emerald-400 hover:bg-emerald-500/10" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-accent",
              )}
              title={isTimerRunning ? "Stop timer" : "Start timer"}
            >
              {isTimerRunning ? <Square className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
            </button>
            {/* Add subtask button — visible on hover */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddSubtask(true) }}
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground shrink-0 transition-opacity opacity-0 group-hover:opacity-100"
              title="Add subtask"
            >
              <Plus className="h-3 w-3" />
            </button>
            {/* Link button — visible on hover */}
            <button
              onClick={(e) => { e.stopPropagation(); onStartLink(task.id) }}
              className={cn(
                "h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground shrink-0 transition-opacity",
                isLinkSource ? "opacity-100 text-blue-400" : "opacity-0 group-hover:opacity-100",
              )}
              title={isLinkSource ? "Cancel linking" : "Link dependency"}
            >
              <Link2 className="h-3 w-3" />
            </button>
          </div>
          {task.description && <p className="text-[12px] text-[#9ca3af] mt-0.5 line-clamp-2">{task.description}</p>}
          {/* Task metadata — time, agent, created */}
          <div className="flex items-center gap-3 mt-1.5">
            {elapsed > 0 && (
              <span className={cn("text-[11px] tabular-nums flex items-center gap-1", isTimerRunning ? "text-emerald-400" : "text-muted-foreground")}>
                <Clock className="h-3 w-3" />
                {formatTime(elapsed)}
              </span>
            )}
            {assignedAgent && (
              <span className="text-[11px] text-[#6b7280] flex items-center gap-1">
                <PixelAvatar characterIndex={assignedAgent.pixelAvatarIndex} size={14} className="rounded-sm" />
                {assignedAgent.name}
              </span>
            )}
            {task.assignedToUser && <span className="text-[10px] text-amber-400 font-medium">You</span>}
            <span className="ml-auto text-[11px] text-[#6b7280]">{new Date(task.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
          </div>
        </div>
      </div>

      {/* Dependency indicators */}
      {(blockers.length > 0 || blocking.length > 0) && (
        <div className="mt-1.5 pl-3.5 space-y-0.5">
          {blockers.map((bid) => (
            <button key={bid} onClick={(e) => { e.stopPropagation(); onRemoveDep(task.id, bid) }} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-400 transition-colors" title="Click to remove">
              <Lock className="text-red-400 h-3 w-3" />
              <span>Blocked by {titleForId(bid)}</span>
              <Unlink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 ml-0.5" />
            </button>
          ))}
          {blocking.map((bid) => (
            <button key={bid} onClick={(e) => { e.stopPropagation(); onRemoveDep(bid, task.id) }} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-blue-400 transition-colors" title="Click to remove">
              <Link2 className="text-blue-400 h-3 w-3" />
              <span>Blocks {titleForId(bid)}</span>
              <Unlink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 ml-0.5" />
            </button>
          ))}
        </div>
      )}

      {/* Subtasks */}
      {(totalCount > 0 || showAddSubtask) && (
        <div className="mt-1.5 pl-3.5">
          {/* Progress indicator */}
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-muted-foreground tabular-nums">{doneCount}/{totalCount}</span>
              <div className="flex-1 h-0.5 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-primary/50 transition-all duration-200" style={{ width: `${(doneCount / totalCount) * 100}%` }} />
              </div>
            </div>
          )}
          {/* Subtask list */}
          {visibleSubtasks.map((sub) => (
            <div key={sub.id} className="flex items-center gap-1.5 py-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSubtask(task.id, sub.id) }}
                className={cn(
                  "h-3.5 w-3.5 rounded border border-border shrink-0 flex items-center justify-center transition-colors",
                  sub.done && "bg-primary/20 border-primary/40",
                )}
              >
                {sub.done && <Check className="h-2.5 w-2.5 text-primary" />}
              </button>
              <span className={cn("text-[11px] leading-tight", sub.done ? "line-through text-muted-foreground/50" : "text-foreground/80")}>{sub.title}</span>
            </div>
          ))}
          {/* Show more toggle */}
          {totalCount > COLLAPSE_THRESHOLD && (
            <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-0.5 flex items-center gap-0.5">
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
              {expanded ? "Show less" : `Show ${totalCount - VISIBLE_WHEN_COLLAPSED} more`}
            </button>
          )}
          {/* Inline add subtask input */}
          {showAddSubtask && (
            <div className="flex items-center gap-1 mt-0.5">
              <input
                ref={subtaskInputRef}
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); if (e.key === "Escape") { setShowAddSubtask(false); setNewSubtaskTitle("") } }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Subtask title..."
                className="flex-1 h-5 bg-transparent border-b border-border text-[11px] outline-none placeholder:text-muted-foreground/40"
                autoFocus
              />
              <button onClick={(e) => { e.stopPropagation(); handleAddSubtask() }} className="text-[11px] text-muted-foreground hover:text-foreground px-1">Add</button>
              <button onClick={(e) => { e.stopPropagation(); setShowAddSubtask(false); setNewSubtaskTitle("") }} className="text-[11px] text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-2 pl-3.5">
        <div className="flex items-center gap-2">
          {task.linkedMessageIds.length > 0 && (
            <a href={`/?message=${task.linkedMessageIds[0]}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
              <MessageSquare className="h-3 w-3" />
              <span>{task.linkedMessageIds.length}</span>
            </a>
          )}
          {isTimerRunning && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button disabled={colIndex <= 0} onClick={(e) => { e.stopPropagation(); colIndex > 0 && onMove(task.id, columns[colIndex - 1].id) }} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground disabled:opacity-30">
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button disabled={colIndex >= columns.length - 1} onClick={(e) => { e.stopPropagation(); colIndex < columns.length - 1 && onMove(task.id, columns[colIndex + 1].id) }} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground disabled:opacity-30">
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Calendar View ---
function CalendarView({ tasks, agents, priorityDots: dots }: { tasks: DBTask[]; agents: DBAgent[]; priorityDots: Record<string, string> }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [hoveredTask, setHoveredTask] = useState<DBTask | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const today = new Date()

  // Build calendar grid
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  // Monday = 0, Sunday = 6
  const startOffset = (firstDay.getDay() + 6) % 7
  const totalDays = lastDay.getDate()
  const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7

  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month, 1 - startOffset + i)
    cells.push({ date: d, inMonth: d.getMonth() === month })
  }

  // Group tasks by date string (YYYY-MM-DD)
  const tasksByDate = useMemo(() => {
    const map: Record<string, DBTask[]> = {}
    for (const task of tasks) {
      const dateStr = task.createdAt ? task.createdAt.slice(0, 10) : null
      if (dateStr) {
        if (!map[dateStr]) map[dateStr] = []
        map[dateStr].push(task)
      }
    }
    return map
  }, [tasks])

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  const dayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  function prevMonth() { setCurrentMonth(new Date(year, month - 1, 1)) }
  function nextMonth() { setCurrentMonth(new Date(year, month + 1, 1)) }

  function isToday(d: Date) {
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  }

  function dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  function handleDotEnter(e: React.MouseEvent, task: DBTask) {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopoverPos({ x: rect.left + rect.width / 2, y: rect.top })
    setHoveredTask(task)
  }

  function handleDotLeave() {
    setHoveredTask(null)
    setPopoverPos(null)
  }

  return (
    <div className="px-6 py-5">
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium">{monthNames[month]} {year}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))} className="h-7 px-2 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            Today
          </button>
          <button onClick={nextMonth} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-t-md overflow-hidden">
        {dayHeaders.map((d) => (
          <div key={d} className="bg-muted/30 py-2 text-center">
            <span className="text-[11px] font-medium text-muted-foreground">{d}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-b-md overflow-hidden">
        {cells.map((cell, i) => {
          const key = dateKey(cell.date)
          const dayTasks = tasksByDate[key] ?? []
          const isCurrentDay = isToday(cell.date)
          return (
            <div
              key={i}
              className={cn(
                "bg-card p-2 min-h-[80px] transition-colors",
                !cell.inMonth && "opacity-30",
                isCurrentDay && "bg-primary/5",
              )}
            >
              <span className={cn(
                "text-xs text-muted-foreground inline-flex items-center justify-center",
                isCurrentDay && "h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-medium",
              )}>
                {cell.date.getDate()}
              </span>
              {dayTasks.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {dayTasks.slice(0, 6).map((task) => (
                    <span
                      key={task.id}
                      className={cn("h-1.5 w-1.5 rounded-full cursor-default transition-transform hover:scale-150", dots[task.priority] || "bg-zinc-500")}
                      onMouseEnter={(e) => handleDotEnter(e, task)}
                      onMouseLeave={handleDotLeave}
                    />
                  ))}
                  {dayTasks.length > 6 && (
                    <span className="text-[9px] text-muted-foreground leading-none">+{dayTasks.length - 6}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Hover popover */}
      {hoveredTask && popoverPos && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: popoverPos.x, top: popoverPos.y - 8, transform: "translate(-50%, -100%)" }}
        >
          <div className="bg-card border border-border rounded-md shadow-lg px-3 py-2 max-w-[200px]">
            <p className="text-[12px] font-medium leading-snug">{hoveredTask.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("h-1.5 w-1.5 rounded-full", dots[hoveredTask.priority] || "bg-zinc-500")} />
              <span className="text-[10px] text-muted-foreground capitalize">{hoveredTask.priority}</span>
              <span className="text-[10px] text-muted-foreground capitalize">{hoveredTask.status.replace("_", " ")}</span>
            </div>
            {hoveredTask.assignedAgentId && (() => {
              const a = agents.find((ag) => ag.id === hoveredTask.assignedAgentId)
              return a ? <p className="text-[10px] text-muted-foreground mt-0.5">{a.name}</p> : null
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

function UserTaskCard({ task, canComplete, onComplete, onFulfill }: {
  task: DBTask
  canComplete: boolean
  onComplete: () => void
  onFulfill: (value: string) => void
}) {
  const [textValue, setTextValue] = useState("")
  const [urlValue, setUrlValue] = useState("")
  const [showDetail, setShowDetail] = useState(false)
  const req = task.requirement
  const isFulfilled = req?.fulfilled === true
  const priorityDot = task.priority === "urgent" ? "bg-red-500" : task.priority === "high" ? "bg-amber-500" : task.priority === "medium" ? "bg-[#635bff]" : "bg-[rgba(255,255,255,0.08)]"

  return (
    <div className={cn("rounded-md border border-l-2 transition-colors", isFulfilled ? "border-l-emerald-500 bg-emerald-500/5" : "border-l-amber-500 bg-card")}>
      <div className="flex items-start gap-2.5 px-3 py-2">
        <button
          onClick={canComplete ? onComplete : undefined}
          disabled={!canComplete}
          title={canComplete ? "Mark complete" : `Requirement not fulfilled: ${req?.label}`}
          className={cn(
            "h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors mt-0.5",
            canComplete ? "border-amber-400 hover:bg-amber-500/20 cursor-pointer" : "border-border cursor-not-allowed opacity-40"
          )}
        >
          {isFulfilled && <Check className="h-2.5 w-2.5 text-amber-400" />}
        </button>
        <button onClick={() => setShowDetail(!showDetail)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium">{task.title}</span>
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", priorityDot)} />
            {req?.type && (
              <span className={cn("text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded", isFulfilled ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400")}>
                {isFulfilled ? "✓ Done" : "Needs " + req.type}
              </span>
            )}
          </div>
          {task.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
        </button>
      </div>

      {/* Requirement UI */}
      {showDetail && req?.type && (
        <div className="px-3 pb-3 pt-1 border-t border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Required: {req.label}</p>
          {task.instructions && (
            <p className="text-[11px] text-muted-foreground mb-2 whitespace-pre-wrap">{task.instructions}</p>
          )}

          {isFulfilled ? (
            <div className="flex items-center gap-2 text-[11px] text-emerald-400">
              <Check className="h-3 w-3" />
              <span>Fulfilled{req.value && req.type !== "checkbox" ? ` — ${req.type === "text" ? `"${req.value.slice(0, 50)}${req.value.length > 50 ? "..." : ""}"` : req.value}` : ""}</span>
            </div>
          ) : (
            <>
              {req.type === "checkbox" && (
                <button onClick={() => onFulfill("checked")} className="h-7 px-3 rounded-md bg-amber-500 text-white text-[11px] font-medium hover:bg-amber-600 transition-colors flex items-center gap-1.5">
                  <Check className="h-3 w-3" />
                  Confirm Done
                </button>
              )}
              {req.type === "text" && (
                <div className="space-y-1.5">
                  <textarea
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    rows={3}
                    placeholder="Enter your response..."
                    className="w-full rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-[12px] outline-none focus:border-muted-foreground/30 transition-colors resize-none"
                  />
                  <button onClick={() => textValue.trim() && onFulfill(textValue.trim())} disabled={!textValue.trim()} className="h-7 px-3 rounded-md bg-amber-500 text-white text-[11px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-40">Submit</button>
                </div>
              )}
              {req.type === "url" && (
                <div className="flex gap-1.5">
                  <input
                    value={urlValue}
                    onChange={(e) => setUrlValue(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 h-7 rounded-md border border-border bg-muted/50 px-2.5 text-[12px] outline-none focus:border-muted-foreground/30 transition-colors"
                  />
                  <button onClick={() => urlValue.trim() && onFulfill(urlValue.trim())} disabled={!urlValue.trim()} className="h-7 px-3 rounded-md bg-amber-500 text-white text-[11px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-40">Submit</button>
                </div>
              )}
              {req.type === "file" && (
                <div className="flex gap-1.5 items-center">
                  <label className="flex-1 flex items-center gap-2 h-7 px-2.5 rounded-md border border-dashed border-border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                    <Upload className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Click to upload file</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) onFulfill(file.name) // In real impl, upload to storage first
                      }}
                    />
                  </label>
                </div>
              )}
            </>
          )}

          {/* Resources */}
          {task.resources && task.resources.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.resources.map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline bg-primary/5 rounded px-2 py-0.5">
                  <ExternalLink className="h-2.5 w-2.5" />
                  {r.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<DBTask[]>([])
  const [dbAgents, setDbAgents] = useState<DBAgent[]>([])
  const [dbTeams, setDbTeams] = useState<DBTeam[]>([])
  // myTasks = tasks from DB where assignedToUser = true and status != done
  const myTasks = tasks.filter((t) => t.assignedToUser)
  const unresolvedMyTasks = myTasks.filter((t) => t.status !== "done")
  const [loading, setLoading] = useState(true)
  const [filterTeam, setFilterTeam] = useState<string | null>(null)
  const [filterAgent, setFilterAgent] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showMyTasks, setShowMyTasks] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newPriority, setNewPriority] = useState("medium")
  const [newAgentId, setNewAgentId] = useState("")
  const [newTeamId, setNewTeamId] = useState("")
  const [saving, setSaving] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [newRecurrence, setNewRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none")
  const [templateLoading, setTemplateLoading] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"board" | "calendar">("board")
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // --- Dependency state ---
  const [deps, setDeps] = useState<DepsMap>({})
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null)
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)

  // --- Timer state ---
  const [timers, setTimers] = useState<TimerMap>({})
  const [now, setNow] = useState(Date.now())

  // --- Task detail modal state ---
  const [selectedTask, setSelectedTask] = useState<DBTask | null>(null)

  // --- Subtask state ---
  const [subtasksMap, setSubtasksMap] = useState<SubtasksMap>({})

  // Load subtasks from localStorage on mount
  useEffect(() => { setSubtasksMap(loadSubtasks()) }, [])

  function updateSubtasks(next: SubtasksMap) { setSubtasksMap(next); saveSubtasks(next) }

  function handleAddSubtask(taskId: string, title: string) {
    const current = subtasksMap[taskId] ?? []
    const newSubtask: Subtask = { id: crypto.randomUUID(), title, done: false }
    updateSubtasks({ ...subtasksMap, [taskId]: [...current, newSubtask] })
  }

  function handleToggleSubtask(taskId: string, subtaskId: string) {
    const current = subtasksMap[taskId] ?? []
    const updated = current.map((s) => s.id === subtaskId ? { ...s, done: !s.done } : s)
    updateSubtasks({ ...subtasksMap, [taskId]: updated })
  }

  // Load timers from localStorage on mount
  useEffect(() => { setTimers(loadTimers()) }, [])

  // Tick every second while any timer is running
  useEffect(() => {
    const hasRunning = Object.values(timers).some((t) => t.startedAt !== null)
    if (!hasRunning) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [timers])

  function updateTimers(next: TimerMap) { setTimers(next); saveTimers(next) }

  function handleToggleTimer(taskId: string) {
    const current = { ...timers }
    const entry = current[taskId] ?? { totalSeconds: 0, startedAt: null }

    if (entry.startedAt) {
      // Stop this timer
      const elapsed = Math.floor((Date.now() - new Date(entry.startedAt).getTime()) / 1000)
      current[taskId] = { totalSeconds: entry.totalSeconds + elapsed, startedAt: null }
    } else {
      // Stop any other running timer first
      for (const [id, t] of Object.entries(current)) {
        if (t.startedAt) {
          const elapsed = Math.floor((Date.now() - new Date(t.startedAt).getTime()) / 1000)
          current[id] = { totalSeconds: t.totalSeconds + elapsed, startedAt: null }
        }
      }
      // Start this timer
      current[taskId] = { totalSeconds: entry.totalSeconds, startedAt: new Date().toISOString() }
    }
    updateTimers(current)
  }

  // Find currently running timer
  const activeTimerEntry = Object.entries(timers).find(([, t]) => t.startedAt !== null)
  const activeTimerId = activeTimerEntry ? activeTimerEntry[0] : null
  const activeTimerTask = activeTimerId ? tasks.find((t) => t.id === activeTimerId) : null

  // Load deps from localStorage on mount
  useEffect(() => { setDeps(loadDeps()) }, [])

  function updateDeps(next: DepsMap) { setDeps(next); saveDeps(next) }

  function handleStartLink(taskId: string) {
    setLinkingFrom((prev) => prev === taskId ? null : taskId)
  }

  function handleCompleteLink(targetId: string) {
    if (!linkingFrom || linkingFrom === targetId) return
    // linkingFrom blocks targetId
    const current = deps[targetId] ?? []
    if (current.includes(linkingFrom)) { setLinkingFrom(null); return } // already exists
    updateDeps({ ...deps, [targetId]: [...current, linkingFrom] })
    setLinkingFrom(null)
  }

  function handleRemoveDep(blockedId: string, blockerId: string) {
    const current = deps[blockedId] ?? []
    const next = current.filter((id) => id !== blockerId)
    const copy = { ...deps }
    if (next.length === 0) { delete copy[blockedId] } else { copy[blockedId] = next }
    updateDeps(copy)
  }

  // Compute highlighted task IDs when hovering a task with dependencies
  const highlightedIds = useMemo(() => {
    const set = new Set<string>()
    if (!hoveredTaskId) return set
    const blockers = getBlockers(deps, hoveredTaskId)
    const blocking = getBlocking(deps, hoveredTaskId)
    for (const id of blockers) set.add(id)
    for (const id of blocking) set.add(id)
    return set
  }, [hoveredTaskId, deps])

  // Cancel linking mode / close template picker on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (linkingFrom) setLinkingFrom(null)
        if (showTemplates) setShowTemplates(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [linkingFrom, showTemplates])

  // Handle ?highlight=<taskId> URL param — scroll to and highlight a task
  useEffect(() => {
    if (!loading && tasks.length > 0) {
      const params = new URLSearchParams(window.location.search)
      const targetId = params.get("highlight")
      if (targetId) {
        setTimeout(() => {
          const el = document.querySelector(`[data-task-id="${targetId}"]`)
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" })
            el.classList.add("ring-2", "ring-blue-400", "shadow-[0_0_12px_rgba(96,165,250,0.4)]")
            setTimeout(() => el.classList.remove("ring-2", "ring-blue-400", "shadow-[0_0_12px_rgba(96,165,250,0.4)]"), 3000)
          }
        }, 300)
      }
    }
  }, [loading, tasks])

  const fetchData = useCallback(async () => {
    const wsId = typeof window !== "undefined" ? localStorage.getItem("vespr-active-workspace") : null
    const chatUrl = wsId ? `/api/chat-data?workspaceId=${wsId}` : "/api/chat-data"
    const [tasksRes, chatData] = await Promise.all([
      fetch("/api/tasks?limit=100").then((r) => r.json()),
      fetch(chatUrl).then((r) => r.json()),
    ])
    setTasks(tasksRes.tasks ?? tasksRes)
    setDbAgents(chatData.agents)
    setDbTeams(chatData.channels ? [] : []) // teams come from chat-data agents
    // Extract unique teams from agents
    const teamSet = new Map<string, DBTeam>()
    for (const a of chatData.agents) {
      if (a.teamId) {
        // We'll fetch teams separately
      }
    }
    // Fetch teams properly
    const teamsRes = await fetch("/api/teams").then((r) => r.json())
    setDbTeams(teamsRes.map((t: any) => ({ id: t.id, name: t.name, icon: t.icon })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function moveTask(taskId: string, newStatus: string) {
    const task = tasks.find((t) => t.id === taskId)
    const wasDone = task?.status === "done"
    const isNowDone = newStatus === "done"

    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: newStatus }),
    })

    // Fire XP award + evolution check when task transitions into "done"
    if (!wasDone && isNowDone && task?.assignedAgentId) {
      await fetch("/api/gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: task.assignedAgentId, reason: "task_shipped" }),
      }).catch(() => {})
    }
  }

  async function createTask() {
    if (!newTitle.trim()) return
    setSaving(true)
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle, description: newRecurrence !== "none" ? `${newDesc || ""}\n[recurring:${newRecurrence}]` : (newDesc || null),
        priority: newPriority, status: "todo",
        assignedAgentId: newAgentId || null, teamId: newTeamId || null,
      }),
    })
    if (res.ok) {
      const task = await res.json()
      setTasks((prev) => [...prev, task])
      setNewTitle(""); setNewDesc(""); setNewPriority("medium"); setNewAgentId(""); setNewTeamId("")
      setShowNewTask(false)
    }
    setSaving(false)
  }

  async function instantiateTemplate(templateId: string) {
    const template = TASK_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    setTemplateLoading(templateId)
    const created: DBTask[] = []
    for (let i = 0; i < template.subtasks.length; i++) {
      const subtask = template.subtasks[i]
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${template.title}: ${subtask}`,
          description: `${TEMPLATE_TAG} Part of "${template.title}" template (${i + 1}/${template.subtasks.length})`,
          priority: "medium",
          status: i === 0 ? "in_progress" : "backlog",
        }),
      })
      if (res.ok) {
        const task = await res.json()
        created.push(task)
      }
    }
    setTasks((prev) => [...prev, ...created])
    setShowTemplates(false)
    setTemplateLoading(null)
  }

  const unresolvedOwner = unresolvedMyTasks
  const filteredTasks = tasks.filter((t) => {
    if (t.assignedToUser) return false // user tasks shown separately
    if (filterTeam && t.teamId !== filterTeam) return false
    if (filterAgent && t.assignedAgentId !== filterAgent) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function completeUserTask(taskId: string) {
    const task = myTasks.find((t) => t.id === taskId)
    if (!task) return
    // If task has a requirement, it must be fulfilled
    if (task.requirement?.type && !task.requirement.fulfilled) return
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: "done", completedAt: new Date().toISOString() }),
    })
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "done" } : t))
  }

  async function fulfillRequirement(taskId: string, value: string) {
    const task = myTasks.find((t) => t.id === taskId)
    if (!task || !task.requirement) return
    const updatedReq = { ...task.requirement, fulfilled: true, value, fulfilledAt: new Date().toISOString() }
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, requirement: updatedReq }),
    })
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, requirement: updatedReq } : t))
  }

  async function handleTaskUpdate(taskId: string, updates: Partial<DBTask>) {
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t))
    // Update selected task in modal too
    setSelectedTask((prev) => prev && prev.id === taskId ? { ...prev, ...updates } : prev)

    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, ...updates }),
    })

    // Fire XP award if moved to done
    if (updates.status === "done") {
      const task = tasks.find((t) => t.id === taskId)
      if (task?.assignedAgentId) {
        await fetch("/api/gamification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: task.assignedAgentId, reason: "task_shipped" }),
        }).catch(() => {})
      }
    }

    // Refresh data to pick up server-side changes (SOP gen, etc.)
    fetchData()
  }

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading...</div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-12 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[13px] font-semibold">Tasks</h1>
          <span className="text-xs text-muted-foreground tabular-nums">{filteredTasks.length} tasks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center h-7 rounded-md border border-border bg-muted/30 p-0.5">
            <button onClick={() => setViewMode("board")} className={cn("h-6 px-2 rounded text-[11px] font-medium flex items-center gap-1 transition-colors", viewMode === "board" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Columns3 className="h-3 w-3" />Board
            </button>
            <button onClick={() => setViewMode("calendar")} className={cn("h-6 px-2 rounded text-[11px] font-medium flex items-center gap-1 transition-colors", viewMode === "calendar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <CalendarDays className="h-3 w-3" />Calendar
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 w-32 rounded-md bg-[#16213e] border border-[rgba(255,255,255,0.08)] rounded-xl focus:border-[#635bff] pl-7 pr-2 text-xs outline-none transition-colors" />
          </div>
          <div className="relative">
            <button onClick={() => setShowTemplates((p) => !p)} className="h-7 px-2 rounded-md text-xs font-medium border border-border text-foreground flex items-center gap-1 hover:bg-accent transition-colors"><ClipboardList className="h-3 w-3" />Templates</button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-lg p-2 w-72">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">Task Templates</p>
                {TASK_TEMPLATES.map((tpl) => {
                  const Icon = tpl.icon
                  const isLoading = templateLoading === tpl.id
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => instantiateTemplate(tpl.id)}
                      disabled={!!templateLoading}
                      className="w-full p-3 rounded-md hover:bg-accent transition-colors cursor-pointer text-left flex items-start gap-2.5 disabled:opacity-50"
                    >
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Icon className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium">{tpl.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{tpl.description}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{tpl.subtasks.length} subtasks</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <button onClick={() => setShowNewTask(true)} className="h-7 px-2 rounded-lg text-xs font-medium btn-primary flex items-center gap-1"><Plus className="h-3 w-3" />New</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 px-6 py-1.5 border-b border-border shrink-0 overflow-x-auto bg-[#1a1a2e/50]">
        <button onClick={() => { setFilterTeam(null); setFilterAgent(null) }} className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0", !filterTeam && !filterAgent ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>All</button>
        {dbTeams.map((team) => (
          <button key={team.id} onClick={() => { setFilterTeam(filterTeam === team.id ? null : team.id); setFilterAgent(null) }} className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0", filterTeam === team.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{team.icon} {team.name}</button>
        ))}
        <div className="w-px h-3 bg-border mx-0.5" />
        {(filterTeam ? dbAgents.filter((a) => a.teamId === filterTeam) : dbAgents).slice(0, 6).map((agent) => (
          <button key={agent.id} onClick={() => setFilterAgent(filterAgent === agent.id ? null : agent.id)} className={cn("flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0", filterAgent === agent.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={12} className="rounded-sm" />{agent.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* My Tasks — Compact */}
        {unresolvedOwner.length > 0 && (
          <div className="px-6 py-2.5 border-b border-border">
            <button
              className="flex items-center justify-between w-full group"
              onClick={() => setShowMyTasks(!showMyTasks)}
            >
              <div className="flex items-center gap-2">
                <Bell className="h-3 w-3 text-amber-400" />
                <span className="text-[13px] font-medium">Your Tasks</span>
                <span className="h-[18px] min-w-[18px] rounded-full bg-amber-500 px-1 text-[10px] font-medium text-white flex items-center justify-center">{unresolvedOwner.length}</span>
              </div>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", showMyTasks && "rotate-180")} />
            </button>

            {showMyTasks && (
              <div className="mt-2 space-y-2">
                {/* Compact progress */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${myTasks.length > 0 ? (myTasks.filter((t) => t.status === "done").length / myTasks.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{myTasks.filter((t) => t.status === "done").length}/{myTasks.length}</span>
                </div>

                {unresolvedMyTasks.map((task) => {
                  const req = task.requirement
                  const hasRequirement = !!req?.type
                  const fulfilled = req?.fulfilled === true
                  const canComplete = !hasRequirement || fulfilled
                  return (
                    <UserTaskCard
                      key={task.id}
                      task={task}
                      canComplete={canComplete}
                      onComplete={() => completeUserTask(task.id)}
                      onFulfill={(value) => fulfillRequirement(task.id, value)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* New Task Form */}
        {showNewTask && (
          <div className="px-6 py-4 border-b border-border">
            <div className="bg-[#16213e] border border-border rounded-md p-4 space-y-3">
              <p className="section-label">New Task</p>
              <input placeholder="Task title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full h-8 rounded-md bg-[#16213e] border border-[rgba(255,255,255,0.08)] rounded-xl focus:border-[#635bff] px-3 text-[13px] outline-none transition-colors" />
              <textarea placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} className="w-full rounded-md bg-[#16213e] border border-[rgba(255,255,255,0.08)] rounded-xl focus:border-[#635bff] px-3 py-2 text-[13px] outline-none resize-none transition-colors" />
              <div className="grid grid-cols-3 gap-2">
                <Select value={newPriority} onValueChange={(v) => setNewPriority(v ?? "medium")}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newTeamId} onValueChange={(v) => setNewTeamId(v ?? "")}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Team" /></SelectTrigger>
                  <SelectContent>
                    {dbTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.icon} {t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newAgentId} onValueChange={(v) => setNewAgentId(v ?? "")}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assign" /></SelectTrigger>
                  <SelectContent>
                    {(newTeamId ? dbAgents.filter((a) => a.teamId === newTeamId) : dbAgents).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {(["none", "daily", "weekly", "monthly"] as const).map((r) => (
                    <button key={r} onClick={() => setNewRecurrence(r)} className={cn("px-2 py-1 rounded-md text-[11px] transition-colors", newRecurrence === r ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{r === "none" ? "Once" : r.charAt(0).toUpperCase() + r.slice(1)}</button>
                  ))}
                </div>
                <div className="flex-1" />
                <button onClick={createTask} disabled={!newTitle.trim() || saving} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Create
                </button>
                <button onClick={() => setShowNewTask(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Linking mode banner */}
        {linkingFrom && (
          <div className="px-6 py-1.5 bg-[#635bff]/10 border-b border-[#635bff]/20 flex items-center gap-2">
            <Link2 className="h-3 w-3 text-[#7c3aed]" />
            <span className="text-[11px] text-[#7c3aed] font-medium">
              Linking mode — click a task to mark it as blocked by &ldquo;{filteredTasks.find((t) => t.id === linkingFrom)?.title ?? "selected task"}&rdquo;
            </span>
            <button onClick={() => setLinkingFrom(null)} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <X className="h-3 w-3" />Cancel
            </button>
          </div>
        )}

        {/* Active timer indicator */}
        {activeTimerTask && activeTimerEntry && (
          <div className="px-6 py-1.5 border-b border-border flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="bg-emerald-500/10 text-emerald-400 rounded-md px-3 py-1.5 text-xs flex items-center gap-2">
              Timer running: {activeTimerTask.title} — {formatTime(getElapsed(activeTimerEntry[1]))}
              <button onClick={() => handleToggleTimer(activeTimerId!)} className="h-4 w-4 rounded flex items-center justify-center hover:bg-emerald-500/20 transition-colors">
                <Square className="h-2.5 w-2.5" />
              </button>
            </span>
          </div>
        )}

        {/* View: Board or Calendar */}
        {viewMode === "board" ? (
          <div className={cn("flex-1 overflow-x-auto", linkingFrom && "cursor-crosshair")}>
            <div className="flex gap-px bg-border min-w-max h-full">
              {columns.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.status === col.id)
                return (
                  <div
                    key={col.id}
                    className={cn(
                      "w-60 flex flex-col shrink-0 bg-background transition-colors",
                      dragOverColumn === col.id && "bg-[#635bff]/5 border border-[#635bff]/20",
                    )}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverColumn(col.id) }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null) }}
                    onDrop={(e) => { e.preventDefault(); setDragOverColumn(null); const taskId = e.dataTransfer.getData("taskId"); if (taskId) moveTask(taskId, col.id) }}
                  >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-[#1a1a2e/50]">
                      <span className="text-[11px] uppercase tracking-widest text-[#6b7280] font-semibold">{col.label}</span>
                      <span className="text-[10px] text-[#d1d5db] tabular-nums bg-[rgba(99,91,255,0.1)] text-[#635bff] border border-[rgba(99,91,255,0.15)] rounded-full rounded-full px-1.5 py-0.5">{colTasks.length}</span>
                    </div>
                    <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
                      {colTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          agents={dbAgents}
                          teams={dbTeams}
                          allTasks={filteredTasks}
                          onMove={moveTask}
                          deps={deps}
                          linkingFrom={linkingFrom}
                          onStartLink={handleStartLink}
                          onCompleteLink={handleCompleteLink}
                          onRemoveDep={handleRemoveDep}
                          hoveredTaskId={hoveredTaskId}
                          onHover={setHoveredTaskId}
                          highlightedIds={highlightedIds}
                          timerData={timers[task.id]}
                          isTimerRunning={timers[task.id]?.startedAt !== null && timers[task.id]?.startedAt !== undefined}
                          onToggleTimer={handleToggleTimer}
                          now={now}
                          subtasks={subtasksMap[task.id] ?? []}
                          onAddSubtask={handleAddSubtask}
                          onToggleSubtask={handleToggleSubtask}
                          onOpenDetail={setSelectedTask}
                        />
                      ))}
                      {colTasks.length === 0 && (
                        <div className="flex items-center justify-center py-8">
                          <p className="text-[11px] text-muted-foreground/50">Empty</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <CalendarView tasks={filteredTasks} agents={dbAgents} priorityDots={priorityDots} />
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          agents={dbAgents}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (taskId, updates) => {
            await handleTaskUpdate(taskId, updates)
            // Update the modal's task reference with fresh data
            setSelectedTask((prev) => prev && prev.id === taskId ? { ...prev, ...updates } : prev)
          }}
        />
      )}
    </div>
  )
}
