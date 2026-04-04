"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Textarea } from "@/components/ui/textarea"
import { PixelAvatar } from "@/components/pixel-avatar"
import { agents } from "@/lib/mock-data"
import {
  Brain, Search, Plus, Network, List, Clock,
  Link2, FileText, X, ChevronRight, Save, Edit3,
  Loader2, ArrowLeft, Tag, Building2, User, Target,
  DollarSign, Megaphone, Database, Trash2, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface KnowledgeEntry {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  linkedEntries: string[]
  createdByName: string
  createdByAgentId: string | null
  createdAt: string
  updatedAt: string
}

const categories = [
  { id: "all", label: "All", icon: Brain, emoji: "🧠" },
  { id: "business", label: "Business", icon: Building2, emoji: "🏢" },
  { id: "clients", label: "Clients & Leads", icon: User, emoji: "👤" },
  { id: "campaigns", label: "Campaigns", icon: Megaphone, emoji: "📣" },
  { id: "processes", label: "Processes & SOPs", icon: FileText, emoji: "📋" },
  { id: "metrics", label: "Metrics & KPIs", icon: Target, emoji: "📊" },
  { id: "financial", label: "Financial", icon: DollarSign, emoji: "💰" },
]

// Render markdown-like content with wiki-links
function RenderContent({ content, entries, onNavigate }: { content: string; entries: KnowledgeEntry[]; onNavigate: (id: string) => void }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      {content.split("\n").map((line, i) => {
        // Headers
        if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold mt-4 mb-2 text-foreground">{line.slice(3)}</h2>
        if (line.startsWith("### ")) return <h3 key={i} className="text-[13px] font-bold mt-3 mb-1 text-foreground">{line.slice(4)}</h3>

        // Tables
        if (line.startsWith("|")) {
          const cells = line.split("|").filter(Boolean).map((c) => c.trim())
          if (cells.every((c) => /^-+$/.test(c))) return null
          return (
            <div key={i} className="flex text-xs font-mono">
              {cells.map((cell, j) => (
                <span key={j} className={cn("px-2 py-1 border-b border-border flex-1 tabular-nums", line.includes("**") ? "font-bold" : "text-muted-foreground")}>
                  {cell.replace(/\*\*/g, "")}
                </span>
              ))}
            </div>
          )
        }

        // Checkboxes
        if (line.startsWith("- [x]")) return <p key={i} className="text-[13px] text-foreground/80 pl-2 my-0.5">✅ {line.slice(6)}</p>
        if (line.startsWith("- [ ]")) return <p key={i} className="text-[13px] text-foreground/80 pl-2 my-0.5">⬜ {line.slice(6)}</p>

        // Bullets
        if (line.startsWith("- ")) return <p key={i} className="text-[13px] text-foreground/80 pl-3 my-0.5">• {renderInline(line.slice(2), entries, onNavigate)}</p>

        // Numbered
        if (line.match(/^\d+\.\s/)) return <p key={i} className="text-[13px] text-foreground/80 pl-3 my-0.5">{renderInline(line, entries, onNavigate)}</p>

        // Blockquotes (wiki-link references)
        if (line.startsWith("> ")) return <div key={i} className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-3 my-2 italic">{renderInline(line.slice(2), entries, onNavigate)}</div>

        // Code blocks
        if (line.startsWith("```")) return null
        if (line.trim() === "") return <br key={i} />

        return <p key={i} className="text-[13px] text-foreground/80 my-0.5">{renderInline(line, entries, onNavigate)}</p>
      })}
    </div>
  )
}

function renderInline(text: string, entries: KnowledgeEntry[], onNavigate: (id: string) => void) {
  const parts = text.split(/(\[\[.*?\]\]|\*\*.*?\*\*|\*.*?\*|`.*?`)/g)
  return parts.map((part, i) => {
    // Wiki links
    const wikiMatch = /^\[\[(.*?)\]\]$/.exec(part)
    if (wikiMatch) {
      const linked = entries.find((e) => e.title === wikiMatch[1])
      return <button key={i} onClick={() => linked && onNavigate(linked.id)} className="text-primary hover:underline font-medium">{wikiMatch[1]}</button>
    }
    // Bold
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>
    // Italic
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>
    // Code
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="px-1 py-0.5 rounded-md bg-muted text-xs font-mono">{part.slice(1, -1)}</code>
    return <span key={i}>{part}</span>
  })
}

