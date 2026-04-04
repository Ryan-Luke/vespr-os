"use client"

import { useState, useEffect } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2, MessageSquare, FileText, AlertCircle, Zap, Brain,
  Clock, Search,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DecisionEntry {
  id: string
  agentId: string | null
  agentName: string
  actionType: string
  title: string
  description: string
  reasoning: string | null
  outcome: string | null
  createdAt: string
}

interface DBAgent { id: string; name: string; pixelAvatarIndex: number }

const ACTION_ICONS: Record<string, React.ReactNode> = {
  task_completed: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  message_sent: <MessageSquare className="h-3.5 w-3.5 text-blue-500" />,
  sop_updated: <FileText className="h-3.5 w-3.5 text-blue-400" />,
  approval_requested: <AlertCircle className="h-3.5 w-3.5 text-amber-500" />,
  decision_made: <Brain className="h-3.5 w-3.5 text-violet-500" />,
  integration_call: <Zap className="h-3.5 w-3.5 text-cyan-500" />,
}

const ACTION_LABELS: Record<string, string> = {
  task_completed: "Task",
  message_sent: "Message",
  sop_updated: "SOP",
  approval_requested: "Approval",
  decision_made: "Decision",
  integration_call: "Integration",
}

export default function DecisionsPage() {
  const [entries, setEntries] = useState<DecisionEntry[]>([])
  const [agents, setAgents] = useState<DBAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterAgent, setFilterAgent] = useState("all")
  const [filterType, setFilterType] = useState("all")

  useEffect(() => {
    Promise.all([
      fetch("/api/decisions?limit=100").then((r) => r.json()),
      fetch("/api/chat-data").then((r) => r.json()),
    ]).then(([decisions, chatData]) => {
      setEntries(decisions)
      setAgents(chatData.agents)
      setLoading(false)
    })
  }, [])

  const filtered = entries.filter((e) => {
    if (filterAgent !== "all" && e.agentId !== filterAgent) return false
    if (filterType !== "all" && e.actionType !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      return e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.agentName.toLowerCase().includes(q)
    }
    return true
  })

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 60) return `${min}m`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h`
    return `${Math.floor(hr / 24)}d`
  }

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Decisions</h1>
        <span className="text-xs text-muted-foreground tabular-nums">{entries.length} entries</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input placeholder="Search decisions..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-8 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
        </div>
        <Select value={filterAgent} onValueChange={(v) => setFilterAgent(v ?? "all")}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v ?? "all")}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Entries */}
      {loading ? (
        <div className="text-center py-16 text-xs text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-xs text-muted-foreground">{entries.length === 0 ? "No decisions logged yet." : "No matching entries."}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md divide-y divide-border">
          {filtered.map((entry) => {
            const agent = agents.find((a) => a.id === entry.agentId)
            const icon = ACTION_ICONS[entry.actionType] ?? <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            return (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors">
                <div className="mt-0.5 shrink-0 w-4 flex justify-center">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px]"><span className="font-medium">{entry.title}</span></p>
                  <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                  {entry.reasoning && <p className="text-xs text-muted-foreground mt-1 italic">{entry.reasoning}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {agent && <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={18} className="rounded-sm" />}
                  <span className="text-xs text-muted-foreground tabular-nums">{timeAgo(entry.createdAt)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
