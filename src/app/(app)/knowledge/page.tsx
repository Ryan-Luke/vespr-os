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
  createdBy: string
  createdByAgentId: string
  createdAt: Date
  updatedAt: Date
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

const knowledgeEntries: KnowledgeEntry[] = [
  {
    id: "k1", title: "Section 8 Real Estate Offer — ICP & Positioning",
    content: `## Ideal Customer Profile\n\n- Investors with **$250k+** looking to invest into Section 8\n- Already own other real estate properties\n- Looking for passive income through government-backed rental programs\n\n## Value Proposition\n\n- Turnkey Section 8 investment properties\n- Pre-qualified tenants with guaranteed government rent payments\n- Full property management included\n\n## Key Messaging\n\n- Focus on passive income and government-backed security\n- Lead with ROI numbers and cash flow projections\n- Differentiate from traditional real estate with the Section 8 stability angle\n\n## Pricing\n\n- Calls booked at **$140/call**\n- Targeting **3-4X ROAS** on ad spend\n\n> See also: [[V1 Ad Campaign Performance]], [[GHL Pipeline Setup]]`,
    category: "campaigns", tags: ["section-8", "real-estate", "ICP", "ads"], linkedEntries: ["k2", "k4", "k8"],
    createdBy: "Maya", createdByAgentId: "a1", createdAt: new Date(Date.now() - 86400000 * 5), updatedAt: new Date(Date.now() - 86400000 * 0.5),
  },
  {
    id: "k2", title: "V1 Ad Campaign Performance",
    content: `## Launch Status\n\n**Date:** April 2, 2026\n**Status:** ✅ Live and performing\n\n## Day 1 Metrics\n\n| Metric | Value |\n|--------|-------|\n| Booked calls | 2 |\n| Cost per call | $140 |\n| Financial qualification | Both passed ($250k+) |\n| Organic inbound | 4 messages |\n| Call requests | 1 this week |\n\n## Projections\n\n- Scale to **4-5 calls/day** by end of next week\n- CPM solid, CTR above benchmark\n- Expecting **3-4X ROAS** at target daily spend\n- Pacing **$120k/month** at daily spend goal\n\n## Creative Pipeline\n\n- [x] V1 creatives running\n- [ ] 3 new ad copy variations (Maya working on these)\n- [ ] Case study angle in development\n- [ ] Need more variations to prevent fatigue at scale\n\n> See also: [[Section 8 Real Estate Offer — ICP & Positioning]]`,
    category: "campaigns", tags: ["section-8", "ads", "performance", "metrics"], linkedEntries: ["k1", "k3"],
    createdBy: "Zara", createdByAgentId: "a3", createdAt: new Date(Date.now() - 86400000 * 0.5), updatedAt: new Date(Date.now() - 3600000),
  },
  {
    id: "k3", title: "GHL Pipeline Setup",
    content: `## Pipeline Stages\n\n1. **New Lead**\n2. **AI Inbound** (organic — separate from paid)\n3. **Qualified**\n4. **Call Booked**\n5. **Call Completed**\n6. **Proposal Sent**\n7. **Closed Won**\n8. **Closed Lost**\n\n## Tags System\n\n- **Source:** paid, organic, referral\n- **Campaign:** section-8, fintech, ai-services\n- **Qualification:** financial-qualified, needs-review\n\n## Automations\n\n- New lead → auto-enrichment with company data\n- Call booked → Slack notification to sales channel\n- 48hr no-response → follow-up sequence triggered\n\n> See also: [[Section 8 Real Estate Offer — ICP & Positioning]], [[Fintech Outreach Campaign]]`,
    category: "processes", tags: ["GHL", "CRM", "pipeline", "automation"], linkedEntries: ["k1", "k5"],
    createdBy: "Sam", createdByAgentId: "a6", createdAt: new Date(Date.now() - 86400000 * 3), updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: "k4", title: "Content Strategy — Q2 2026",
    content: `## Cadence\n\n- **Blog:** 5 posts/week\n- **Instagram:** 15 posts/week (carousel + stories)\n- **LinkedIn:** 3 posts/week\n\n## Focus Areas\n\n1. AI in small business *(primary)*\n2. Section 8 real estate investing\n3. Business automation case studies\n\n## SEO Targets\n\n| Keyword | Volume | Competition |\n|---------|--------|-------------|\n| business automation | 3x higher than expected | Medium |\n| AI for small business | Growing 40% MoM | Low |\n| Section 8 investing | Low competition | High intent |\n\n## Content Repurposing Flow\n\n\`\`\`\nBlog Post\n  ├── 5 Instagram carousel slides\n  ├── 3 LinkedIn posts\n  ├── Short-form ad creatives (top performers)\n  └── Monthly LinkedIn series\n\`\`\`\n\n## Sprint Progress\n\n- **14/20** blog posts published\n- Organic traffic up **22%** toward 30% goal`,
    category: "campaigns", tags: ["content", "SEO", "blog", "social-media"], linkedEntries: ["k1", "k2"],
    createdBy: "Maya", createdByAgentId: "a1", createdAt: new Date(Date.now() - 86400000 * 7), updatedAt: new Date(Date.now() - 86400000 * 2),
  },
  {
    id: "k5", title: "Fintech Outreach Campaign",
    content: `## Target\n\n- **Vertical:** Fintech companies\n- **ICP:** Series A to Series C, 50-500 employees\n\n## Status\n\n- ✅ 23 qualified prospects identified\n- ✅ All added to GHL with enrichment data\n- ✅ 5-step personalized email sequences drafted\n- ⏳ Awaiting owner approval on sequences\n\n## Results\n\n| Metric | Value |\n|--------|-------|\n| Prospects found | 23 |\n| Opened email #1 | 8 (35% open rate) |\n| Replied | 3 |\n| Next step | Follow up with remaining 15 |\n\n## A/B Testing\n\n- Testing 5 subject line variants\n- Currently in review stage`,
    category: "campaigns", tags: ["fintech", "outreach", "email", "B2B"], linkedEntries: ["k3"],
    createdBy: "Jordan", createdByAgentId: "a4", createdAt: new Date(Date.now() - 86400000 * 4), updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: "k6", title: "Customer Support SLAs",
    content: `## Response Time\n\n- **Target:** < 2 hours\n- **Current:** 1.2 hours ✅\n\n## Resolution Rate\n\n- **Target:** 95% same-day\n- **Current:** 93% *(working toward goal)*\n\n## Escalation Matrix\n\n| Issue Type | Handler | Escalation |\n|-----------|---------|------------|\n| General inquiry | Casey | — |\n| Refund < $100 | Casey (auto-approve) | — |\n| Refund > $100 | Casey | → Owner approval |\n| Shipping delay | Drew → Casey | — |\n| Technical issue | Casey | → Operations |\n\n## Active Issues\n\n- Customer #4521: requesting $189 refund (delayed shipment)\n- Order #ORD-8834: delayed by FedEx weather at Memphis hub`,
    category: "processes", tags: ["support", "SLA", "escalation"], linkedEntries: ["k7"],
    createdBy: "Casey", createdByAgentId: "a11", createdAt: new Date(Date.now() - 86400000 * 6), updatedAt: new Date(Date.now() - 86400000 * 0.5),
  },
  {
    id: "k7", title: "Shipping & Fulfillment Tracker",
    content: `## Overview\n\n- **Active shipments:** 23\n- **On-time rate:** 94%\n- **Avg delivery:** 3.2 days\n\n## Carrier Mix\n\n| Carrier | Share | Reliability |\n|---------|-------|-------------|\n| FedEx | 60% | ⚠️ Memphis issues |\n| UPS | 30% | ✅ Reliable |\n| USPS | 10% | ✅ OK for small items |\n\n## Current Delays\n\n- **FedEx Memphis hub** — weather delays\n- Affected: #ORD-8834, #ORD-8891, #ORD-8903\n- ETA: Tomorrow by 5 PM\n\n## Recommendations\n\n- Consider adding UPS as backup for Southeast routes\n- FedEx Memphis has been unreliable 3x this quarter`,
    category: "metrics", tags: ["shipping", "fulfillment", "logistics"], linkedEntries: ["k6"],
    createdBy: "Drew", createdByAgentId: "a12", createdAt: new Date(Date.now() - 86400000 * 2), updatedAt: new Date(Date.now() - 3600000 * 4),
  },
  {
    id: "k8", title: "Monthly Financial Overview",
    content: `## Status\n\n⚠️ **Q1 P&L blocked** — need March bank statement\n\n## AI Agent Costs (Monthly)\n\n| Agent | Cost |\n|-------|------|\n| Jordan (Lead Research) | $45.00 |\n| Maya (Content) | $28.50 |\n| Riley (Outreach) | $22.30 |\n| Casey (Support) | $18.90 |\n| Alex (SEO) | $15.20 |\n| Automation Expert | $12.00 |\n| Quinn (Process) | $9.80 |\n| Zara (Social) | $8.90 |\n| Finley (Bookkeeper) | $5.20 |\n| Morgan (P&L) | $4.50 |\n| Sam (CRM) | $3.50 |\n| Drew (Order Tracking) | $1.20 |\n| **Total** | **$174.90** |\n\n## Action Required\n\n🔴 Upload March bank statement to unblock P&L report`,
    category: "financial", tags: ["P&L", "costs", "budget"], linkedEntries: ["k1"],
    createdBy: "Morgan", createdByAgentId: "a10", createdAt: new Date(Date.now() - 86400000 * 3), updatedAt: new Date(Date.now() - 86400000),
  },
]

