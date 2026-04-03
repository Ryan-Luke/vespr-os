"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PixelAvatar } from "@/components/pixel-avatar"
import { agents, teams } from "@/lib/mock-data"
import {
  Plus,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Bell,
  Upload,
  Check,
  MessageSquare,
  User,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

type TaskPriority = "urgent" | "high" | "medium" | "low"
type TaskColumnStatus = "backlog" | "todo" | "in_progress" | "review" | "done"

interface Task {
  id: string
  title: string
  description: string
  assignedAgentId: string
  teamId: string
  status: TaskColumnStatus
  priority: TaskPriority
  createdAt: Date
  isOwnerTask?: boolean
  ownerInstructions?: string
  requestedBy?: string
  resolved?: boolean
}

const columns: { id: TaskColumnStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "backlog", label: "Backlog", icon: <Clock className="h-3.5 w-3.5" />, color: "text-muted-foreground" },
  { id: "todo", label: "To Do", icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-blue-400" },
  { id: "in_progress", label: "In Progress", icon: <Loader2 className="h-3.5 w-3.5" />, color: "text-yellow-400" },
  { id: "review", label: "Review", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-purple-400" },
  { id: "done", label: "Done", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-green-400" },
]

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  high: { label: "High", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  medium: { label: "Medium", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  low: { label: "Low", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
}

const initialTasks: Task[] = [
  { id: "t1", title: "Write Q1 growth blog post", description: "Draft and publish blog post on AI in small business operations", assignedAgentId: "a1", teamId: "t1", status: "in_progress", priority: "high", createdAt: new Date(Date.now() - 86400000 * 2) },
  { id: "t2", title: "SEO audit for blog content", description: "Analyze top 20 blog posts for keyword optimization opportunities", assignedAgentId: "a2", teamId: "t1", status: "todo", priority: "medium", createdAt: new Date(Date.now() - 86400000 * 3) },
  { id: "t3", title: "Schedule Instagram content", description: "Plan and schedule 15 Instagram posts for next week", assignedAgentId: "a3", teamId: "t1", status: "in_progress", priority: "medium", createdAt: new Date(Date.now() - 86400000) },
  { id: "t4", title: "Research fintech prospects", description: "Find 50 qualified prospects in fintech vertical matching ICP", assignedAgentId: "a4", teamId: "t2", status: "in_progress", priority: "urgent", createdAt: new Date(Date.now() - 86400000 * 4) },
  { id: "t5", title: "Create outreach sequences", description: "Build personalized 5-step email sequences for fintech prospects", assignedAgentId: "a5", teamId: "t2", status: "todo", priority: "high", createdAt: new Date(Date.now() - 86400000 * 2) },
  { id: "t6", title: "Sync new leads to GHL", description: "Import and enrich all new prospects in CRM with tags", assignedAgentId: "a6", teamId: "t2", status: "done", priority: "medium", createdAt: new Date(Date.now() - 86400000 * 5) },
  { id: "t7", title: "Build invoice processing workflow", description: "Create n8n automation for scanning and categorizing invoices", assignedAgentId: "a7", teamId: "t3", status: "in_progress", priority: "high", createdAt: new Date(Date.now() - 86400000 * 3) },
  { id: "t8", title: "Document onboarding SOP", description: "Create step-by-step onboarding process documentation", assignedAgentId: "a8", teamId: "t3", status: "backlog", priority: "low", createdAt: new Date(Date.now() - 86400000 * 7) },
  { id: "t9", title: "Reconcile March transactions", description: "Match all March bank transactions with QuickBooks entries", assignedAgentId: "a9", teamId: "t4", status: "done", priority: "medium", createdAt: new Date(Date.now() - 86400000 * 6) },
  { id: "t10", title: "Generate Q1 P&L report", description: "Compile financial data and create Q1 profit & loss statement", assignedAgentId: "a10", teamId: "t4", status: "todo", priority: "urgent", createdAt: new Date(Date.now() - 86400000) },
  { id: "t11", title: "Clear support ticket backlog", description: "Resolve remaining 23 open support tickets from this week", assignedAgentId: "a11", teamId: "t5", status: "in_progress", priority: "high", createdAt: new Date(Date.now() - 86400000 * 2) },
  { id: "t12", title: "Track delayed shipments", description: "Monitor and update customers on 5 delayed FedEx shipments", assignedAgentId: "a12", teamId: "t5", status: "in_progress", priority: "medium", createdAt: new Date(Date.now() - 86400000) },
  { id: "t13", title: "Create LinkedIn content series", description: "Plan 10-part LinkedIn post series on business automation", assignedAgentId: "a3", teamId: "t1", status: "backlog", priority: "medium", createdAt: new Date(Date.now() - 86400000 * 4) },
  { id: "t14", title: "A/B test email subject lines", description: "Test 5 subject line variants for the fintech outreach campaign", assignedAgentId: "a5", teamId: "t2", status: "review", priority: "medium", createdAt: new Date(Date.now() - 86400000 * 3) },
  { id: "t15", title: "Weekly performance report", description: "Compile all team KPIs into weekly executive summary", assignedAgentId: "a7", teamId: "t3", status: "done", priority: "medium", createdAt: new Date(Date.now() - 86400000 * 5) },
  { id: "t16", title: "Process customer refund #4521", description: "Handle refund request for delayed shipment Order #ORD-8834", assignedAgentId: "a11", teamId: "t5", status: "review", priority: "urgent", createdAt: new Date(Date.now() - 86400000) },
]

const ownerTasks: Task[] = [
  {
    id: "ot1",
    title: "Upload March bank statement",
    description: "I need the March bank statement to complete the Q1 P&L report. Please upload the PDF from your bank portal or grant me access to the banking integration.",
    assignedAgentId: "owner",
    teamId: "t4",
    status: "todo",
    priority: "urgent",
    createdAt: new Date(Date.now() - 86400000),
    isOwnerTask: true,
    ownerInstructions: "Go to your bank portal → Statements → Download March 2026 → Upload here as PDF",
    requestedBy: "Morgan",
  },
  {
    id: "ot2",
    title: "Approve ad creative variations",
    description: "I've created 3 new ad copy variations for the Section 8 campaign. Need your approval before we can scale spend. Drafts are attached.",
    assignedAgentId: "owner",
    teamId: "t1",
    status: "todo",
    priority: "high",
    createdAt: new Date(Date.now() - 86400000 * 0.5),
    isOwnerTask: true,
    ownerInstructions: "Review the 3 variations below and approve, request changes, or reject each one.",
    requestedBy: "Maya",
  },
  {
    id: "ot3",
    title: "Confirm refund for Order #ORD-8834",
    description: "Customer #4521 is requesting a full refund ($189) for a delayed shipment. The package was 5 days late due to weather. I recommend approving — customer has been with us for 2 years.",
    assignedAgentId: "owner",
    teamId: "t5",
    status: "todo",
    priority: "urgent",
    createdAt: new Date(Date.now() - 86400000 * 0.3),
    isOwnerTask: true,
    ownerInstructions: "Approve full refund ($189), approve partial refund, or deny with reason.",
    requestedBy: "Casey",
  },
  {
    id: "ot4",
    title: "Set daily ad spend budget",
    description: "We're ready to scale the Section 8 ads. Current metrics support 4-5 calls/day at $140/call with 3-4X ROAS. Need you to confirm the daily spend limit so I can adjust the campaigns.",
    assignedAgentId: "owner",
    teamId: "t1",
    status: "todo",
    priority: "high",
    createdAt: new Date(Date.now() - 86400000 * 0.2),
    isOwnerTask: true,
    ownerInstructions: "Reply with your preferred daily spend amount (e.g., $500/day, $1000/day).",
    requestedBy: "Zara",
  },
  {
    id: "ot5",
    title: "Review and approve outreach sequences",
    description: "I've drafted 5-step personalized email sequences for the 23 fintech prospects. Wanted you to review before we start sending — especially the value prop in email #1.",
    assignedAgentId: "owner",
    teamId: "t2",
    status: "todo",
    priority: "medium",
    createdAt: new Date(Date.now() - 86400000 * 1.5),
    isOwnerTask: true,
    ownerInstructions: "Read through the 5 emails, approve or suggest edits. Pay attention to email #1 opening.",
    requestedBy: "Riley",
    resolved: true,
  },
]

function OwnerTaskCard({ task, onResolve }: { task: Task; onResolve: (id: string) => void }) {
  const requestedByAgent = agents.find((a) => a.name === task.requestedBy)
  const priority = priorityConfig[task.priority]
  const [response, setResponse] = useState("")
  const [showResponse, setShowResponse] = useState(false)

  return (
    <Card className={cn("p-4 border-l-4 transition-colors", task.resolved ? "opacity-50 border-l-green-500" : priority.color.includes("red") ? "border-l-red-500" : priority.color.includes("orange") ? "border-l-orange-500" : "border-l-blue-500")}>
      <div className="flex items-start gap-3">
        {requestedByAgent && (
          <PixelAvatar characterIndex={requestedByAgent.pixelAvatarIndex} size={36} className="rounded-lg border border-border shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold">{task.title}</h3>
            <Badge variant="outline" className={cn("text-xs h-5 border", priority.color)}>{priority.label}</Badge>
            {task.resolved && <Badge variant="secondary" className="text-xs h-5 bg-green-500/10 text-green-400"><Check className="h-3 w-3 mr-0.5" />Resolved</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Requested by <span className="font-medium text-foreground">{task.requestedBy}</span>
            {" · "}{Math.round((Date.now() - task.createdAt.getTime()) / 3600000)}h ago
          </p>
          <p className="text-sm mt-2 leading-relaxed">{task.description}</p>

          {task.ownerInstructions && (
            <div className="mt-3 p-2.5 rounded-md bg-primary/5 border border-primary/10">
              <p className="text-xs font-medium text-primary mb-1">What's needed from you:</p>
              <p className="text-xs text-foreground/80">{task.ownerInstructions}</p>
            </div>
          )}

          {!task.resolved && (
            <div className="mt-3 space-y-2">
              {showResponse ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Type your response, instructions, or decision..."
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => { onResolve(task.id); setShowResponse(false) }}>
                      <Check className="h-3 w-3 mr-1" />
                      Submit & Resolve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <Upload className="h-3 w-3 mr-1" />
                      Attach File
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowResponse(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => setShowResponse(true)}>
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Respond
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onResolve(task.id)}>
                    <Check className="h-3 w-3 mr-1" />
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    <Upload className="h-3 w-3 mr-1" />
                    Upload
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function TaskCard({ task, onMoveLeft, onMoveRight }: { task: Task; onMoveLeft?: () => void; onMoveRight?: () => void }) {
  const agent = agents.find((a) => a.id === task.assignedAgentId)
  const team = teams.find((t) => t.id === task.teamId)
  const priority = priorityConfig[task.priority]

  return (
    <Card className="p-3 hover:border-primary/30 transition-colors group cursor-default">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{task.title}</p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("text-xs h-5 border", priority.color)}>{priority.label}</Badge>
          {team && <span className="text-xs text-muted-foreground">{team.icon}</span>}
        </div>
        {agent && (
          <div className="flex items-center gap-1.5" title={`${agent.name} — ${agent.role}`}>
            <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded" />
            <span className="text-xs text-muted-foreground">{agent.name}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onMoveLeft} disabled={!onMoveLeft}>
          <ChevronLeft className="h-3 w-3 mr-0.5" />Move
        </Button>
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onMoveRight} disabled={!onMoveRight}>
          Move<ChevronRight className="h-3 w-3 ml-0.5" />
        </Button>
      </div>
    </Card>
  )
}

export default function TasksPage() {
  const [tasks, setTasks] = useState(initialTasks)
  const [myTasks, setMyTasks] = useState(ownerTasks)
  const [filterTeam, setFilterTeam] = useState<string | null>(null)
  const [filterAgent, setFilterAgent] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showMyTasks, setShowMyTasks] = useState(true)

  const unresolvedOwnerTasks = myTasks.filter((t) => !t.resolved)

  const filteredTasks = tasks.filter((t) => {
    if (filterTeam && t.teamId !== filterTeam) return false
    if (filterAgent && t.assignedAgentId !== filterAgent) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function moveTask(taskId: string, direction: "left" | "right") {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t
      const colIndex = columns.findIndex((c) => c.id === t.status)
      const newIndex = direction === "left" ? colIndex - 1 : colIndex + 1
      if (newIndex < 0 || newIndex >= columns.length) return t
      return { ...t, status: columns[newIndex].id }
    }))
  }

  function resolveOwnerTask(taskId: string) {
    setMyTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, resolved: true } : t))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Task Board</h1>
          <p className="text-sm text-muted-foreground">{filteredTasks.length} tasks · {unresolvedOwnerTasks.length} assigned to you</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs w-40" />
          <Button size="sm" className="h-8"><Plus className="h-3.5 w-3.5 mr-1" />New Task</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-border shrink-0 overflow-x-auto">
        <span className="text-xs text-muted-foreground font-medium shrink-0">Team:</span>
        <button onClick={() => { setFilterTeam(null); setFilterAgent(null) }} className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0", !filterTeam && !filterAgent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>All</button>
        {teams.map((team) => (
          <button key={team.id} onClick={() => { setFilterTeam(filterTeam === team.id ? null : team.id); setFilterAgent(null) }} className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0", filterTeam === team.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{team.icon} {team.name}</button>
        ))}

        <div className="w-px h-4 bg-border mx-1" />

        <span className="text-xs text-muted-foreground font-medium shrink-0">Agent:</span>
        {(filterTeam ? agents.filter((a) => a.teamId === filterTeam) : agents).map((agent) => (
          <button key={agent.id} onClick={() => setFilterAgent(filterAgent === agent.id ? null : agent.id)} className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors shrink-0", filterAgent === agent.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
            <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={14} className="rounded-sm" />
            {agent.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* My Tasks */}
        {unresolvedOwnerTasks.length > 0 && showMyTasks && (
          <div className="px-6 py-4 border-b border-border bg-red-500/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-400" />
                <h2 className="text-sm font-bold">My Tasks</h2>
                <Badge variant="destructive" className="text-xs h-5">{unresolvedOwnerTasks.length}</Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowMyTasks(false)}>
                <X className="h-3 w-3 mr-1" />Hide
              </Button>
            </div>
            <div className="space-y-3">
              {myTasks.filter((t) => !t.resolved).map((task) => (
                <OwnerTaskCard key={task.id} task={task} onResolve={resolveOwnerTask} />
              ))}
            </div>
          </div>
        )}

        {!showMyTasks && unresolvedOwnerTasks.length > 0 && (
          <div className="px-6 py-2 border-b border-border">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowMyTasks(true)}>
              <Bell className="h-3 w-3 mr-1 text-red-400" />
              {unresolvedOwnerTasks.length} items assigned to you — Show
            </Button>
          </div>
        )}

        {/* Kanban Board */}
        <div className="p-6 overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {columns.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id)
              const colIndex = columns.indexOf(col)
              return (
                <div key={col.id} className="w-64 flex flex-col shrink-0">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={col.color}>{col.icon}</span>
                      <h3 className="text-sm font-semibold">{col.label}</h3>
                      <span className="text-xs text-muted-foreground font-mono bg-muted rounded-full h-5 min-w-5 flex items-center justify-center px-1.5">{colTasks.length}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((task) => (
                      <TaskCard key={task.id} task={task}
                        onMoveLeft={colIndex > 0 ? () => moveTask(task.id, "left") : undefined}
                        onMoveRight={colIndex < columns.length - 1 ? () => moveTask(task.id, "right") : undefined}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border p-6 flex items-center justify-center text-muted-foreground">
                        <p className="text-xs">No tasks</p>
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