// Graph visualization
function KnowledgeGraph({ entries, selectedId, onSelect }: { entries: KnowledgeEntry[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const cx = rect.width / 2; const cy = rect.height / 2
    const radius = Math.min(cx, cy) * 0.7
    const pos: Record<string, { x: number; y: number }> = {}
    entries.forEach((e, i) => {
      const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2
      pos[e.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
    })

    // Connections
    entries.forEach((entry) => {
      const from = pos[entry.id]; if (!from) return
      entry.linkedEntries.forEach((lid) => {
        const to = pos[lid]; if (!to) return
        const hl = selectedId === entry.id || selectedId === lid
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y)
        ctx.strokeStyle = hl ? "rgba(168, 85, 247, 0.5)" : "rgba(255,255,255,0.06)"
        ctx.lineWidth = hl ? 2 : 1; ctx.stroke()
      })
    })

    // Nodes
    entries.forEach((entry) => {
      const p = pos[entry.id]; if (!p) return
      const sel = selectedId === entry.id
      const linked = selectedId ? entries.find((e) => e.id === selectedId)?.linkedEntries.includes(entry.id) : false
      const r = sel ? 30 : 24
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fillStyle = sel ? "rgba(168,85,247,0.25)" : linked ? "rgba(168,85,247,0.1)" : "rgba(255,255,255,0.04)"
      ctx.fill()
      ctx.strokeStyle = sel ? "rgb(168,85,247)" : linked ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.12)"
      ctx.lineWidth = sel ? 2 : 1; ctx.stroke()

      const cat = categories.find((c) => c.id === entry.category)
      ctx.font = `${r * 0.65}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText(cat?.emoji || "🧠", p.x, p.y)
      ctx.font = "11px system-ui"; ctx.fillStyle = sel || linked ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)"
      const label = entry.title.length > 22 ? entry.title.slice(0, 22) + "..." : entry.title
      ctx.fillText(label, p.x, p.y + r + 14)
    })

    // Store positions for click handler
    ;(canvas as any).__positions = pos
  }, [entries, selectedId])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current; const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top
    const pos = (canvas as any).__positions || {}
    for (const entry of entries) {
      const p = pos[entry.id]; if (!p) continue
      if ((mx - p.x) ** 2 + (my - p.y) ** 2 < 35 ** 2) { onSelect(entry.id); return }
    }
  }, [entries, onSelect])

  return <div ref={containerRef} className="w-full h-full"><canvas ref={canvasRef} onClick={handleClick} className="cursor-pointer" /></div>
}

// New entry form
function NewEntryForm({ onSave, onCancel, saving }: { onSave: (entry: { title: string; content: string; category: string; tags: string[]; createdByName: string }) => void; onCancel: () => void; saving: boolean }) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [category, setCategory] = useState("business")
  const [tagsInput, setTagsInput] = useState("")
  const [authorName, setAuthorName] = useState("You")

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-[13px] font-semibold">New Knowledge Entry</h2>
        <button onClick={onCancel} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="section-label mb-1 block">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Entry title..." className="h-8 w-full rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="section-label mb-1 block">Category</label>
          <div className="flex gap-1 flex-wrap">
            {categories.filter((c) => c.id !== "all").map((cat) => (
              <button key={cat.id} onClick={() => setCategory(cat.id)} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors", category === cat.id ? "bg-purple-500/20 text-purple-400" : "bg-muted text-muted-foreground hover:text-foreground")}>{cat.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="section-label mb-1 block">Tags (comma separated)</label>
          <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="tag1, tag2, tag3" className="h-8 w-full rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="section-label mb-1 block">Author</label>
          <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Name" className="h-8 w-full rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="section-label mb-1 block">Content (Markdown)</label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={16} className="font-mono text-xs rounded-md" placeholder="Write your knowledge entry in markdown..." />
          <p className="text-xs text-muted-foreground mt-1">Use **bold**, *italic*, `code`, [[Wiki Links]], ## Headers, - bullets, | tables |</p>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={!title.trim() || !content.trim() || saving} onClick={() => onSave({ title: title.trim(), content, category, tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean), createdByName: authorName.trim() || "You" })} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save
          </button>
          <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "graph">("list")
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [saving, setSaving] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [knowledgeTab, setKnowledgeTab] = useState<"wiki" | "memory">("wiki")
  const [companyMemories, setCompanyMemories] = useState<{ id: string; category: string; title: string; content: string; importance: number; source: string | null; tags: string[]; createdAt: string }[]>([])
  const [memoryCategory, setMemoryCategory] = useState("all")
  const [showNewMemory, setShowNewMemory] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [summaries, setSummaries] = useState<Record<string, string>>({})
  const [summarizing, setSummarizing] = useState(false)
  const [newMemTitle, setNewMemTitle] = useState("")
  const [newMemContent, setNewMemContent] = useState("")
  const [newMemCategory, setNewMemCategory] = useState("fact")

  // Fetch entries from API
  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge")
      if (res.ok) {
        const data = await res.json()
        setEntries(data)
      }
    } catch (err) {
      console.error("Failed to fetch knowledge entries:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
    fetch("/api/company-memory").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setCompanyMemories(data)
    }).catch(() => {})
  }, [fetchEntries])

  const handleCreate = async (entry: { title: string; content: string; category: string; tags: string[]; createdByName: string }) => {
    setSaving(true)
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      })
      if (res.ok) {
        const created = await res.json()
        setEntries((prev) => [...prev, created])
        setShowNewForm(false)
        setSelectedEntry(created.id)
      }
    } catch (err) {
      console.error("Failed to create entry:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedEntry) return
    const current = entries.find((e) => e.id === selectedEntry)
    setSaving(true)
    try {
      // Save version snapshot before overwriting
      if (current) {
        const vKey = `bos-knowledge-versions-${selectedEntry}`
        const versions = JSON.parse(localStorage.getItem(vKey) || "[]")
        versions.push({ title: current.title, content: current.content, savedAt: new Date().toISOString(), version: versions.length + 1 })
        localStorage.setItem(vKey, JSON.stringify(versions.slice(-20))) // keep last 20
      }
      const res = await fetch("/api/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedEntry, content: editContent, title: editTitle }),
      })
      if (res.ok) {
        const updated = await res.json()
        setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
        setEditing(false)
      }
    } catch (err) {
      console.error("Failed to update entry:", err)
    } finally {
      setSaving(false)
    }
  }

  const filtered = entries.filter((e) => {
    const matchesSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase()) || e.tags.some((t) => t.includes(search.toLowerCase()))
    const matchesCat = activeCategory === "all" || e.category === activeCategory
    return matchesSearch && matchesCat
  })

  const selected = selectedEntry ? entries.find((e) => e.id === selectedEntry) : null
  const linkedEntries = selected ? entries.filter((e) => selected.linkedEntries.includes(e.id)) : []
  const backlinks = selected ? entries.filter((e) => e.linkedEntries.includes(selected.id)) : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left -- List/Graph */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            <h1 className="text-lg font-semibold tracking-tight">Knowledge</h1>
            <div className="flex rounded-md border border-border overflow-hidden ml-2">
              <button onClick={() => setKnowledgeTab("wiki")} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", knowledgeTab === "wiki" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Wiki</button>
              <button onClick={() => setKnowledgeTab("memory")} className={cn("px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1", knowledgeTab === "memory" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><Database className="h-3 w-3" />Company Memory</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {knowledgeTab === "wiki" && (
              <>
                <div className="flex rounded-md border border-border overflow-hidden">
                  <button onClick={() => setViewMode("list")} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><List className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setViewMode("graph")} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", viewMode === "graph" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><Network className="h-3.5 w-3.5" /></button>
                </div>
                <button className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1" onClick={() => { setShowNewForm(true); setSelectedEntry(null); setEditing(false) }}><Plus className="h-3.5 w-3.5" />New Entry</button>
              </>
            )}
            {knowledgeTab === "memory" && (
              <button className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1" onClick={() => setShowNewMemory(true)}><Plus className="h-3.5 w-3.5" />Add Memory</button>
            )}
          </div>
        </div>

        {knowledgeTab === "wiki" ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input placeholder="Search knowledge..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-full rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="flex gap-1 overflow-x-auto">
                {categories.map((cat) => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={cn("px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors", activeCategory === cat.id ? "bg-purple-500/20 text-purple-400" : "bg-muted text-muted-foreground hover:text-foreground")}>{cat.label}</button>
                ))}
              </div>
            </div>

            {viewMode === "graph" ? (
              <div className="flex-1 min-h-0 bg-card/30"><KnowledgeGraph entries={filtered} selectedId={selectedEntry} onSelect={(id) => { setSelectedEntry(id); setShowNewForm(false); setEditing(false) }} /></div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filtered.map((entry) => {
                  const agent = agents.find((a) => a.id === entry.createdByAgentId)
                  return (
                    <button key={entry.id} onClick={() => { setSelectedEntry(entry.id); setShowNewForm(false); setEditing(false) }} className={cn("w-full text-left rounded-md border p-3 transition-colors", selectedEntry === entry.id ? "border-purple-500/50 bg-purple-500/5" : "border-border hover:border-purple-500/30")}>
                      <div className="flex items-start gap-3">
                        {agent && <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={28} className="rounded-md border border-border shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[13px] font-medium truncate">{entry.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            by {entry.createdByName} · <span className="tabular-nums">{Math.round((Date.now() - new Date(entry.updatedAt).getTime()) / 3600000)}h ago</span>
                            {entry.linkedEntries.length > 0 && <> · <Link2 className="h-3 w-3 inline" /> {entry.linkedEntries.length}</>}
                          </p>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {entry.tags.slice(0, 3).map((tag) => <span key={tag} className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">#{tag}</span>)}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          /* ── Company Memory Tab ── */
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
              {(["all", "client", "process", "preference", "lesson", "fact"] as const).map((cat) => {
                const labels: Record<string, string> = { all: "All", client: "Clients", process: "Processes", preference: "Preferences", lesson: "Lessons", fact: "Facts" }
                const count = cat === "all" ? companyMemories.length : companyMemories.filter((m) => m.category === cat).length
                return (
                  <button key={cat} onClick={() => setMemoryCategory(cat)} className={cn("px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors", memoryCategory === cat ? "bg-purple-500/20 text-purple-400" : "bg-muted text-muted-foreground hover:text-foreground")}>{labels[cat]} {count > 0 && <span className="ml-1 tabular-nums">{count}</span>}</button>
                )
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* New memory form */}
              {showNewMemory && (
                <div className="bg-card border border-border rounded-md p-4 space-y-3">
                  <p className="text-xs font-medium">Add Company Memory</p>
                  <input placeholder="Title (e.g., Client prefers email over Slack)" value={newMemTitle} onChange={(e) => setNewMemTitle(e.target.value)} className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
                  <textarea placeholder="Details..." value={newMemContent} onChange={(e) => setNewMemContent(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
                  <div className="flex gap-1 flex-wrap">
                    {(["client", "process", "preference", "lesson", "fact"] as const).map((cat) => (
                      <button key={cat} onClick={() => setNewMemCategory(cat)} className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-colors capitalize", newMemCategory === cat ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground")}>{cat}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      if (!newMemTitle.trim()) return
                      const mem = await fetch("/api/company-memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newMemTitle, content: newMemContent, category: newMemCategory }) }).then((r) => r.json())
                      setCompanyMemories((prev) => [mem, ...prev])
                      setNewMemTitle(""); setNewMemContent(""); setNewMemCategory("fact"); setShowNewMemory(false)
                    }} disabled={!newMemTitle.trim()} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"><Save className="h-3 w-3" />Save</button>
                    <button onClick={() => { setShowNewMemory(false); setNewMemTitle(""); setNewMemContent("") }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="bg-muted/30 border border-dashed border-border rounded-md p-4 text-center">
                <Database className="h-5 w-5 text-purple-400/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Shared knowledge that all agents draw from — client preferences, learned patterns, company facts.</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Agents contribute memories automatically as they work. You can add them manually too.</p>
              </div>

              {/* Memory entries */}
              {(() => {
                const filtered = memoryCategory === "all" ? companyMemories : companyMemories.filter((m) => m.category === memoryCategory)
                if (filtered.length === 0) return (
                  <div className="text-center py-8 text-xs text-muted-foreground">No memories in this category yet.</div>
                )
                return (
                  <div className="bg-card border border-border rounded-md divide-y divide-border">
                    {filtered.map((mem) => {
                      const catEmoji: Record<string, string> = { client: "👤", process: "📋", preference: "⭐", lesson: "💡", fact: "📌" }
                      const diffMs = Date.now() - new Date(mem.createdAt).getTime()
                      const diffHr = Math.floor(diffMs / 3600000)
                      const t = diffHr < 24 ? `${diffHr}h` : `${Math.floor(diffHr / 24)}d`
                      return (
                        <div key={mem.id} className="px-4 py-3 group">
                          <div className="flex items-start gap-2">
                            <span className="text-sm mt-0.5">{catEmoji[mem.category] || "📌"}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-medium">{mem.title}</p>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{mem.category}</span>
                              </div>
                              {mem.content && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{mem.content}</p>}
                              {mem.tags.length > 0 && (
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                  {mem.tags.map((tag: string) => <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">#{tag}</span>)}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-muted-foreground tabular-nums">{t}</span>
                              <button onClick={async () => {
                                await fetch("/api/company-memory", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: mem.id }) })
                                setCompanyMemories((prev) => prev.filter((m) => m.id !== mem.id))
                              }} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </>
        )}
      </div>

      {/* Right -- New Entry Form */}
      {showNewForm && (
        <div className="w-[480px] border-l border-border flex flex-col shrink-0 overflow-hidden">
          <NewEntryForm onSave={handleCreate} onCancel={() => setShowNewForm(false)} saving={saving} />
        </div>
      )}

      {/* Right -- Detail */}
      {selected && !showNewForm && (
        <div className="w-[480px] border-l border-border flex flex-col shrink-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-[13px] font-semibold truncate flex-1 mr-2">{selected.title}</h2>
            <div className="flex items-center gap-1">
              <button disabled={summarizing} className="h-7 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-1" onClick={async () => {
                if (summaries[selected.id]) { setSummaries((prev) => { const n = { ...prev }; delete n[selected.id]; return n }); return }
                setSummarizing(true)
                // Generate summary from content
                const lines = selected.content.split("\n").filter((l: string) => l.trim())
                const firstLines = lines.slice(0, 3).join(" ").slice(0, 200)
                const wordCount = selected.content.split(/\s+/).length
                const linkCount = (selected.content.match(/\[\[.*?\]\]/g) || []).length
                const summary = `${firstLines}${firstLines.length >= 200 ? "..." : ""} — ${wordCount} words, ${lines.length} sections${linkCount > 0 ? `, ${linkCount} linked entries` : ""}.`
                await new Promise((r) => setTimeout(r, 800)) // simulate delay
                setSummaries((prev) => ({ ...prev, [selected.id]: summary }))
                setSummarizing(false)
              }} title="Generate summary">
                {summarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              </button>
              <button className="h-7 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-1" onClick={() => setShowVersionHistory(!showVersionHistory)} title="Version history">
                <Clock className="h-3 w-3" />
              </button>
              <button className="h-7 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-1" onClick={() => { if (editing) { setEditing(false) } else { setEditing(true); setEditContent(selected.content); setEditTitle(selected.title) } }}>
                <Edit3 className="h-3 w-3" />{editing ? "Preview" : "Edit"}
              </button>
              <button onClick={() => setSelectedEntry(null)} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Meta */}
            <div className="flex items-center gap-3">
              {(() => { const a = agents.find((a) => a.id === selected.createdByAgentId); return a ? <PixelAvatar characterIndex={a.pixelAvatarIndex} size={28} className="rounded-md border border-border" /> : null })()}
              <div>
                <p className="text-[13px]"><span className="font-medium">{selected.createdByName}</span> created this</p>
                <p className="text-xs text-muted-foreground">Updated {new Date(selected.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {selected.tags.map((tag) => <span key={tag} className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">#{tag}</span>)}
            </div>

            {/* AI Summary */}
            {selected && summaries[selected.id] && (
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3 w-3 text-purple-400" />
                  <span className="text-[11px] text-purple-400 uppercase tracking-wider font-medium">Summary</span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{summaries[selected.id]}</p>
              </div>
            )}

            {/* Version history panel */}
            {showVersionHistory && selected && (() => {
              const vKey = `bos-knowledge-versions-${selected.id}`
              const versions: { title: string; content: string; savedAt: string; version: number }[] = (() => { try { return JSON.parse(localStorage.getItem(vKey) || "[]") } catch { return [] } })()
              return (
                <div className="bg-muted/30 border border-border rounded-md p-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Clock className="h-3 w-3" />Version History</p>
                  {versions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No previous versions. Edit history will appear here after you make changes.</p>
                  ) : (
                    <div className="space-y-1">
                      {[...versions].reverse().map((v, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                          <div>
                            <p className="text-xs font-medium">v{v.version} — {v.title}</p>
                            <p className="text-[11px] text-muted-foreground">{new Date(v.savedAt).toLocaleString()}</p>
                          </div>
                          <button onClick={() => { setEditing(true); setEditContent(v.content); setEditTitle(v.title); setShowVersionHistory(false) }} className="text-[11px] text-primary hover:underline">Restore</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Content */}
            {editing ? (
              <div className="space-y-2">
                <div>
                  <label className="section-label mb-1 block">Title</label>
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-8 w-full rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={20} className="font-mono text-xs rounded-md" />
                <div className="flex items-center gap-2">
                  <button disabled={saving} onClick={handleSaveEdit} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save
                  </button>
                  <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
                <p className="text-xs text-muted-foreground">Use **bold**, *italic*, `code`, [[Wiki Links]], ## Headers, - bullets, | tables |</p>
              </div>
            ) : (
              <RenderContent content={selected.content} entries={entries} onNavigate={setSelectedEntry} />
            )}

            {/* Linked + Backlinks */}
            {(linkedEntries.length > 0 || backlinks.length > 0) && (
              <div className="border-t border-border pt-4 space-y-3">
                {linkedEntries.length > 0 && (
                  <div>
                    <p className="section-label mb-2 flex items-center gap-1"><Link2 className="h-3 w-3" /> Outgoing Links</p>
                    {linkedEntries.map((l) => (
                      <button key={l.id} onClick={() => setSelectedEntry(l.id)} className="flex items-center gap-2 w-full text-left rounded-md p-2 hover:bg-accent transition-colors">
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" /><span className="text-xs truncate">{l.title}</span>
                      </button>
                    ))}
                  </div>
                )}
                {backlinks.length > 0 && (
                  <div>
                    <p className="section-label mb-2 flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Backlinks</p>
                    {backlinks.map((l) => (
                      <button key={l.id} onClick={() => setSelectedEntry(l.id)} className="flex items-center gap-2 w-full text-left rounded-md p-2 hover:bg-accent transition-colors">
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" /><span className="text-xs truncate">{l.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Auto-detected suggested links */}
            {(() => {
              if (!selected) return null
              const alreadyLinked = new Set([...selected.linkedEntries, selected.id, ...backlinks.map((b) => b.id)])
              const suggestions = entries.filter((e) => {
                if (alreadyLinked.has(e.id)) return false
                const titleLower = e.title.toLowerCase()
                const contentLower = selected.content.toLowerCase()
                // Check if this entry's title appears in the selected entry's content
                return titleLower.length > 3 && contentLower.includes(titleLower)
              })
              if (suggestions.length === 0) return null
              return (
                <div className="border-t border-border pt-4">
                  <p className="section-label mb-2 flex items-center gap-1"><Sparkles className="h-3 w-3 text-amber-400" /> Suggested Links</p>
                  <p className="text-[11px] text-muted-foreground mb-2">These entries are mentioned in the content but not linked yet.</p>
                  {suggestions.slice(0, 5).map((s) => (
                    <button key={s.id} onClick={() => setSelectedEntry(s.id)} className="flex items-center gap-2 w-full text-left rounded-md p-2 hover:bg-accent transition-colors">
                      <ChevronRight className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-xs truncate">{s.title}</span>
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
