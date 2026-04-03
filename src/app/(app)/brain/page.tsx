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
  Brain,
  Search,
  Plus,
  Network,
  List,
  Tag,
  Clock,
  Link2,
  FileText,
  User,
  Building2,
  Target,
  DollarSign,
  Megaphone,
  X,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface KnowledgeEntry {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  linkedEntries: string[]
  createdBy: string // agent name
  createdByAgentId: string
  createdAt: Date
  updatedAt: Date
}

const categories = [
  { id: "all", label: "All", icon: Brain },
  { id: "business", label: "Business", icon: Building2 },
  { id: "clients", label: "Clients & Leads", icon: User },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "processes", label: "Processes & SOPs", icon: FileText },
  { id: "metrics", label: "Metrics & KPIs", icon: Target },
  { id: "financial", label: "Financial", icon: DollarSign },
]

const knowledgeEntries: KnowledgeEntry[] = [
  {
    id: "k1",
    title: "Section 8 Real Estate Offer — ICP & Positioning",
    content: `**Ideal Customer Profile:**
- Investors with $250k+ looking to invest into Section 8
- Already own other real estate properties
- Looking for passive income through government-backed rental programs

**Value Proposition:**
- Turnkey Section 8 investment properties
- Pre-qualified tenants with guaranteed government rent payments
- Full property management included

**Key Messaging:**
- Focus on passive income and government-backed security
- Lead with ROI numbers and cash flow projections
- Differentiate from traditional real estate with the Section 8 stability angle

**Current Pricing:**
- Calls booked at $140/call
- Targeting 3-4X ROAS on ad spend`,
    category: "campaigns",
    tags: ["section-8", "real-estate", "ICP", "ads", "positioning"],
    linkedEntries: ["k2", "k4", "k8"],
    createdBy: "Maya",
    createdByAgentId: "a1",
    createdAt: new Date(Date.now() - 86400000 * 5),
    updatedAt: new Date(Date.now() - 86400000 * 0.5),
  },
  {
    id: "k2",
    title: "V1 Ad Campaign Performance — Section 8",
    content: `**Launch Date:** Today
**Status:** Live and performing

**Day 1 Metrics:**
- 2 booked calls at $140/call
- Both leads passed financial qualification ($250k+)
- 4 organic inbound messages about AI services
- 1 wants to set up a call this week

**Projections:**
- Scale to 4-5 calls/day by end of next week
- CPM is solid, CTR above benchmark
- Expecting 3-4X ROAS at target daily spend
- Pacing $120k/month at daily spend goal

**Creative Status:**
- V1 creatives running
- 3 new ad copy variations in progress (Maya)
- Case study angle being developed
- Need to prevent creative fatigue at scale`,
    category: "campaigns",
    tags: ["section-8", "ads", "performance", "metrics", "v1-launch"],
    linkedEntries: ["k1", "k3"],
    createdBy: "Zara",
    createdByAgentId: "a3",
    createdAt: new Date(Date.now() - 86400000 * 0.5),
    updatedAt: new Date(Date.now() - 3600000),
  },
  {
    id: "k3",
    title: "GHL Pipeline Setup",
    content: `**Pipeline Stages:**
1. New Lead
2. AI Inbound (organic — separate from paid)
3. Qualified
4. Call Booked
5. Call Completed
6. Proposal Sent
7. Closed Won
8. Closed Lost

**Tags System:**
- Source: paid, organic, referral
- Campaign: section-8, fintech, ai-services
- Qualification: financial-qualified, needs-review

**Automations:**
- New lead → auto-enrichment with company data
- Call booked → Slack notification to sales channel
- 48hr no-response → follow-up sequence triggered`,
    category: "processes",
    tags: ["GHL", "CRM", "pipeline", "automation"],
    linkedEntries: ["k1", "k5"],
    createdBy: "Sam",
    createdByAgentId: "a6",
    createdAt: new Date(Date.now() - 86400000 * 3),
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: "k4",
    title: "Content Strategy — Q2 2026",
    content: `**Blog Cadence:** 5 posts/week
**Focus Areas:**
1. AI in small business (primary)
2. Section 8 real estate investing
3. Business automation case studies

**SEO Targets:**
- "business automation" — 3x more volume than expected
- "AI for small business" — growing 40% MoM
- "Section 8 investing" — low competition, high intent

**Content Repurposing:**
- Each blog → 5 Instagram carousel slides
- Each blog → 3 LinkedIn posts
- Top performers → short-form ad creatives
- Monthly → 10-part LinkedIn series on automation

**Performance:**
- 14/20 blog posts published this sprint
- Organic traffic up 22% toward 30% goal`,
    category: "campaigns",
    tags: ["content", "SEO", "blog", "social-media", "strategy"],
    linkedEntries: ["k1", "k2"],
    createdBy: "Maya",
    createdByAgentId: "a1",
    createdAt: new Date(Date.now() - 86400000 * 7),
    updatedAt: new Date(Date.now() - 86400000 * 2),
  },
  {
    id: "k5",
    title: "Fintech Outreach Campaign",
    content: `**Target Vertical:** Fintech companies
**ICP:** Series A to Series C, 50-500 employees

**Current Status:**
- 23 qualified prospects identified
- All added to GHL with enrichment data
- 5-step personalized email sequences drafted
- Awaiting owner approval on sequences

**Results So Far:**
- 8/23 opened first email (35% open rate)
- 3 replied
- Following up with rest tomorrow

**A/B Testing:**
- Testing 5 subject line variants
- Currently in review stage`,
    category: "campaigns",
    tags: ["fintech", "outreach", "email", "B2B"],
    linkedEntries: ["k3"],
    createdBy: "Jordan",
    createdByAgentId: "a4",
    createdAt: new Date(Date.now() - 86400000 * 4),
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: "k6",
    title: "Customer Support Metrics & SLAs",
    content: `**Current SLAs:**
- Response time target: <2 hours
- Current average: 1.2 hours ✅
- Same-day resolution target: 95%
- Current: 93% (working toward goal)

**Ticket Volume:**
- ~12 tickets/day average
- Peak days: Monday, Friday
- Most common: shipping delays, product questions

**Escalation Process:**
1. Casey handles initial triage
2. Refunds >$100 require owner approval
3. Technical issues → Operations team
4. Shipping issues → Drew (Order Tracker)

**Active Issues:**
- Customer #4521 requesting $189 refund (delayed shipment)
- Order #ORD-8834 delayed by FedEx weather at Memphis hub`,
    category: "processes",
    tags: ["support", "SLA", "metrics", "escalation"],
    linkedEntries: ["k7"],
    createdBy: "Casey",
    createdByAgentId: "a11",
    createdAt: new Date(Date.now() - 86400000 * 6),
    updatedAt: new Date(Date.now() - 86400000 * 0.5),
  },
  {
    id: "k7",
    title: "Shipping & Fulfillment Status",
    content: `**Active Shipments:** 23
**Carrier Mix:** FedEx (60%), UPS (30%), USPS (10%)

**Current Delays:**
- FedEx Memphis hub — weather delays affecting 3 orders
- Expected resolution: tomorrow by 5 PM
- Affected orders: #ORD-8834, #ORD-8891, #ORD-8903

**Average Delivery Time:** 3.2 days
**On-Time Rate:** 94%

**Improvement Notes:**
- Consider adding UPS as backup for Southeast routes
- FedEx Memphis has been unreliable 3x this quarter`,
    category: "metrics",
    tags: ["shipping", "fulfillment", "delays", "logistics"],
    linkedEntries: ["k6"],
    createdBy: "Drew",
    createdByAgentId: "a12",
    createdAt: new Date(Date.now() - 86400000 * 2),
    updatedAt: new Date(Date.now() - 3600000 * 4),
  },
  {
    id: "k8",
    title: "Monthly Financial Overview — March 2026",
    content: `**Status:** Q1 P&L blocked — need March bank statement

**Known Numbers:**
- AI agent costs: $174.90/month
- Ad spend: TBD (just launched)
- Revenue tracking: waiting on P&L

**Agent Cost Breakdown:**
- Jordan (Lead Research): $45.00
- Maya (Content): $28.50
- Riley (Outreach): $22.30
- Casey (Support): $18.90
- Alex (SEO): $15.20
- Automation Expert: $12.00
- Quinn (Process): $9.80
- Zara (Social): $8.90
- Finley (Bookkeeper): $5.20
- Morgan (P&L): $4.50
- Sam (CRM): $3.50
- Drew (Order Tracking): $1.20

**Action Required:** Upload March bank statement to unblock P&L report`,
    category: "financial",
    tags: ["P&L", "costs", "budget", "monthly-report"],
    linkedEntries: ["k1"],
    createdBy: "Morgan",
    createdByAgentId: "a10",
    createdAt: new Date(Date.now() - 86400000 * 3),
    updatedAt: new Date(Date.now() - 86400000),
  },
]

