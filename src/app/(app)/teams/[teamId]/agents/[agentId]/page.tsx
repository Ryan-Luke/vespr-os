"use client"

import { useState, useEffect, use } from "react"
import {} from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PixelAvatar } from "@/components/pixel-avatar"
import { PERSONALITY_PRESETS, TRAIT_LABELS, type PersonalityTraits } from "@/lib/personality-presets"
import { levelProgress, levelTitle, xpForLevel } from "@/lib/gamification"
import {
  ArrowLeft, Brain, DollarSign, CheckCircle2, Pause, Play,
  MessageSquare, Cpu, Plus, FileText, Trash2, Save, Loader2,
  Crown, Edit3, ThumbsUp, ThumbsDown, Shield, Sparkles,
  Trophy, Zap, Clock, TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getAutoApproveSettings, toggleAutoApproveSetting } from "@/components/approval-queue"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface DBAgent {
  id: string; name: string; role: string; avatar: string; pixelAvatarIndex: number
  provider: string; model: string; systemPrompt: string | null; status: string
  teamId: string | null; currentTask: string | null; skills: string[]
  personalityPresetId: string | null; personality: PersonalityTraits
  autonomyLevel: string; isTeamLead: boolean
  xp: number; level: number; streak: number
  tasksCompleted: number; costThisMonth: number
}

interface SOP {
  id: string; title: string; content: string; category: string
  sortOrder: number; version: number; updatedAt: string
}

interface Milestone {
  id: string; name: string; description: string; icon: string; unlockedAt: string
}

interface FeedbackStats {
  positive: number; negative: number; total: number
}

interface DecisionEntry {
  id: string; actionType: string; title: string; description: string
  reasoning: string | null; createdAt: string
}

const sopCategories = [
  { id: "process", label: "Process", icon: "📋" },
  { id: "tools", label: "Tools & Access", icon: "🔧" },
  { id: "escalation", label: "Escalation", icon: "⚠️" },
  { id: "reference", label: "Reference", icon: "📖" },
  { id: "general", label: "General", icon: "📝" },
]

