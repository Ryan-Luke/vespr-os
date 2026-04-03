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
import {
  ArrowLeft, Brain, DollarSign, CheckCircle2, Pause, Play,
  MessageSquare, Cpu, Plus, FileText, Trash2, Save, Loader2,
  Crown, Edit3,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface DBAgent {
  id: string; name: string; role: string; avatar: string; pixelAvatarIndex: number
  provider: string; model: string; systemPrompt: string | null; status: string
  teamId: string | null; currentTask: string | null; skills: string[]
  isTeamLead: boolean; tasksCompleted: number; costThisMonth: number
}

interface SOP {
  id: string; title: string; content: string; category: string
  sortOrder: number; version: number; updatedAt: string
}

const sopCategories = [
  { id: "process", label: "Process", icon: "📋" },
  { id: "tools", label: "Tools & Access", icon: "🔧" },
  { id: "escalation", label: "Escalation", icon: "⚠️" },
  { id: "reference", label: "Reference", icon: "📖" },
  { id: "general", label: "General", icon: "📝" },
]

export default function AgentProfilePage({ params }: { params: Promise<{ teamId: string; agentId: string }> }) {
  const { agentId } = use(params)
  const [agent, setAgent] = useState<DBAgent | null>(null)
  const [sops, setSops] = useState<SOP[]>([])
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
    ]).then(([agents, agentSops]) => {
      setAgent(agents.find((a: DBAgent) => a.id === agentId) || null)
      setSops(agentSops)
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-4xl">
        <Link href="/teams" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Back to Teams
        </Link>

        <div className="flex items-start gap-4">
          <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={64} className="rounded-xl border border-border" />
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{agent.name}</h1>
              <StatusDot status={agent.status as AgentStatus} showLabel />
              {agent.isTeamLead && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30"><Crown className="h-3 w-3 mr-1" />Team Lead</Badge>}
            </div>
            <p className="text-muted-foreground">{agent.role}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><MessageSquare className="h-4 w-4 mr-1" />Chat</Button>
            <Button variant="outline" size="sm">
              {agent.status === "paused" ? <><Play className="h-4 w-4 mr-1" />Resume</> : <><Pause className="h-4 w-4 mr-1" />Pause</>}
            </Button>
          </div>
        </div>

        {agent.currentTask && (
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Current Task</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{agent.currentTask}</p></CardContent></Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Tasks Completed</span></div><p className="text-2xl font-bold mt-1">{agent.tasksCompleted.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Cost This Month</span></div><p className="text-2xl font-bold mt-1">${agent.costThisMonth.toFixed(2)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Model</span></div><p className="text-lg font-bold mt-1">{agent.model}</p><p className="text-xs text-muted-foreground capitalize">{agent.provider}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="sops">
          <TabsList>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="sops">SOPs ({sops.length})</TabsTrigger>
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
                  <Input placeholder="SOP Title (e.g., 'How to Process Invoices')" value={newSopTitle} onChange={(e) => setNewSopTitle(e.target.value)} />
                  <div className="flex gap-1">
                    {sopCategories.map((cat) => (
                      <button key={cat.id} onClick={() => setNewSopCategory(cat.id)} className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors", newSopCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{cat.icon} {cat.label}</button>
                    ))}
                  </div>
                  <Textarea placeholder={`Write step-by-step instructions...\n\nExample:\n1. Check email inbox for new invoices\n2. Download and categorize by vendor\n3. Log into QuickBooks → Expenses → New\n4. Enter amount, vendor, category, date\n5. Pay with company Amex ending in 4521\n6. Mark as paid in tracking sheet`} value={newSopContent} onChange={(e) => setNewSopContent(e.target.value)} rows={8} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={createSop} disabled={!newSopTitle.trim() || !newSopContent.trim() || saving}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}Save SOP
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowNewSop(false); setNewSopTitle(""); setNewSopContent("") }}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {sops.length === 0 && !showNewSop && (
              <Card className="border-dashed"><CardContent className="pt-6 flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-30" /><p className="text-sm font-medium">No SOPs yet</p>
                <p className="text-xs mt-1">Create step-by-step procedures for {agent.name}</p>
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
