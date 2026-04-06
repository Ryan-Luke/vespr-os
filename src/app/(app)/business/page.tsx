"use client"

import { useState, useEffect } from "react"
import { Building2, Target, Users, DollarSign, Globe, Wrench, Save, Loader2, Edit3, X, FileText, ArrowRight } from "lucide-react"
import { useWorkspace } from "@/lib/workspace-context"
import Link from "next/link"

interface BusinessDocument {
  id: string
  title: string
  category: string
  createdByName: string
  createdAt: string
  tags: string[]
}

interface Workspace {
  id: string
  name: string
  slug: string
  icon: string
  description: string | null
  businessType: string
  industry: string | null
  website: string | null
  businessProfile: {
    mission?: string
    icp?: string
    verticals?: string[]
    teamSize?: string
    revenue?: string
    tools?: string[]
  }
}

const BUSINESS_TYPES = [
  { id: "agency", label: "Agency / Services" },
  { id: "saas", label: "SaaS" },
  { id: "ecommerce", label: "E-commerce / DTC" },
  { id: "info_product", label: "Info Product / Course" },
  { id: "consulting", label: "Consulting" },
  { id: "other", label: "Other" },
]

export default function BusinessPage() {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Workspace | null>(null)
  const [verticalInput, setVerticalInput] = useState("")
  const [toolInput, setToolInput] = useState("")
  const [businessDocs, setBusinessDocs] = useState<BusinessDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(true)

  useEffect(() => {
    if (activeWorkspace) {
      setWorkspace(activeWorkspace as unknown as Workspace)
      setForm(activeWorkspace as unknown as Workspace)
      setLoading(false)
    } else {
      // Still loading from context
      fetch("/api/workspaces").then((r) => r.json()).then((ws: Workspace[]) => {
        if (ws.length > 0) {
          setWorkspace(ws[0])
          setForm(ws[0])
        }
        setLoading(false)
      })
    }
  }, [activeWorkspace])

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch(`/api/workspaces/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          website: form.website,
          businessProfile: form.businessProfile,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setWorkspace(updated)
        setForm(updated)
        setEditing(false)
        await refreshWorkspaces()
      }
    } catch {}
    setSaving(false)
  }

  function addVertical() {
    if (!verticalInput.trim() || !form) return
    setForm({
      ...form,
      businessProfile: {
        ...form.businessProfile,
        verticals: [...(form.businessProfile.verticals || []), verticalInput.trim()],
      },
    })
    setVerticalInput("")
  }

  function removeVertical(v: string) {
    if (!form) return
    setForm({
      ...form,
      businessProfile: {
        ...form.businessProfile,
        verticals: (form.businessProfile.verticals || []).filter((x) => x !== v),
      },
    })
  }

  function addTool() {
    if (!toolInput.trim() || !form) return
    setForm({
      ...form,
      businessProfile: {
        ...form.businessProfile,
        tools: [...(form.businessProfile.tools || []), toolInput.trim()],
      },
    })
    setToolInput("")
  }

  function removeTool(t: string) {
    if (!form) return
    setForm({
      ...form,
      businessProfile: {
        ...form.businessProfile,
        tools: (form.businessProfile.tools || []).filter((x) => x !== t),
      },
    })
  }

  // Fetch agent-generated business documents
  useEffect(() => {
    fetch("/api/knowledge?category=business&agentOnly=true")
      .then((r) => r.json())
      .then((docs: BusinessDocument[]) => {
        setBusinessDocs(Array.isArray(docs) ? docs : [])
        setDocsLoading(false)
      })
      .catch(() => setDocsLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading...</div>
  if (!workspace || !form) return <div className="p-6 text-muted-foreground">No workspace found.</div>

  const view = editing ? form : workspace

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/15 flex items-center justify-center text-2xl shrink-0">{view.icon}</div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{view.name}</h1>
              <p className="text-xs text-muted-foreground">
                {BUSINESS_TYPES.find((t) => t.id === view.businessType)?.label || view.businessType}
                {view.industry && ` · ${view.industry}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={() => { setForm(workspace); setEditing(false) }} className="h-7 px-3 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                <button onClick={save} disabled={saving} className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="h-7 px-3 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1.5">
                <Edit3 className="h-3 w-3" />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">What we do</p>
          {editing ? (
            <textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none focus:border-muted-foreground/40 transition-colors resize-none"
              placeholder="One-line description of what your business does..."
            />
          ) : (
            <p className="text-[13px] text-foreground/80">{view.description || <span className="text-muted-foreground italic">Not set</span>}</p>
          )}
        </div>

        {/* Mission */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Mission</p>
          </div>
          {editing ? (
            <textarea
              value={form.businessProfile.mission || ""}
              onChange={(e) => setForm({ ...form, businessProfile: { ...form.businessProfile, mission: e.target.value } })}
              rows={3}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none focus:border-muted-foreground/40 transition-colors resize-none"
              placeholder="What's the mission? Why does this business exist?"
            />
          ) : (
            <p className="text-[13px] text-foreground/80 leading-relaxed">{view.businessProfile.mission || <span className="text-muted-foreground italic">Not set</span>}</p>
          )}
        </div>

        {/* ICP */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Ideal Customer Profile</p>
          </div>
          {editing ? (
            <textarea
              value={form.businessProfile.icp || ""}
              onChange={(e) => setForm({ ...form, businessProfile: { ...form.businessProfile, icp: e.target.value } })}
              rows={3}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none focus:border-muted-foreground/40 transition-colors resize-none"
              placeholder="Who is your ideal customer? Company size, industry, pain points, decision maker..."
            />
          ) : (
            <p className="text-[13px] text-foreground/80 leading-relaxed">{view.businessProfile.icp || <span className="text-muted-foreground italic">Not set</span>}</p>
          )}
        </div>

        {/* Verticals */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Verticals Served</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(view.businessProfile.verticals || []).map((v) => (
              <span key={v} className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full px-2.5 py-1">
                {v}
                {editing && (
                  <button onClick={() => removeVertical(v)} className="hover:text-red-400 ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {(view.businessProfile.verticals || []).length === 0 && !editing && <span className="text-xs text-muted-foreground italic">None set</span>}
            {editing && (
              <div className="inline-flex items-center gap-1">
                <input
                  value={verticalInput}
                  onChange={(e) => setVerticalInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVertical() } }}
                  placeholder="Add vertical..."
                  className="h-6 w-32 rounded-full border border-border bg-muted/50 px-2.5 text-xs outline-none focus:border-muted-foreground/30 transition-colors"
                />
                <button onClick={addVertical} className="text-xs text-muted-foreground hover:text-foreground">+</button>
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid gap-px bg-border rounded-md overflow-hidden md:grid-cols-3">
          <div className="bg-card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Team Size</p>
            </div>
            {editing ? (
              <input
                value={form.businessProfile.teamSize || ""}
                onChange={(e) => setForm({ ...form, businessProfile: { ...form.businessProfile, teamSize: e.target.value } })}
                className="w-full text-sm font-medium bg-transparent outline-none"
                placeholder="e.g. 14 agents"
              />
            ) : (
              <p className="text-sm font-medium">{view.businessProfile.teamSize || "—"}</p>
            )}
          </div>
          <div className="bg-card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
            </div>
            {editing ? (
              <input
                value={form.businessProfile.revenue || ""}
                onChange={(e) => setForm({ ...form, businessProfile: { ...form.businessProfile, revenue: e.target.value } })}
                className="w-full text-sm font-medium bg-transparent outline-none"
                placeholder="e.g. $40k MRR"
              />
            ) : (
              <p className="text-sm font-medium">{view.businessProfile.revenue || "—"}</p>
            )}
          </div>
          <div className="bg-card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Website</p>
            </div>
            {editing ? (
              <input
                value={form.website || ""}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="w-full text-sm font-medium bg-transparent outline-none"
                placeholder="https://..."
              />
            ) : (
              view.website ? <a href={view.website} target="_blank" rel="noopener" className="text-sm font-medium text-primary hover:underline truncate block">{view.website.replace(/^https?:\/\//, "")}</a> : <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {/* Tools */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Tool Stack</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(view.businessProfile.tools || []).map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-xs bg-muted/60 text-foreground/80 border border-border rounded-md px-2 py-1">
                {t}
                {editing && (
                  <button onClick={() => removeTool(t)} className="hover:text-red-400 ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {(view.businessProfile.tools || []).length === 0 && !editing && <span className="text-xs text-muted-foreground italic">None set</span>}
            {editing && (
              <div className="inline-flex items-center gap-1">
                <input
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTool() } }}
                  placeholder="Add tool..."
                  className="h-6 w-28 rounded-md border border-border bg-muted/50 px-2 text-xs outline-none focus:border-muted-foreground/30 transition-colors"
                />
                <button onClick={addTool} className="text-xs text-muted-foreground hover:text-foreground">+</button>
              </div>
            )}
          </div>
        </div>

        {!editing && (
          <div className="pt-4 border-t border-border">
            <p className="text-[11px] text-muted-foreground">
              This profile is used by your AI agents to understand your business context. Keep it up to date so agents make better decisions on your behalf.
            </p>
          </div>
        )}

        {/* Business Documents — agent-generated deliverables */}
        {!editing && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground/50" />
                <h2 className="text-sm font-semibold text-muted-foreground">Business Documents</h2>
              </div>
              {businessDocs.length > 0 && (
                <span className="text-[10px] text-muted-foreground/50">
                  {businessDocs.length} document{businessDocs.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {docsLoading && (
              <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading documents...</span>
              </div>
            )}

            {!docsLoading && businessDocs.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground/50">No documents yet.</p>
                <p className="text-[11px] text-muted-foreground/40 mt-1">
                  Your R&D team will create business documents as they work. Check back after chatting with your R&D lead.
                </p>
              </div>
            )}

            {!docsLoading && businessDocs.length > 0 && (
              <div className="space-y-2">
                {businessDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/business/docs/${doc.id}`}
                    className="flex items-center gap-3 rounded-md border border-border bg-card p-4 hover:border-muted-foreground/20 transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-foreground/90 transition-colors">{doc.title}</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                        Created by {doc.createdByName} · {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
