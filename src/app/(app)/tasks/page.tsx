"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {} from "@/components/ui/badge"
import { PixelAvatar } from "@/components/pixel-avatar"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Plus, Clock, CheckCircle2, Loader2, AlertCircle,
  ChevronRight, ChevronLeft, Bell, Upload, Check,
  MessageSquare, X, Save, Search, ExternalLink,
  Link2, Lock, Unlink, Layout, FileText, Target, Bug, DollarSign, ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"

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

interface DBAgent { id: string; name: string; role: string; pixelAvatarIndex: number; teamId: string | null; status: string }
interface DBTeam { id: string; name: string; icon: string }
interface DBTask {
  id: string; title: string; description: string | null
  assignedAgentId: string | null; assignedToUser: boolean; teamId: string | null
  status: string; priority: string
  linkedMessageIds: string[]
  instructions: string | null; resources: { label: string; url: string }[] | null; blockedReason: string | null
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
  medium: "text-blue-400",
  low: "text-muted-foreground",
}

const priorityDots: Record<string, string> = {
  urgent: "bg-red-400",
  high: "bg-amber-400",
  medium: "bg-blue-400",
  low: "bg-zinc-500",
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

// Owner tasks (agents delegate to you)
const ownerTasks = [
  {
    id: "ot1", title: "Upload March bank statement",
    description: "I need the March bank statement to complete the Q1 P&L report. Without it I can't reconcile expenses or finalize profit margins for last quarter.",
    instructions: "1. Log in to your bank portal\n2. Navigate to Statements or Documents\n3. Select March 2026 statement\n4. Download as PDF\n5. Come back here and click Upload to attach it",
    resources: [
      { label: "Chase Bank Login", url: "https://chase.com/login" },
      { label: "Q1 P&L Draft (Google Sheet)", url: "#" },
    ],
    requestedBy: "Morgan", priority: "urgent", resolved: false,
  },
  {
    id: "ot2", title: "Approve ad creative variations",
    description: "3 new ad copy variations for the Section 8 campaign are ready. I can't launch the next ad set until you approve at least one — we're losing potential leads every day we wait.",
    instructions: "1. Open the creative preview link below\n2. Review all 3 ad copy variations\n3. Check that messaging aligns with your brand voice\n4. Click Approve to greenlight, or message me with changes",
    resources: [
      { label: "Creative Preview (Figma)", url: "#" },
      { label: "Campaign Brief", url: "#" },
      { label: "Current Ad Performance", url: "#" },
    ],
    requestedBy: "Maya", priority: "high", resolved: false,
  },
  {
    id: "ot3", title: "Confirm refund for Order #ORD-8834",
    description: "Customer #4521 is requesting a full refund ($189) for a delayed shipment. Package was 5 days late. I recommend approving — this customer has been with us for 2 years and has a high lifetime value.",
    instructions: "1. Review the order details in the link below\n2. Check the customer's history (2-year customer, 12 orders)\n3. Decide: approve full refund ($189), partial refund, or deny\n4. Click Approve or message me with your decision",
    resources: [
      { label: "Order #ORD-8834 Details", url: "#" },
      { label: "Customer #4521 Profile", url: "#" },
      { label: "Refund Policy Doc", url: "#" },
    ],
    requestedBy: "Casey", priority: "urgent", resolved: false,
  },
  {
    id: "ot4", title: "Set daily ad spend budget",
    description: "Ready to scale Section 8 ads. Current metrics support 4-5 calls/day at $140/call with 3-4X ROAS. I need your daily spend limit so I can configure the campaigns — every day without this means missed leads.",
    instructions: "1. Review current campaign performance in the dashboard link below\n2. Check your available marketing budget for this month\n3. Pick a daily spend limit (e.g., $500/day, $1000/day)\n4. Reply to me with your chosen amount",
    resources: [
      { label: "Ad Performance Dashboard", url: "#" },
      { label: "Monthly Budget Tracker", url: "#" },
    ],
    requestedBy: "Zara", priority: "high", resolved: false,
  },
  {
    id: "ot5", title: "Review and approve Q1 content calendar",
    description: "I've drafted the full Q1 content calendar with 36 posts across Instagram, LinkedIn, and email. I need your sign-off before I start scheduling — some posts reference upcoming product launches that only you can confirm.",
    instructions: "1. Open the content calendar spreadsheet below\n2. Review post topics, captions, and scheduled dates\n3. Flag any posts that reference unconfirmed launches or sensitive info\n4. Leave comments on anything you want changed\n5. Reply to me with 'Approved' or send your change requests",
    resources: [
      { label: "Q1 Content Calendar (Sheet)", url: "#" },
      { label: "Brand Guidelines", url: "#" },
      { label: "Product Launch Timeline", url: "#" },
    ],
    requestedBy: "Maya", priority: "high", resolved: false,
  },
  {
    id: "ot6", title: "Set brand voice guidelines for social media",
    description: "I'm building out our social media playbook but I need your input on brand voice — tone, vocabulary, topics to avoid. Without this, I'm guessing at what sounds like 'us' and risk off-brand posts going live.",
    instructions: "1. Review the brand voice questionnaire linked below (5 min)\n2. Fill in tone preferences (casual vs professional, humorous vs serious)\n3. List any words, phrases, or topics to always avoid\n4. Add 2-3 example posts that feel 'on brand' to you\n5. Send back the completed questionnaire or message me your answers",
    resources: [
      { label: "Brand Voice Questionnaire", url: "#" },
      { label: "Competitor Voice Examples", url: "#" },
      { label: "Current Social Profiles", url: "#" },
    ],
    requestedBy: "Zara", priority: "medium", resolved: false,
  },
]

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
}

