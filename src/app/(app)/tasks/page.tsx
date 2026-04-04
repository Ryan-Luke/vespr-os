"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PixelAvatar } from "@/components/pixel-avatar"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Plus, Clock, CheckCircle2, Loader2, AlertCircle,
  ChevronRight, ChevronLeft, Bell, Upload, Check,
  MessageSquare, X, Save, Search,
} from "lucide-react"
import { cn } from "@/lib/utils"

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

// Owner tasks (agents delegate to you)
const ownerTasks = [
  { id: "ot1", title: "Upload March bank statement", description: "I need the March bank statement to complete the Q1 P&L report. Please upload the PDF from your bank portal.", instructions: "Go to your bank portal → Statements → Download March 2026 → Upload here", requestedBy: "Morgan", priority: "urgent", resolved: false },
  { id: "ot2", title: "Approve ad creative variations", description: "3 new ad copy variations for the Section 8 campaign are ready. Need your approval before we scale spend.", instructions: "Review the 3 variations and approve, request changes, or reject.", requestedBy: "Maya", priority: "high", resolved: false },
  { id: "ot3", title: "Confirm refund for Order #ORD-8834", description: "Customer #4521 requesting full refund ($189) for delayed shipment. Package was 5 days late. I recommend approving — customer has been with us 2 years.", instructions: "Approve full refund ($189), partial refund, or deny with reason.", requestedBy: "Casey", priority: "urgent", resolved: false },
  { id: "ot4", title: "Set daily ad spend budget", description: "Ready to scale Section 8 ads. Current metrics support 4-5 calls/day at $140/call with 3-4X ROAS. Need your daily spend limit.", instructions: "Reply with preferred daily spend (e.g., $500/day, $1000/day).", requestedBy: "Zara", priority: "high", resolved: false },
]

