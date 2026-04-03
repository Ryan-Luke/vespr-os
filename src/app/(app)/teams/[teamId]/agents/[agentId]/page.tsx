"use client"

import { useState, useEffect, use } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PixelAvatar } from "@/components/pixel-avatar"
import { StatusDot } from "@/components/status-dot"
import type { AgentStatus } from "@/lib/types"
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
    ]).then(([agents, agentSops, agentMilestones, fb, decs]) => {
      setAgent(agents.find((a: DBAgent) => a.id === agentId) || null)
      setSops(agentSops)
      setMilestones(Array.isArray(agentMilestones) ? agentMilestones : [])
      setFeedback(fb)
      setDecisions(Array.isArray(decs) ? decs : [])
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
      <div className="p-6 space-y-6 max-w-4xl">
        <Link href="/teams" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Back to Teams
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4">
          <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={72} className="rounded-xl border border-border" />
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold">{agent.name}</h1>
              <StatusDot status={agent.status as AgentStatus} showLabel />
              {agent.isTeamLead && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30"><Crown className="h-3 w-3 mr-1" />Team Lead</Badge>}
              <Badge variant="secondary" className={cn("text-xs", agent.autonomyLevel === "full_auto" && "bg-green-500/10 text-green-600", agent.autonomyLevel === "manual" && "bg-orange-500/10 text-orange-600")}>
                {agent.autonomyLevel === "full_auto" ? "Full Auto" : agent.autonomyLevel === "supervised" ? "Supervised" : "Manual"}
              </Badge>
            </div>
            <p className="text-muted-foreground">{agent.role}</p>

            {/* Level bar */}
            <div className="mt-2 max-w-xs">
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="font-medium">Lv.{agent.level ?? 1} {levelTitle(agent.level ?? 1)}</span>
                <span className="text-muted-foreground">{agent.xp ?? 0} / {nextLevelXp} XP</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/chat"><Button variant="outline" size="sm"><MessageSquare className="h-4 w-4 mr-1" />Chat</Button></Link>
            <Button variant="outline" size="sm">
              {agent.status === "paused" ? <><Play className="h-4 w-4 mr-1" />Resume</> : <><Pause className="h-4 w-4 mr-1" />Pause</>}
            </Button>
          </div>
        </div>

        {agent.currentTask && (
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Current Task</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{agent.currentTask}</p></CardContent></Card>
        )}

        {/* Personality */}
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Personality
            </CardTitle>
          </CardHeader>
          <CardContent>
            {preset ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{preset.name}</span>
                  <Badge variant="secondary" className="text-xs">{preset.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground italic">&ldquo;{preset.speechStyle}&rdquo;</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
                  {(Object.entries(preset.traits) as [keyof PersonalityTraits, number][]).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20">{TRAIT_LABELS[key].name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${val}%` }} />
                      </div>
                      <span className="text-xs font-mono w-6 text-right">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : agent.personality ? (
              <div className="flex flex-wrap gap-1.5">
                {getTopTraits(agent.personality).map((trait) => (
                  <Badge key={trait} variant="secondary" className="text-xs">{trait}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Default personality</p>
            )}
          </CardContent>
        </Card>

        {/* Stats grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-sm text-muted-foreground">Tasks</span></div><p className="text-2xl font-bold mt-1">{(agent.tasksCompleted ?? 0).toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Cost/mo</span></div><p className="text-2xl font-bold mt-1">${(agent.costThisMonth ?? 0).toFixed(2)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><ThumbsUp className="h-4 w-4 text-green-500" /><span className="text-sm text-muted-foreground">Feedback</span></div><p className="text-2xl font-bold mt-1">{feedback ? `${feedback.positive}/${feedback.total}` : "—"}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Model</span></div><p className="text-lg font-bold mt-1">{agent.model}</p><p className="text-xs text-muted-foreground capitalize">{agent.provider}</p></CardContent></Card>
        </div>

        {/* Milestones */}
        {milestones.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />Milestones ({milestones.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {milestones.map((m) => (
                  <Badge key={m.id} variant="secondary" className="text-xs h-7 gap-1.5 px-3">
                    <span>{m.icon}</span> {m.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="sops">
          <TabsList>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="sops">SOPs ({sops.length})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="skills" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" />Skills</CardTitle></CardHeader>
              <CardContent><div className="flex flex-wrap gap-2">{(agent.skills as string[]).map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}</div></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sops" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Standard Operating Procedures</h3>
                <p className="text-xs text-muted-foreground">Step-by-step instructions for how {agent.name} does their job</p>
              </div>
              <Button size="sm" onClick={() => setShowNewSop(true)} disabled={showNewSop}><Plus className="h-3.5 w-3.5 mr-1" />Add SOP</Button>
            </div>

            {showNewSop && (
              <Card className="border-primary/30">
                <CardContent className="pt-5 space-y-3">
                  <Input placeholder="SOP Title" value={newSopTitle} onChange={(e) => setNewSopTitle(e.target.value)} />
                  <div className="flex gap-1 flex-wrap">
                    {sopCategories.map((cat) => (
                      <button key={cat.id} onClick={() => setNewSopCategory(cat.id)} className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors", newSopCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{cat.icon} {cat.label}</button>
                    ))}
                  </div>
                  <Textarea placeholder="Write step-by-step instructions..." value={newSopContent} onChange={(e) => setNewSopContent(e.target.value)} rows={6} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={createSop} disabled={!newSopTitle.trim() || !newSopContent.trim() || saving}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowNewSop(false); setNewSopTitle(""); setNewSopContent("") }}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {sops.length === 0 && !showNewSop && (
              <Card className="border-dashed"><CardContent className="pt-6 flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-30" /><p className="text-sm font-medium">No SOPs yet</p>
                <p className="text-xs mt-1">SOPs are auto-generated when {agent.name} completes tasks, or you can create them manually.</p>
              </CardContent></Card>
            )}

            {sops.map((sop) => {
              const cat = sopCategories.find((c) => c.id === sop.category)
              const isEditing = editingSop === sop.id
              return (
                <Card key={sop.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span>{cat?.icon || "📝"}</span>
                        <div>
                          <h4 className="text-sm font-semibold">{sop.title}</h4>
                          <p className="text-xs text-muted-foreground">v{sop.version} · Updated {new Date(sop.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingSop(isEditing ? null : sop.id)}>
                          <Edit3 className="h-3 w-3 mr-1" />{isEditing ? "Cancel" : "Edit"}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300" onClick={() => deleteSop(sop.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="mt-3 space-y-2">
                        <Textarea defaultValue={sop.content} id={`sop-edit-${sop.id}`} rows={8} />
                        <Button size="sm" disabled={saving} onClick={() => {
                          const el = document.getElementById(`sop-edit-${sop.id}`) as HTMLTextAreaElement
                          updateSop(sop.id, el.value)
                        }}>
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}Save
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{sop.content}</div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4" />Recent Activity</h3>
            {decisions.length === 0 ? (
              <Card className="border-dashed"><CardContent className="pt-6 flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Shield className="h-8 w-8 mb-2 opacity-30" /><p className="text-sm font-medium">No activity logged yet</p>
                <p className="text-xs mt-1">As {agent.name} works, their decisions and actions will appear here.</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {decisions.map((d) => (
                  <Card key={d.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <Zap className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{d.title}</p>
                          <p className="text-xs text-muted-foreground">{d.description}</p>
                          {d.reasoning && <p className="text-xs text-muted-foreground mt-1 italic">Reasoning: {d.reasoning}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"><Clock className="h-3 w-3" />{timeAgo(d.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">Agent Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><label className="text-sm font-medium">System Prompt</label>
                  <Textarea defaultValue={agent.systemPrompt || ""} placeholder="Custom instructions for this agent..." rows={4} /></div>
                <Button size="sm">Save Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