function TaskCard({ task, agents, teams, allTasks, onMove, deps, linkingFrom, onStartLink, onCompleteLink, onRemoveDep, hoveredTaskId, onHover, highlightedIds }: TaskCardProps) {
  const agent = task.assignedAgentId ? agents.find((a) => a.id === task.assignedAgentId) : null
  const colIndex = columns.findIndex((c) => c.id === task.status)

  const blockers = getBlockers(deps, task.id)
  const blocking = getBlocking(deps, task.id)
  const isBlocked = blockers.length > 0
  const isLinkSource = linkingFrom === task.id
  const isHighlighted = highlightedIds.has(task.id)

  function titleForId(id: string) {
    return allTasks.find((t) => t.id === id)?.title ?? id.slice(0, 6)
  }

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-md p-3 group hover:border-muted-foreground/20 transition-all relative",
        task.assignedToUser && !isBlocked && "border-l-2 border-l-amber-500",
        isBlocked && "border-l-2 border-l-red-500 opacity-60",
        isLinkSource && "ring-2 ring-blue-500",
        linkingFrom && !isLinkSource && "cursor-pointer",
        isHighlighted && "ring-1 ring-blue-400/60 shadow-[0_0_8px_rgba(96,165,250,0.25)]",
      )}
      onClick={() => { if (linkingFrom && linkingFrom !== task.id) onCompleteLink(task.id) }}
      onMouseEnter={() => onHover(task.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-start gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0", priorityDots[task.priority] || "bg-zinc-500")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[13px] font-medium leading-snug flex-1">{task.title}</p>
            {task.description?.includes(TEMPLATE_TAG) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">📋 Template</span>
            )}
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
          {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
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

      <div className="flex items-center justify-between mt-2 pl-3.5">
        <div className="flex items-center gap-2">
          {agent && (
            <div className="flex items-center gap-1">
              <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={14} className="rounded-sm" />
              <span className="text-[11px] text-muted-foreground">{agent.name}</span>
            </div>
          )}
          {task.assignedToUser && <span className="text-[11px] text-amber-400 font-medium">You</span>}
          {task.linkedMessageIds.length > 0 && (
            <a href={`/?message=${task.linkedMessageIds[0]}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
              <MessageSquare className="h-3 w-3" />
              <span>{task.linkedMessageIds.length}</span>
            </a>
          )}
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<DBTask[]>([])
  const [dbAgents, setDbAgents] = useState<DBAgent[]>([])
  const [dbTeams, setDbTeams] = useState<DBTeam[]>([])
  const [myTasks, setMyTasks] = useState(ownerTasks)
  const [loading, setLoading] = useState(true)
  const [filterTeam, setFilterTeam] = useState<string | null>(null)
  const [filterAgent, setFilterAgent] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showMyTasks, setShowMyTasks] = useState(true)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newPriority, setNewPriority] = useState("medium")
  const [newAgentId, setNewAgentId] = useState("")
  const [newTeamId, setNewTeamId] = useState("")
  const [saving, setSaving] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateLoading, setTemplateLoading] = useState<string | null>(null)

  // --- Dependency state ---
  const [deps, setDeps] = useState<DepsMap>({})
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null)
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)

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

  const fetchData = useCallback(async () => {
    const [tasksRes, chatData] = await Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/chat-data").then((r) => r.json()),
    ])
    setTasks(tasksRes)
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
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: newStatus }),
    })
  }

  async function createTask() {
    if (!newTitle.trim()) return
    setSaving(true)
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle, description: newDesc || null,
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

  const unresolvedOwner = myTasks.filter((t) => !t.resolved)
  const filteredTasks = tasks.filter((t) => {
    if (filterTeam && t.teamId !== filterTeam) return false
    if (filterAgent && t.assignedAgentId !== filterAgent) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

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
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 w-32 rounded-md border border-border bg-muted/50 pl-7 pr-2 text-xs outline-none focus:border-muted-foreground/30 transition-colors" />
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
          <button onClick={() => setShowNewTask(true)} className="h-7 px-2 rounded-md text-xs font-medium bg-primary text-primary-foreground flex items-center gap-1 hover:bg-primary/90 transition-colors"><Plus className="h-3 w-3" />New</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 px-6 py-1.5 border-b border-border shrink-0 overflow-x-auto">
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
        {/* My Tasks */}
        {unresolvedOwner.length > 0 && showMyTasks && (
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="section-label">Assigned to You</span>
                <span className="h-[18px] min-w-[18px] rounded-full bg-red-500 px-1 text-[10px] font-medium text-white flex items-center justify-center">{unresolvedOwner.length}</span>
              </div>
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowMyTasks(false)}>Hide</button>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">
                  {myTasks.filter((t) => t.resolved).length} of {myTasks.length} tasks done
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {Math.round((myTasks.filter((t) => t.resolved).length / myTasks.length) * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${(myTasks.filter((t) => t.resolved).length / myTasks.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {myTasks.filter((t) => !t.resolved).map((task) => {
                const reqAgent = dbAgents.find((a) => a.name === task.requestedBy)
                const steps = task.instructions ? task.instructions.split("\n").filter((s) => s.trim()) : []
                return (
                  <div key={task.id} className="bg-card border border-border rounded-md p-4 border-l-2 border-l-amber-500">
                    <div className="flex items-start gap-2.5">
                      {reqAgent && <PixelAvatar characterIndex={reqAgent.pixelAvatarIndex} size={28} className="rounded-sm shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        {/* Title row with priority dot */}
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium">{task.title}</span>
                          <span className={cn("h-2 w-2 rounded-full shrink-0", priorityDots[task.priority] || "bg-zinc-500")} title={task.priority} />
                          <span className={cn("text-[10px] font-medium uppercase tracking-wide", priorityColors[task.priority] || "text-muted-foreground")}>{task.priority}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          From {task.requestedBy}{reqAgent ? ` (${dbAgents.find((a) => a.name === task.requestedBy)?.role || ""})` : ""}
                        </p>

                        {/* WHY section */}
                        <div className="mt-2.5 bg-amber-500/5 border border-amber-500/10 rounded px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400 mb-0.5">Why this needs you</p>
                          <p className="text-xs text-foreground/80">{task.description}</p>
                        </div>

                        {/* Step-by-step instructions */}
                        {steps.length > 0 && (
                          <div className="mt-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Steps</p>
                            <ol className="space-y-1">
                              {steps.map((step, i) => {
                                const stepText = step.replace(/^\d+\.\s*/, "")
                                return (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="h-5 w-5 rounded-full bg-muted text-[11px] font-medium flex items-center justify-center shrink-0 mt-px">{i + 1}</span>
                                    <span className="text-xs text-foreground/80 leading-relaxed pt-0.5">{stepText}</span>
                                  </li>
                                )
                              })}
                            </ol>
                          </div>
                        )}

                        {/* Resource links */}
                        {task.resources && task.resources.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {task.resources.map((res, i) => (
                              <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-primary/5 rounded-md px-2 py-1 transition-colors">
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                {res.label}
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border">
                          <button onClick={() => setMyTasks((p) => p.map((t) => t.id === task.id ? { ...t, resolved: true } : t))} className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                            <Check className="h-3 w-3" />Mark Done
                          </button>
                          {reqAgent && (
                            <a href={`/?dm=${reqAgent.id}`} className="h-7 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1.5">
                              <MessageSquare className="h-3 w-3" />Ask {task.requestedBy}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!showMyTasks && unresolvedOwner.length > 0 && (
          <div className="px-6 py-2 border-b border-border">
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1" onClick={() => setShowMyTasks(true)}>
              <Bell className="h-3 w-3 text-red-400" />{unresolvedOwner.length} tasks assigned to you
            </button>
          </div>
        )}

        {/* New Task Form */}
        {showNewTask && (
          <div className="px-6 py-4 border-b border-border">
            <div className="bg-card border border-border rounded-md p-4 space-y-3">
              <p className="section-label">New Task</p>
              <input placeholder="Task title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
              <textarea placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
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
              <div className="flex gap-2">
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
          <div className="px-6 py-1.5 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-2">
            <Link2 className="h-3 w-3 text-blue-400" />
            <span className="text-[11px] text-blue-400 font-medium">
              Linking mode — click a task to mark it as blocked by &ldquo;{filteredTasks.find((t) => t.id === linkingFrom)?.title ?? "selected task"}&rdquo;
            </span>
            <button onClick={() => setLinkingFrom(null)} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <X className="h-3 w-3" />Cancel
            </button>
          </div>
        )}

        {/* Kanban Board */}
        <div className={cn("flex-1 overflow-x-auto", linkingFrom && "cursor-crosshair")}>
          <div className="flex gap-px bg-border min-w-max h-full">
            {columns.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id)
              return (
                <div key={col.id} className="w-60 flex flex-col shrink-0 bg-background">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                    <span className="section-label">{col.label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums bg-muted rounded-sm px-1 py-0.5">{colTasks.length}</span>
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
      </div>
    </div>
  )
}