function TaskCard({ task, agents, teams, onMove }: { task: DBTask; agents: DBAgent[]; teams: DBTeam[]; onMove: (id: string, status: string) => void }) {
  const agent = task.assignedAgentId ? agents.find((a) => a.id === task.assignedAgentId) : null
  const colIndex = columns.findIndex((c) => c.id === task.status)

  return (
    <div className={cn("bg-card border border-border rounded-md p-3 group hover:border-muted-foreground/20 transition-colors", task.assignedToUser && "border-l-2 border-l-amber-500")}>
      <div className="flex items-start gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0", priorityDots[task.priority] || "bg-zinc-500")} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium leading-snug">{task.title}</p>
          {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 pl-3.5">
        <div className="flex items-center gap-2">
          {agent && (
            <div className="flex items-center gap-1">
              <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={14} className="rounded-sm" />
              <span className="text-[11px] text-muted-foreground">{agent.name}</span>
            </div>
          )}
          {task.assignedToUser && <span className="text-[11px] text-amber-400 font-medium">You</span>}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button disabled={colIndex <= 0} onClick={() => colIndex > 0 && onMove(task.id, columns[colIndex - 1].id)} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground disabled:opacity-30">
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button disabled={colIndex >= columns.length - 1} onClick={() => colIndex < columns.length - 1 && onMove(task.id, columns[colIndex + 1].id)} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground disabled:opacity-30">
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
          <button onClick={() => setShowNewTask(true)} className="h-7 px-2 rounded-md text-xs font-medium bg-primary text-primary-foreground flex items-center gap-1 hover:bg-primary/90 transition-colors"><Plus className="h-3 w-3" />New</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-border shrink-0 overflow-x-auto">
        <span className="text-xs text-muted-foreground font-medium shrink-0">Team:</span>
        <button onClick={() => { setFilterTeam(null); setFilterAgent(null) }} className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0", !filterTeam && !filterAgent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>All</button>
        {dbTeams.map((team) => (
          <button key={team.id} onClick={() => { setFilterTeam(filterTeam === team.id ? null : team.id); setFilterAgent(null) }} className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0", filterTeam === team.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{team.icon} {team.name}</button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <span className="text-xs text-muted-foreground font-medium shrink-0">Agent:</span>
        {(filterTeam ? dbAgents.filter((a) => a.teamId === filterTeam) : dbAgents).slice(0, 8).map((agent) => (
          <button key={agent.id} onClick={() => setFilterAgent(filterAgent === agent.id ? null : agent.id)} className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors shrink-0", filterAgent === agent.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
            <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={14} className="rounded-sm" />{agent.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* My Tasks */}
        {unresolvedOwner.length > 0 && showMyTasks && (
          <div className="px-6 py-4 border-b border-border bg-red-500/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-400" />
                <h2 className="text-sm font-bold">My Tasks</h2>
                <Badge variant="destructive" className="text-xs h-5">{unresolvedOwner.length}</Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowMyTasks(false)}><X className="h-3 w-3 mr-1" />Hide</Button>
            </div>
            <div className="space-y-3">
              {myTasks.filter((t) => !t.resolved).map((task) => {
                const reqAgent = dbAgents.find((a) => a.name === task.requestedBy)
                const priorityColor = priorityColors[task.priority] || "text-muted-foreground"
                return (
                  <Card key={task.id} className={cn("p-4 border-l-4", task.priority === "urgent" ? "border-l-red-500" : "border-l-orange-500")}>
                    <div className="flex items-start gap-3">
                      {reqAgent && <PixelAvatar characterIndex={reqAgent.pixelAvatarIndex} size={36} className="rounded-lg border border-border shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold">{task.title}</h3>
                          <span className={cn("text-[11px] font-medium capitalize", priorityColor)}>{task.priority}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Requested by <span className="font-medium text-foreground">{task.requestedBy}</span></p>
                        <p className="text-sm mt-2">{task.description}</p>
                        <div className="mt-2 p-2 rounded-md bg-primary/5 border border-primary/10">
                          <p className="text-xs font-medium text-primary mb-0.5">What's needed:</p>
                          <p className="text-xs text-foreground/80">{task.instructions}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => setMyTasks((p) => p.map((t) => t.id === task.id ? { ...t, resolved: true } : t))}><Check className="h-3 w-3 mr-1" />Approve</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs"><Upload className="h-3 w-3 mr-1" />Upload</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs"><MessageSquare className="h-3 w-3 mr-1" />Respond</Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {!showMyTasks && unresolvedOwner.length > 0 && (
          <div className="px-6 py-2 border-b border-border">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowMyTasks(true)}>
              <Bell className="h-3 w-3 mr-1 text-red-400" />{unresolvedOwner.length} tasks assigned to you — Show
            </Button>
          </div>
        )}

        {/* New Task Form */}
        {showNewTask && (
          <div className="px-6 py-4 border-b border-border">
            <Card className="p-4 border-primary/30 space-y-3">
              <h3 className="text-sm font-bold">Create New Task</h3>
              <Input placeholder="Task title..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-8 text-sm" />
              <Textarea placeholder="Description (optional)..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} className="text-sm" />
              <div className="grid grid-cols-3 gap-2">
                <Select value={newPriority} onValueChange={(v) => setNewPriority(v ?? "medium")}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">🔴 Urgent</SelectItem>
                    <SelectItem value="high">🟠 High</SelectItem>
                    <SelectItem value="medium">🔵 Medium</SelectItem>
                    <SelectItem value="low">⚪ Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newTeamId} onValueChange={(v) => setNewTeamId(v ?? "")}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Team" /></SelectTrigger>
                  <SelectContent>
                    {dbTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.icon} {t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newAgentId} onValueChange={(v) => setNewAgentId(v ?? "")}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assign to" /></SelectTrigger>
                  <SelectContent>
                    {(newTeamId ? dbAgents.filter((a) => a.teamId === newTeamId) : dbAgents).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={createTask} disabled={!newTitle.trim() || saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}Create Task
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewTask(false)}>Cancel</Button>
              </div>
            </Card>
          </div>
        )}

        {/* Kanban Board */}
        <div className="px-6 py-4 overflow-x-auto">
          <div className="flex gap-3 min-w-max">
            {columns.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id)
              return (
                <div key={col.id} className="w-60 flex flex-col shrink-0">
                  <div className="flex items-center gap-2 mb-2 px-0.5">
                    <span className="section-label">{col.label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((task) => <TaskCard key={task.id} task={task} agents={dbAgents} teams={dbTeams} onMove={moveTask} />)}
                    {colTasks.length === 0 && <div className="rounded-lg border border-dashed border-border p-6 flex items-center justify-center text-muted-foreground"><p className="text-xs">No tasks</p></div>}
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