// Simple graph visualization
function KnowledgeGraph({ entries, selectedId, onSelect }: { entries: KnowledgeEntry[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})

  useEffect(() => {
    // Calculate positions in a circular layout
    const pos: Record<string, { x: number; y: number }> = {}
    const cx = 400
    const cy = 300
    const radius = 220
    entries.forEach((entry, i) => {
      const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2
      pos[entry.id] = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      }
    })
    setPositions(pos)
  }, [entries])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const scaleX = rect.width / 800
    const scaleY = rect.height / 600

    // Draw connections
    entries.forEach((entry) => {
      const from = positions[entry.id]
      if (!from) return
      entry.linkedEntries.forEach((linkedId) => {
        const to = positions[linkedId]
        if (!to) return
        ctx.beginPath()
        ctx.moveTo(from.x * scaleX, from.y * scaleY)
        ctx.lineTo(to.x * scaleX, to.y * scaleY)
        const isHighlighted = selectedId === entry.id || selectedId === linkedId
        ctx.strokeStyle = isHighlighted ? "rgba(139, 92, 246, 0.5)" : "rgba(255, 255, 255, 0.08)"
        ctx.lineWidth = isHighlighted ? 2 : 1
        ctx.stroke()
      })
    })

    // Draw nodes
    entries.forEach((entry) => {
      const pos = positions[entry.id]
      if (!pos) return
      const isSelected = selectedId === entry.id
      const isLinked = selectedId ? entries.find((e) => e.id === selectedId)?.linkedEntries.includes(entry.id) : false

      const radius = isSelected ? 28 : 22
      const x = pos.x * scaleX
      const y = pos.y * scaleY

      // Node circle
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? "rgba(139, 92, 246, 0.3)" : isLinked ? "rgba(139, 92, 246, 0.15)" : "rgba(255, 255, 255, 0.05)"
      ctx.fill()
      ctx.strokeStyle = isSelected ? "rgb(139, 92, 246)" : isLinked ? "rgba(139, 92, 246, 0.5)" : "rgba(255, 255, 255, 0.15)"
      ctx.lineWidth = isSelected ? 2 : 1
      ctx.stroke()

      // Category icon
      const cat = categories.find((c) => c.id === entry.category)
      const emoji = cat?.id === "campaigns" ? "📣" : cat?.id === "business" ? "🏢" : cat?.id === "clients" ? "👤" : cat?.id === "processes" ? "📋" : cat?.id === "metrics" ? "📊" : cat?.id === "financial" ? "💰" : "🧠"
      ctx.font = `${radius * 0.7}px sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(emoji, x, y)

      // Label
      ctx.font = "11px system-ui, sans-serif"
      ctx.fillStyle = isSelected || isLinked ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.5)"
      ctx.textAlign = "center"
      const label = entry.title.length > 25 ? entry.title.slice(0, 25) + "..." : entry.title
      ctx.fillText(label, x, y + radius + 14)
    })
  }, [entries, positions, selectedId])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const scaleX = rect.width / 800
    const scaleY = rect.height / 600

    for (const entry of entries) {
      const pos = positions[entry.id]
      if (!pos) continue
      const dx = mx - pos.x * scaleX
      const dy = my - pos.y * scaleY
      if (dx * dx + dy * dy < 30 * 30) {
        onSelect(entry.id)
        return
      }
    }
  }, [entries, positions, onSelect])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} onClick={handleClick} className="cursor-pointer" />
    </div>
  )
}

export default function BrainPage() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "graph">("list")

  const filtered = knowledgeEntries.filter((e) => {
    const matchesSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase()) || e.tags.some((t) => t.includes(search.toLowerCase()))
    const matchesCat = activeCategory === "all" || e.category === activeCategory
    return matchesSearch && matchesCat
  })

  const selected = selectedEntry ? knowledgeEntries.find((e) => e.id === selectedEntry) : null
  const linkedEntries = selected ? knowledgeEntries.filter((e) => selected.linkedEntries.includes(e.id)) : []

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel — List or Graph */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            <h1 className="text-lg font-semibold tracking-tight">Brain</h1>
            <Badge variant="secondary" className="text-xs">{knowledgeEntries.length} entries</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden">
              <button onClick={() => setViewMode("list")} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                <List className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setViewMode("graph")} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", viewMode === "graph" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                <Network className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button size="sm" className="h-8"><Plus className="h-3.5 w-3.5 mr-1" />Add Knowledge</Button>
          </div>
        </div>

        {/* Search + Category Filters */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search knowledge..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs pl-8" />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={cn("px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors", activeCategory === cat.id ? "bg-purple-500/20 text-purple-400" : "bg-muted text-muted-foreground hover:text-foreground")}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {viewMode === "graph" ? (
          <div className="flex-1 min-h-0 bg-card/30">
            <KnowledgeGraph entries={filtered} selectedId={selectedEntry} onSelect={setSelectedEntry} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filtered.map((entry) => {
              const agent = agents.find((a) => a.id === entry.createdByAgentId)
              const cat = categories.find((c) => c.id === entry.category)
              return (
                <button key={entry.id} onClick={() => setSelectedEntry(entry.id)} className={cn("w-full text-left rounded-lg border p-3 transition-colors", selectedEntry === entry.id ? "border-purple-500/50 bg-purple-500/5" : "border-border hover:border-purple-500/30")}>
                  <div className="flex items-start gap-3">
                    {agent && <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={28} className="rounded-md border border-border shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium truncate">{entry.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        by {entry.createdBy} · {Math.round((Date.now() - entry.updatedAt.getTime()) / 3600000)}h ago
                        {entry.linkedEntries.length > 0 && <> · <Link2 className="h-3 w-3 inline" /> {entry.linkedEntries.length} linked</>}
                      </p>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {entry.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Right Panel — Entry Detail */}
      {selected && (
        <div className="w-[420px] border-l border-border flex flex-col shrink-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-sm font-bold truncate">{selected.title}</h2>
            <button onClick={() => setSelectedEntry(null)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
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

            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {selected.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>
              ))}
            </div>

            {/* Content */}
            <div className="prose prose-sm prose-invert max-w-none">
              {selected.content.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) return <h4 key={i} className="text-sm font-bold mt-3 mb-1">{line.replace(/\*\*/g, "")}</h4>
                if (line.startsWith("- ")) return <p key={i} className="text-sm text-foreground/80 pl-3 my-0.5">• {line.slice(2)}</p>
                if (line.match(/^\d+\./)) return <p key={i} className="text-sm text-foreground/80 pl-3 my-0.5">{line}</p>
                if (line.trim() === "") return <br key={i} />
                return <p key={i} className="text-sm text-foreground/80 my-0.5">{line}</p>
              })}
            </div>

            {/* Linked Entries */}
            {linkedEntries.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Link2 className="h-3 w-3" /> Linked Knowledge</p>
                <div className="space-y-1.5">
                  {linkedEntries.map((linked) => (
                    <button key={linked.id} onClick={() => setSelectedEntry(linked.id)} className="flex items-center gap-2 w-full text-left rounded-md p-2 hover:bg-accent transition-colors">
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate">{linked.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