function getTopTraits(traits: PersonalityTraits) {
  return (Object.entries(traits) as [keyof PersonalityTraits, number][])
    .map(([key, val]) => ({ key, val, distance: Math.abs(val - 50) }))
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 3)
    .map(({ key, val }) => {
      const label = TRAIT_LABELS[key]
      return val >= 50 ? label.high : label.low
    })
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function generateTrendData(agentId: string, tasksCompleted: number, xp: number, costThisMonth: number) {
  const rand = seededRandom(hashString(agentId))
  const avgTasks = Math.max(1, tasksCompleted / 30)
  const avgXp = Math.max(1, xp / 30)
  const avgCost = Math.max(0.01, costThisMonth / 30)

  const data: { day: number; label: string; tasks: number; xp: number; cost: number }[] = []
  for (let i = 0; i < 30; i++) {
    const taskJitter = 0.5 + rand() * 1.0
    const xpJitter = 0.5 + rand() * 1.0
    const costJitter = 0.5 + rand() * 1.0
    data.push({
      day: i + 1,
      label: `Day ${i + 1}`,
      tasks: Math.round(avgTasks * taskJitter),
      xp: Math.round(avgXp * xpJitter),
      cost: parseFloat((avgCost * costJitter).toFixed(2)),
    })
  }
  return data
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export default function AgentProfilePage({ params }: { params: Promise<{ teamId: string; agentId: string }> }) {
  const { agentId } = use(params)
  const [agent, setAgent] = useState<DBAgent | null>(null)
  const [sops, setSops] = useState<SOP[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [feedback, setFeedback] = useState<FeedbackStats | null>(null)
  const [decisions, setDecisions] = useState<DecisionEntry[]>([])
  const [memories, setMemories] = useState<{ id: string; memoryType: string; content: string; importance: number; createdAt: string }[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewData, setReviewData] = useState<{ rating: number; summary: string; strengths: string[]; improvements: string[]; recommendations: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingSop, setEditingSop] = useState<string | null>(null)
  const [newSopTitle, setNewSopTitle] = useState("")
  const [newSopContent, setNewSopContent] = useState("")
  const [newSopCategory, setNewSopCategory] = useState("process")
  const [showNewSop, setShowNewSop] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sopFeedback, setSopFeedback] = useState<Record<string, "positive" | "negative">>({})
  const [sopSuggestions, setSopSuggestions] = useState<Record<string, string>>({})
  const [showSuggestion, setShowSuggestion] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("bos-sop-feedback")
      if (stored) setSopFeedback(JSON.parse(stored))
    } catch {}
  }, [])

  function handleSopFeedback(sopId: string, type: "positive" | "negative") {
    const next = { ...sopFeedback, [sopId]: type }
    setSopFeedback(next)
    localStorage.setItem("bos-sop-feedback", JSON.stringify(next))
    if (type === "negative") {
      setShowSuggestion(sopId)
    } else {
      setShowSuggestion(null)
    }
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/agents").then((r) => r.json()),
      fetch(`/api/sops?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/gamification?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/feedback?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/decisions?agentId=${agentId}&limit=10`).then((r) => r.json()),
      fetch(`/api/memory?agentId=${agentId}&limit=20`).then((r) => r.json()),
    ]).then(([agents, agentSops, agentMilestones, fb, decs, mems]) => {
      setAgent(agents.find((a: DBAgent) => a.id === agentId) || null)
      setSops(agentSops)
      setMilestones(Array.isArray(agentMilestones) ? agentMilestones : [])
      setFeedback(fb)
      setDecisions(Array.isArray(decs) ? decs : [])
      setMemories(Array.isArray(mems) ? mems : [])
      setLoading(false)
    })
  }, [agentId])

  async function createSop() {
    if (!newSopTitle.trim() || !newSopContent.trim()) return
    setSaving(true)
    const sop = await fetch("/api/sops", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, title: newSopTitle, content: newSopContent, category: newSopCategory, sortOrder: sops.length }),
    }).then((r) => r.json())
    setSops((prev) => [...prev, sop])
    setNewSopTitle(""); setNewSopContent(""); setNewSopCategory("process"); setShowNewSop(false); setSaving(false)
  }

  async function updateSop(id: string, content: string) {
    setSaving(true)
    const sop = sops.find((s) => s.id === id)
    const updated = await fetch("/api/sops", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content, version: (sop?.version || 0) + 1 }),
    }).then((r) => r.json())
    setSops((prev) => prev.map((s) => s.id === id ? updated : s))
    setEditingSop(null); setSaving(false)
  }

  async function deleteSop(id: string) {
    await fetch("/api/sops", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    setSops((prev) => prev.filter((s) => s.id !== id))
  }

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading...</div>
  if (!agent) return <div className="p-6">Agent not found</div>

  const preset = agent.personalityPresetId ? PERSONALITY_PRESETS.find((p) => p.id === agent.personalityPresetId) : null
  const progress = levelProgress(agent.xp ?? 0)
  const nextLevelXp = xpForLevel((agent.level ?? 1) + 1)

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-3xl">
        <Link href="/teams" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" />Teams
        </Link>

        {/* Header */}
        <div className="flex items-start gap-3">
          <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={40} className="rounded-md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{agent.name}</h1>
              <span className={cn("h-1.5 w-1.5 rounded-full", agent.status === "working" ? "status-working" : agent.status === "error" ? "status-error" : agent.status === "paused" ? "status-paused" : "status-idle")} />
              {agent.isTeamLead && <Crown className="h-3 w-3 text-amber-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{agent.role} · {agent.model} · {agent.autonomyLevel === "full_auto" ? "Full Auto" : agent.autonomyLevel === "supervised" ? "Supervised" : "Manual"}</p>
            {/* Level */}
            <div className="mt-2 max-w-[200px]">
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-muted-foreground">Lv.{agent.level ?? 1} {levelTitle(agent.level ?? 1)}</span>
                <span className="text-muted-foreground tabular-nums">{agent.xp ?? 0}/{nextLevelXp}</span>
              </div>
              <div className="h-1 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Link href="/" className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 transition-colors"><MessageSquare className="h-3 w-3" />Chat</Link>
            <button disabled={reviewLoading} onClick={async () => { setReviewLoading(true); try { const res = await fetch("/api/performance-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId }) }); const data = await res.json(); if (data.review) setReviewData(data.review) } catch {} setReviewLoading(false) }} className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 transition-colors">
              {reviewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trophy className="h-3 w-3" />}Review
            </button>
          </div>
        </div>

        {agent.currentTask && (
          <div className="bg-card border border-border rounded-md px-4 py-3">
            <p className="section-label mb-1">Current Task</p>
            <p className="text-[13px]">{agent.currentTask}</p>
          </div>
        )}

        {/* Autonomy */}
        <div className="bg-card border border-border rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">Autonomy</p>
            <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", agent.autonomyLevel === "full_auto" ? "bg-emerald-500/10 text-emerald-400" : agent.autonomyLevel === "supervised" ? "bg-amber-500/10 text-amber-400" : "bg-muted text-muted-foreground")}>{agent.autonomyLevel === "full_auto" ? "Full Auto" : agent.autonomyLevel === "supervised" ? "Supervised" : "Manual"}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{agent.autonomyLevel === "full_auto" ? "This agent acts independently without approval." : agent.autonomyLevel === "supervised" ? "This agent requests approval for important decisions." : "All actions require manual approval."}</p>
          {(() => {
            const settings = getAutoApproveSettings()
            const actionTypes = ["task_completed", "message_sent", "sop_updated", "approval_requested", "decision_made", "integration_call"]
            const actionLabels: Record<string, string> = { task_completed: "Task completion", message_sent: "Send messages", sop_updated: "Update SOPs", approval_requested: "Sub-approvals", decision_made: "Decisions", integration_call: "Integration calls" }
            const agentRules = actionTypes.filter((t) => settings[`${agent.id}:${t}`] === true)
            return (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Auto-approved actions</p>
                {agentRules.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No auto-approve rules set. These build up as you approve actions in the queue.</p>
                ) : (
                  <div className="space-y-1">
                    {agentRules.map((type) => (
                      <div key={type} className="flex items-center justify-between py-1">
                        <span className="text-[13px] flex items-center gap-1.5"><Zap className="h-3 w-3 text-amber-400" />{actionLabels[type] || type}</span>
                        <button onClick={() => { toggleAutoApproveSetting(agent.id, type, false); setAgent({ ...agent }) }} className="text-[11px] text-red-400 hover:text-red-300 transition-colors">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Personality */}
        <div className="bg-card border border-border rounded-md p-4">
          <p className="section-label mb-2">Personality</p>
            {preset ? (
              <div>
                <p className="text-[13px] font-medium">{preset.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 italic">{preset.speechStyle}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                  {(Object.entries(preset.traits) as [keyof PersonalityTraits, number][]).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-16">{TRAIT_LABELS[key].name}</span>
                      <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : agent.personality ? (
              <div className="flex flex-wrap gap-1.5">
                {getTopTraits(agent.personality).map((trait) => (
                  <span key={trait} className="text-xs text-muted-foreground">{trait}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Default</p>
            )}
        </div>

        {/* Stats */}
        <div className="grid gap-px bg-border rounded-md overflow-hidden md:grid-cols-4">
          {[
            { label: "Tasks", value: (agent.tasksCompleted ?? 0).toLocaleString() },
            { label: "Cost/mo", value: `$${(agent.costThisMonth ?? 0).toFixed(2)}` },
            { label: "Feedback", value: feedback ? `${feedback.positive}/${feedback.total}` : "—" },
            { label: "Streak", value: (agent.streak ?? 0) > 0 ? `${agent.streak}d` : "—" },
          ].map((s) => (
            <div key={s.label} className="bg-card p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className="text-lg font-semibold tabular-nums mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Performance Review Results */}
        {reviewData && (
          <div className="bg-card border border-border rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Performance Review</p>
              <button onClick={() => setReviewData(null)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Dismiss</button>
            </div>
            {/* Rating */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Rating</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={cn("h-2.5 w-2.5 rounded-full", i <= reviewData.rating ? "bg-amber-400" : "bg-border")} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{reviewData.rating}/5</span>
            </div>
            {/* Summary */}
            <p className="text-[13px] leading-relaxed">{reviewData.summary}</p>
            {/* Strengths */}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Strengths</p>
              <ul className="space-y-1">
                {reviewData.strengths.map((s, i) => (
                  <li key={i} className="text-[13px] text-emerald-400 flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-emerald-400 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Improvements */}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Areas for Improvement</p>
              <ul className="space-y-1">
                {reviewData.improvements.map((s, i) => (
                  <li key={i} className="text-[13px] text-amber-400 flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-400 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Recommendations */}
            {reviewData.recommendations && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Recommendation</p>
                <p className="text-[13px] text-foreground/80">{reviewData.recommendations}</p>
              </div>
            )}
          </div>
        )}

        {milestones.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Milestones</span>
            {milestones.map((m) => (
              <span key={m.id} className="text-xs text-muted-foreground">{m.icon} {m.name}</span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="sops">
          <TabsList>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="sops">SOPs ({sops.length})</TabsTrigger>
            <TabsTrigger value="memory">Memory ({memories.length})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Skills */}
          <TabsContent value="skills" className="mt-4">
            <div className="bg-card border border-border rounded-md p-4">
              <p className="section-label mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">{(agent.skills as string[]).map((skill) => <span key={skill} className="text-xs text-muted-foreground bg-muted rounded-md px-2 py-0.5">{skill}</span>)}</div>
            </div>
          </TabsContent>

          {/* SOPs */}
          <TabsContent value="sops" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="section-label">Procedures</p>
              <button onClick={() => setShowNewSop(true)} disabled={showNewSop} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">+ Add SOP</button>
            </div>

            {showNewSop && (
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <input placeholder="SOP Title" value={newSopTitle} onChange={(e) => setNewSopTitle(e.target.value)} className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
                <div className="flex gap-1 flex-wrap">
                  {sopCategories.map((cat) => (
                    <button key={cat.id} onClick={() => setNewSopCategory(cat.id)} className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-colors", newSopCategory === cat.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{cat.icon} {cat.label}</button>
                  ))}
                </div>
                <textarea placeholder="Write step-by-step instructions..." value={newSopContent} onChange={(e) => setNewSopContent(e.target.value)} rows={5} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
                <div className="flex gap-2">
                  <button onClick={createSop} disabled={!newSopTitle.trim() || !newSopContent.trim() || saving} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1">
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save
                  </button>
                  <button onClick={() => { setShowNewSop(false); setNewSopTitle(""); setNewSopContent("") }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {sops.length === 0 && !showNewSop && (
              <div className="bg-muted/30 border border-dashed border-border rounded-md p-3 text-center">
                <Sparkles className="h-4 w-4 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">SOPs auto-generate as <span className="font-medium text-foreground">{agent.name}</span> completes tasks. You can also create them manually.</p>
              </div>
            )}

            {sops.map((sop) => {
              const cat = sopCategories.find((c) => c.id === sop.category)
              const isEditing = editingSop === sop.id
              const fb = sopFeedback[sop.id]
              return (
                <div key={sop.id} className="bg-card border border-border rounded-md p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{cat?.icon || "📝"}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-medium">{sop.title}</p>
                          <span className={cn("text-[10px] font-mono px-1 py-px rounded", sop.version >= 2 ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground")}>v{sop.version}</span>
                          {sop.version >= 2 && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{new Date(sop.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingSop(isEditing ? null : sop.id)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">{isEditing ? "Cancel" : "Edit"}</button>
                      <button onClick={() => deleteSop(sop.id)} className="text-[11px] text-red-400 hover:text-red-300 transition-colors ml-2">Delete</button>
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="mt-3 space-y-2">
                      <textarea defaultValue={sop.content} id={`sop-edit-${sop.id}`} rows={6} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
                      <button disabled={saving} onClick={() => { const el = document.getElementById(`sop-edit-${sop.id}`) as HTMLTextAreaElement; updateSop(sop.id, el.value) }} className="h-6 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors">Save</button>
                    </div>
                  ) : (
                    <div className="mt-2 text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed">{sop.content}</div>
                  )}
                  {/* Feedback row */}
                  {!isEditing && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>Was this SOP helpful?</span>
                        <button onClick={() => handleSopFeedback(sop.id, "positive")} className={cn("h-5 w-5 rounded flex items-center justify-center transition-colors", fb === "positive" ? "bg-emerald-500/20 text-emerald-400" : "bg-muted/50 hover:bg-muted")}>
                          <ThumbsUp className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleSopFeedback(sop.id, "negative")} className={cn("h-5 w-5 rounded flex items-center justify-center transition-colors", fb === "negative" ? "bg-red-500/20 text-red-400" : "bg-muted/50 hover:bg-muted")}>
                          <ThumbsDown className="h-3 w-3" />
                        </button>
                      </div>
                      {showSuggestion === sop.id && fb === "negative" && (
                        <div className="flex gap-2">
                          <textarea placeholder="What should change?" value={sopSuggestions[sop.id] || ""} onChange={(e) => setSopSuggestions((prev) => ({ ...prev, [sop.id]: e.target.value }))} rows={2} className="flex-1 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
                          <button onClick={() => { setShowSuggestion(null); setSopSuggestions((prev) => ({ ...prev, [sop.id]: "" })) }} disabled={!sopSuggestions[sop.id]?.trim()} className="self-end h-6 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">Suggest</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </TabsContent>

          {/* Memory */}
          <TabsContent value="memory" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="section-label">Memory</p>
              {memories.length > 0 && <span className="text-[11px] text-muted-foreground">{memories.length} entries</span>}
            </div>
            {memories.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No memories yet. They build up through conversations and feedback.</p>
              </div>
            ) : (
              <>
                {/* Memory type breakdown */}
                <div className="grid gap-px bg-border rounded-md overflow-hidden grid-cols-4">
                  {(["short_term", "long_term", "shared", "skill"] as const).map((type) => {
                    const count = memories.filter((m) => m.memoryType === type).length
                    const labels: Record<string, { label: string; icon: string }> = {
                      short_term: { label: "Short-term", icon: "⚡" },
                      long_term: { label: "Long-term", icon: "🧠" },
                      shared: { label: "Shared", icon: "🔗" },
                      skill: { label: "Skill", icon: "🎯" },
                    }
                    const info = labels[type] || { label: type, icon: "💭" }
                    return (
                      <div key={type} className="bg-card px-3 py-2.5">
                        <p className="text-[11px] text-muted-foreground">{info.icon} {info.label}</p>
                        <p className="text-sm font-semibold tabular-nums">{count}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Memory entries grouped by type */}
                {(["short_term", "long_term", "shared", "skill"] as const).map((type) => {
                  const typeMemories = memories.filter((m) => m.memoryType === type)
                  if (typeMemories.length === 0) return null
                  const typeLabels: Record<string, string> = { short_term: "Short-term Memory", long_term: "Long-term Memory", shared: "Shared Memory", skill: "Skill Memory" }
                  return (
                    <div key={type}>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">{typeLabels[type] || type}</p>
                      <div className="bg-card border border-border rounded-md divide-y divide-border">
                        {typeMemories.map((mem) => (
                          <div key={mem.id} className="flex items-start gap-3 px-4 py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] leading-relaxed">{mem.content}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex gap-px">
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <div key={i} className={cn("h-1.5 w-1.5 rounded-full", i <= Math.ceil(mem.importance * 5) ? "bg-primary" : "bg-border")} />
                                ))}
                              </div>
                              <span className="text-[11px] text-muted-foreground tabular-nums">{timeAgo(mem.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="mt-4 space-y-3">
            <p className="section-label">Activity</p>
            {decisions.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">No activity logged yet.</div>
            ) : (
              <div className="bg-card border border-border rounded-md divide-y divide-border">
                {decisions.map((d) => (
                  <div key={d.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <Zap className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.description}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{timeAgo(d.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Performance */}
          <TabsContent value="performance" className="mt-4 space-y-3">
            {(() => {
              const trendData = generateTrendData(
                agent.id,
                agent.tasksCompleted ?? 0,
                agent.xp ?? 0,
                agent.costThisMonth ?? 0,
              )
              const avgTasks = (trendData.reduce((s, d) => s + d.tasks, 0) / trendData.length).toFixed(1)
              const totalXp = trendData.reduce((s, d) => s + d.xp, 0)
              const firstHalfCost = trendData.slice(0, 15).reduce((s, d) => s + d.cost, 0)
              const secondHalfCost = trendData.slice(15).reduce((s, d) => s + d.cost, 0)
              const costTrendPct = firstHalfCost > 0 ? ((secondHalfCost - firstHalfCost) / firstHalfCost) * 100 : 0
              const costTrendUp = costTrendPct >= 0

              return (
                <>
                  <div className="grid grid-cols-3 gap-px bg-border rounded-md overflow-hidden">
                    <div className="bg-card p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Avg tasks/day</p>
                      <p className="text-lg font-semibold tabular-nums mt-0.5">{avgTasks}</p>
                    </div>
                    <div className="bg-card p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">XP this month</p>
                      <p className="text-lg font-semibold tabular-nums mt-0.5">{totalXp.toLocaleString()}</p>
                    </div>
                    <div className="bg-card p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Cost trend</p>
                      <p className={cn("text-lg font-semibold tabular-nums mt-0.5", costTrendUp ? "text-red-400" : "text-emerald-400")}>
                        {costTrendUp ? "\u2191" : "\u2193"}{Math.abs(costTrendPct).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-md p-4">
                    <p className="section-label mb-3">30-Day Trend</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis
                          dataKey="day"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => (v % 5 === 0 ? `D${v}` : "")}
                        />
                        <YAxis
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                            fontSize: 12,
                          }}
                          labelFormatter={(v) => `Day ${v}`}
                        />
                        <Legend
                          wrapperStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <Line type="monotone" dataKey="tasks" name="Tasks" stroke="#22c55e" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="xp" name="XP" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="cost" name="Cost ($)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )
            })()}
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-4">
            <div className="bg-card border border-border rounded-md p-4 space-y-3">
              <p className="section-label">Configuration</p>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">System Prompt</label>
                <textarea defaultValue={agent.systemPrompt || ""} placeholder="Custom instructions..." rows={4} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
              </div>
              <button className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">Save</button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
