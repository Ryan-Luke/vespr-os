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
  Trophy, Zap, Clock,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

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
  const [loading, setLoading] = useState(true)
  const [editingSop, setEditingSop] = useState<string | null>(null)
  const [newSopTitle, setNewSopTitle] = useState("")
  const [newSopContent, setNewSopContent] = useState("")
  const [newSopCategory, setNewSopCategory] = useState("process")
  const [showNewSop, setShowNewSop] = useState(false)
  const [saving, setSaving] = useState(false)

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
            <button disabled={reviewLoading} onClick={async () => { setReviewLoading(true); try { await fetch("/api/performance-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId }) }) } catch {} setReviewLoading(false) }} className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 transition-colors">
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
              <div className="text-center py-8 text-xs text-muted-foreground">No SOPs yet. They auto-generate as {agent.name} completes tasks.</div>
            )}

            {sops.map((sop) => {
              const cat = sopCategories.find((c) => c.id === sop.category)
              const isEditing = editingSop === sop.id
              return (
                <div key={sop.id} className="bg-card border border-border rounded-md p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{cat?.icon || "📝"}</span>
                      <div>
                        <p className="text-[13px] font-medium">{sop.title}</p>
                        <p className="text-[11px] text-muted-foreground">v{sop.version} · {new Date(sop.updatedAt).toLocaleDateString()}</p>
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
                </div>
              )
            })}
          </TabsContent>

          {/* Memory */}
          <TabsContent value="memory" className="mt-4 space-y-3">
            <p className="section-label">Memory</p>
            {memories.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">No memories yet. They build up through conversations and feedback.</div>
            ) : (
              <div className="bg-card border border-border rounded-md divide-y divide-border">
                {memories.map((mem) => (
                  <div key={mem.id} className="flex items-start gap-2 px-4 py-2.5">
                    <span className="text-[11px] text-muted-foreground capitalize shrink-0 w-16">{mem.memoryType}</span>
                    <p className="text-[13px] flex-1">{mem.content}</p>
                    <div className="w-10 h-1 rounded-full bg-border overflow-hidden shrink-0 mt-1.5">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${mem.importance * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
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
