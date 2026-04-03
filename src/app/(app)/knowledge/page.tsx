"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PixelAvatar } from "@/components/pixel-avatar"
import { agents } from "@/lib/mock-data"
import {
  Brain, Search, Plus, Network, List, Clock,
  Link2, FileText, X, ChevronRight, Save, Edit3,
  Loader2, ArrowLeft, Tag, Building2, User, Target,
  DollarSign, Megaphone,
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
        if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold mt-3 mb-1 text-foreground">{line.slice(4)}</h3>

        // Tables
        if (line.startsWith("|")) {
          const cells = line.split("|").filter(Boolean).map((c) => c.trim())
          if (cells.every((c) => /^-+$/.test(c))) return null
          return (
            <div key={i} className="flex text-xs font-mono">
              {cells.map((cell, j) => (
                <span key={j} className={cn("px-2 py-1 border-b border-border flex-1", line.includes("**") ? "font-bold" : "text-muted-foreground")}>
                  {cell.replace(/\*\*/g, "")}
                </span>
              ))}
            </div>
          )
        }

        // Checkboxes
        if (line.startsWith("- [x]")) return <p key={i} className="text-sm text-foreground/80 pl-2 my-0.5">✅ {line.slice(6)}</p>
        if (line.startsWith("- [ ]")) return <p key={i} className="text-sm text-foreground/80 pl-2 my-0.5">⬜ {line.slice(6)}</p>

        // Bullets
        if (line.startsWith("- ")) return <p key={i} className="text-sm text-foreground/80 pl-3 my-0.5">• {renderInline(line.slice(2), entries, onNavigate)}</p>

        // Numbered
        if (line.match(/^\d+\.\s/)) return <p key={i} className="text-sm text-foreground/80 pl-3 my-0.5">{renderInline(line, entries, onNavigate)}</p>

        // Blockquotes (wiki-link references)
        if (line.startsWith("> ")) return <div key={i} className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-3 my-2 italic">{renderInline(line.slice(2), entries, onNavigate)}</div>

        // Code blocks
        if (line.startsWith("```")) return null
        if (line.trim() === "") return <br key={i} />

        return <p key={i} className="text-sm text-foreground/80 my-0.5">{renderInline(line, entries, onNavigate)}</p>
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
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{part.slice(1, -1)}</code>
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
        <h2 className="text-sm font-bold">New Knowledge Entry</h2>
        <button onClick={onCancel} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Entry title..." className="h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
          <div className="flex gap-1 flex-wrap">
            {categories.filter((c) => c.id !== "all").map((cat) => (
              <button key={cat.id} onClick={() => setCategory(cat.id)} className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors", category === cat.id ? "bg-purple-500/20 text-purple-400" : "bg-muted text-muted-foreground hover:text-foreground")}>{cat.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags (comma separated)</label>
          <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="tag1, tag2, tag3" className="h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Author</label>
          <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Name" className="h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Content (Markdown)</label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={16} className="font-mono text-xs" placeholder="Write your knowledge entry in markdown..." />
          <p className="text-xs text-muted-foreground mt-1">Use **bold**, *italic*, `code`, [[Wiki Links]], ## Headers, - bullets, | tables |</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={!title.trim() || !content.trim() || saving} onClick={() => onSave({ title: title.trim(), content, category, tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean), createdByName: authorName.trim() || "You" })}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
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
    setSaving(true)
    try {
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
            <Badge variant="secondary" className="text-xs">{entries.length} entries</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden">
              <button onClick={() => setViewMode("list")} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><List className="h-3.5 w-3.5" /></button>
              <button onClick={() => setViewMode("graph")} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", viewMode === "graph" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><Network className="h-3.5 w-3.5" /></button>
            </div>
            <Button size="sm" className="h-8" onClick={() => { setShowNewForm(true); setSelectedEntry(null); setEditing(false) }}><Plus className="h-3.5 w-3.5 mr-1" />New Entry</Button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search knowledge..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs pl-8" />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={cn("px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors", activeCategory === cat.id ? "bg-purple-500/20 text-purple-400" : "bg-muted text-muted-foreground hover:text-foreground")}>{cat.label}</button>
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
                <button key={entry.id} onClick={() => { setSelectedEntry(entry.id); setShowNewForm(false); setEditing(false) }} className={cn("w-full text-left rounded-lg border p-3 transition-colors", selectedEntry === entry.id ? "border-purple-500/50 bg-purple-500/5" : "border-border hover:border-purple-500/30")}>
                  <div className="flex items-start gap-3">
                    {agent && <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={28} className="rounded-md border border-border shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium truncate">{entry.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        by {entry.createdByName} · {Math.round((Date.now() - new Date(entry.updatedAt).getTime()) / 3600000)}h ago
                        {entry.linkedEntries.length > 0 && <> · <Link2 className="h-3 w-3 inline" /> {entry.linkedEntries.length}</>}
                      </p>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {entry.tags.slice(0, 3).map((tag) => <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">#{tag}</span>)}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
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
            <h2 className="text-sm font-bold truncate flex-1 mr-2">{selected.title}</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { if (editing) { setEditing(false) } else { setEditing(true); setEditContent(selected.content); setEditTitle(selected.title) } }}>
                <Edit3 className="h-3 w-3 mr-1" />{editing ? "Preview" : "Edit"}
              </Button>
              <button onClick={() => setSelectedEntry(null)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Meta */}
            <div className="flex items-center gap-3">
              {(() => { const a = agents.find((a) => a.id === selected.createdByAgentId); return a ? <PixelAvatar characterIndex={a.pixelAvatarIndex} size={28} className="rounded-md border border-border" /> : null })()}
              <div>
                <p className="text-xs"><span className="font-medium">{selected.createdByName}</span> created this</p>
                <p className="text-xs text-muted-foreground">Updated {new Date(selected.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {selected.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>)}
            </div>

            {/* Content */}
            {editing ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-8 text-sm" />
                </div>
                <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={20} className="font-mono text-xs" />
                <div className="flex gap-2">
                  <Button size="sm" disabled={saving} onClick={handleSaveEdit}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
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
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Link2 className="h-3 w-3" /> Outgoing Links</p>
                    {linkedEntries.map((l) => (
                      <button key={l.id} onClick={() => setSelectedEntry(l.id)} className="flex items-center gap-2 w-full text-left rounded-md p-2 hover:bg-accent transition-colors">
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" /><span className="text-xs truncate">{l.title}</span>
                      </button>
                    ))}
                  </div>
                )}
                {backlinks.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Backlinks</p>
                    {backlinks.map((l) => (
                      <button key={l.id} onClick={() => setSelectedEntry(l.id)} className="flex items-center gap-2 w-full text-left rounded-md p-2 hover:bg-accent transition-colors">
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" /><span className="text-xs truncate">{l.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