// Render markdown-like content with wiki-links
function RenderContent({ content, entries, onNavigate }: { content: string; entries: KnowledgeEntry[]; onNavigate: (id: string) => void }) {
  const parts = content.split(/(\[\[.*?\]\])/g)
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
      const label = entry.title.length > 22 ? entry.title.slice(0, 22) + "…" : entry.title
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

export default function KnowledgePage() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "graph">("list")
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState("")

  const filtered = knowledgeEntries.filter((e) => {
    const matchesSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase()) || e.tags.some((t) => t.includes(search.toLowerCase()))
    const matchesCat = activeCategory === "all" || e.category === activeCategory
    return matchesSearch && matchesCat
  })

  const selected = selectedEntry ? knowledgeEntries.find((e) => e.id === selectedEntry) : null
  const linkedEntries = selected ? knowledgeEntries.filter((e) => selected.linkedEntries.includes(e.id)) : []
  const backlinks = selected ? knowledgeEntries.filter((e) => e.linkedEntries.includes(selected.id)) : []

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left — List/Graph */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            <h1 className="text-lg font-semibold tracking-tight">Knowledge</h1>
            <Badge variant="secondary" className="text-xs">{knowledgeEntries.length} entries</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden">
              <button onClick={() => setViewMode("list")} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><List className="h-3.5 w-3.5" /></button>
              <button onClick={() => setViewMode("graph")} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", viewMode === "graph" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><Network className="h-3.5 w-3.5" /></button>
            </div>
            <Button size="sm" className="h-8"><Plus className="h-3.5 w-3.5 mr-1" />New Entry</Button>
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
          <div className="flex-1 min-h-0 bg-card/30"><KnowledgeGraph entries={filtered} selectedId={selectedEntry} onSelect={setSelectedEntry} /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filtered.map((entry) => {
              const agent = agents.find((a) => a.id === entry.createdByAgentId)
              return (
                <button key={entry.id} onClick={() => { setSelectedEntry(entry.id); setEditing(false) }} className={cn("w-full text-left rounded-lg border p-3 transition-colors", selectedEntry === entry.id ? "border-purple-500/50 bg-purple-500/5" : "border-border hover:border-purple-500/30")}>
                  <div className="flex items-start gap-3">
                    {agent && <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={28} className="rounded-md border border-border shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium truncate">{entry.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        by {entry.createdBy} · {Math.round((Date.now() - entry.updatedAt.getTime()) / 3600000)}h ago
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

      {/* Right — Detail */}
      {selected && (
        <div className="w-[480px] border-l border-border flex flex-col shrink-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-sm font-bold truncate flex-1 mr-2">{selected.title}</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditing(!editing); setEditContent(selected.content) }}>
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
                <p className="text-xs"><span className="font-medium">{selected.createdBy}</span> created this</p>
                <p className="text-xs text-muted-foreground">Updated {new Date(selected.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {selected.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>)}
            </div>

            {/* Content */}
            {editing ? (
              <div className="space-y-2">
                <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={20} className="font-mono text-xs" />
                <div className="flex gap-2">
                  <Button size="sm"><Save className="h-3.5 w-3.5 mr-1" />Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
                <p className="text-xs text-muted-foreground">Use **bold**, *italic*, `code`, [[Wiki Links]], ## Headers, - bullets, | tables |</p>
              </div>
            ) : (
              <RenderContent content={selected.content} entries={knowledgeEntries} onNavigate={setSelectedEntry} />
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
