"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PixelAvatar } from "@/components/pixel-avatar"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2, MessageSquare, FileText, AlertCircle, Zap, Brain,
  Clock, Search, Shield,
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

interface DBAgent {
  id: string; name: string; pixelAvatarIndex: number
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  task_completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  message_sent: <MessageSquare className="h-4 w-4 text-blue-500" />,
  sop_updated: <FileText className="h-4 w-4 text-indigo-500" />,
  approval_requested: <AlertCircle className="h-4 w-4 text-amber-500" />,
  decision_made: <Brain className="h-4 w-4 text-purple-500" />,
  integration_call: <Zap className="h-4 w-4 text-cyan-500" />,
}

const ACTION_LABELS: Record<string, string> = {
  task_completed: "Task Completed",
  message_sent: "Message Sent",
  sop_updated: "SOP Updated",
  approval_requested: "Approval Requested",
  decision_made: "Decision Made",
  integration_call: "Integration Call",
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
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const days = Math.floor(hr / 24)
    return `${days}d ago`
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Decision Log
          </h1>
          <p className="text-sm text-muted-foreground">Full audit trail of every agent action, decision, and approval</p>
        </div>
        <Badge variant="secondary" className="text-xs">{entries.length} entries</Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search decisions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterAgent} onValueChange={(v) => setFilterAgent(v ?? "all")}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All agents" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v ?? "all")}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Decision entries */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading audit trail...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {entries.length === 0 ? "No decisions logged yet. As agents work, their actions will appear here." : "No matching entries found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const agent = agents.find((a) => a.id === entry.agentId)
            const icon = ACTION_ICONS[entry.actionType] ?? <Zap className="h-4 w-4 text-muted-foreground" />

            return (
              <Card key={entry.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{entry.title}</span>
                        <Badge variant="secondary" className="text-xs h-5">
                          {ACTION_LABELS[entry.actionType] ?? entry.actionType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                      {entry.reasoning && (
                        <div className="mt-1.5 p-2 rounded bg-muted/50 border border-border">
                          <p className="text-xs text-muted-foreground"><span className="font-medium">Reasoning:</span> {entry.reasoning}</p>
                        </div>
                      )}
                      {entry.outcome && (
                        <p className="text-xs mt-1"><span className="text-muted-foreground">Outcome:</span> {entry.outcome}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {agent && (
                        <div className="flex items-center gap-1.5">
                          <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded" />
                          <span className="text-xs text-muted-foreground">{entry.agentName}</span>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
