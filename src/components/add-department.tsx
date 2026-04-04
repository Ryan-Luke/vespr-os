"use client"

import { useState } from "react"
import { X, Plus, ChevronRight, Loader2, Target, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

// Standard departments companies can add
const DEPARTMENT_PRESETS = [
  // Core business
  { id: "marketing", name: "Marketing", icon: "📣", description: "Brand, content, social media, advertising, and growth", goals: ["Grow monthly leads by 30%", "Publish 20 content pieces/month", "Increase brand awareness"] },
  { id: "sales", name: "Sales", icon: "💰", description: "Lead generation, outreach, closing, and pipeline management", goals: ["Hit $100K monthly revenue", "Close 50 deals/month", "Maintain 30% close rate"] },
  { id: "operations", name: "Operations", icon: "⚙️", description: "Automation, workflows, systems, and process optimization", goals: ["Automate 80% of repetitive tasks", "Reduce processing time by 50%", "Zero system downtime"] },
  { id: "finance", name: "Finance", icon: "📊", description: "Bookkeeping, invoicing, budgets, P&L, and financial planning", goals: ["Maintain positive cash flow", "Complete monthly close in 3 days", "Reduce costs by 10%"] },
  { id: "fulfillment", name: "Fulfillment", icon: "📦", description: "Customer support, delivery, shipping, and satisfaction", goals: ["Maintain 95% satisfaction rate", "Under 2hr response time", "Zero missed deliveries"] },
  // Growth departments
  { id: "product", name: "Product", icon: "🔧", description: "Product development, roadmap, features, and user research", goals: ["Ship 4 features/quarter", "Maintain 90% user satisfaction", "Reduce bug count by 50%"] },
  { id: "engineering", name: "Engineering", icon: "💻", description: "Development, infrastructure, DevOps, and technical debt", goals: ["99.9% uptime", "Ship on schedule", "Reduce deploy time to under 5 min"] },
  { id: "design", name: "Design", icon: "🎨", description: "UI/UX, brand identity, visual design, and user experience", goals: ["Complete design system", "User test every major feature", "Maintain brand consistency"] },
  { id: "hr", name: "People & HR", icon: "👥", description: "Hiring, culture, onboarding, performance, and team health", goals: ["Fill open roles in 30 days", "90% employee satisfaction", "Complete quarterly reviews"] },
  { id: "legal", name: "Legal & Compliance", icon: "⚖️", description: "Contracts, compliance, IP protection, and risk management", goals: ["Review all contracts within 48hr", "Zero compliance violations", "Update policies quarterly"] },
  // Specialized
  { id: "data", name: "Data & Analytics", icon: "📈", description: "Business intelligence, reporting, dashboards, and insights", goals: ["Weekly KPI reports automated", "Identify 3 insights/month", "Real-time dashboard for all teams"] },
  { id: "partnerships", name: "Partnerships", icon: "🤝", description: "Strategic partnerships, affiliates, integrations, and BD", goals: ["Sign 5 new partners/quarter", "Launch 3 co-marketing campaigns", "Grow referral revenue 20%"] },
  { id: "content", name: "Content", icon: "✍️", description: "Blog, video, podcast, newsletter, and thought leadership", goals: ["Publish 3x/week", "Grow email list to 10K", "Launch company podcast"] },
  { id: "customer-success", name: "Customer Success", icon: "🌟", description: "Onboarding, retention, upsells, health scores, and NPS", goals: ["Reduce churn to under 5%", "NPS score above 70", "Onboard new customers in 24hr"] },
  { id: "r-and-d", name: "R&D", icon: "🧪", description: "Research, experimentation, innovation, and new opportunities", goals: ["Test 3 new ideas/month", "Validate 1 new revenue stream/quarter", "Document all experiments"] },
  { id: "supply-chain", name: "Supply Chain", icon: "🚚", description: "Procurement, inventory, logistics, and vendor management", goals: ["Reduce lead time by 20%", "Maintain 98% inventory accuracy", "Negotiate 10% cost savings"] },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function AddDepartmentModal({ open, onClose }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<"pick" | "custom" | "configure">("pick")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<typeof DEPARTMENT_PRESETS[0] | null>(null)
  const [customName, setCustomName] = useState("")
  const [customIcon, setCustomIcon] = useState("⚙️")
  const [customDesc, setCustomDesc] = useState("")
  const [goals, setGoals] = useState<string[]>([""])
  const [creating, setCreating] = useState(false)

  if (!open) return null

  const filtered = DEPARTMENT_PRESETS.filter((d) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.description.toLowerCase().includes(search.toLowerCase())
  )

  async function createDepartment() {
    const name = step === "custom" ? customName : selected?.name
    const icon = step === "custom" ? customIcon : selected?.icon
    const desc = step === "custom" ? customDesc : selected?.description
    const deptGoals = step === "custom" ? goals.filter((g) => g.trim()) : selected?.goals || []

    if (!name?.trim()) return
    setCreating(true)

    try {
      // Create team
      const team = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc, icon }),
      }).then((r) => r.json())

      // Create goals
      for (const goal of deptGoals) {
        await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId: team.id, title: goal, target: 100, progress: 0, unit: "%" }),
        }).catch(() => {})
      }

      onClose()
      router.refresh()
    } catch { /* silent */ }
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold">{step === "pick" ? "Add Department" : step === "custom" ? "Custom Department" : `Configure ${selected?.name}`}</h2>
          <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        {/* Pick preset */}
        {step === "pick" && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input placeholder="Search departments..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-8 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
              </div>
            </div>
            <div className="p-3 space-y-1">
              {filtered.map((dept) => (
                <button key={dept.id} onClick={() => { setSelected(dept); setGoals(dept.goals); setStep("configure") }} className="w-full flex items-center gap-3 rounded-md p-3 text-left hover:bg-accent transition-colors">
                  <span className="text-lg">{dept.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium">{dept.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{dept.description}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border">
              <button onClick={() => setStep("custom")} className="w-full flex items-center gap-3 rounded-md p-3 text-left border border-dashed border-border hover:border-muted-foreground/30 transition-colors">
                <Plus className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[13px] font-medium">Custom Department</p>
                  <p className="text-xs text-muted-foreground">Build your own from scratch</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Custom department form */}
        {step === "custom" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Icon</label>
                <input value={customIcon} onChange={(e) => setCustomIcon(e.target.value)} className="h-10 w-12 rounded-md border border-border bg-muted/50 text-center text-lg outline-none" />
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[13px] font-medium">Department Name</label>
                <input placeholder="e.g., Growth" value={customName} onChange={(e) => setCustomName(e.target.value)} className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Description</label>
              <textarea placeholder="What does this department do?" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Goals</label>
              {goals.map((g, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder={`Goal ${i + 1}`} value={g} onChange={(e) => setGoals((prev) => prev.map((p, j) => j === i ? e.target.value : p))} className="flex-1 h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
                  {goals.length > 1 && <button onClick={() => setGoals((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400"><X className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
              <button onClick={() => setGoals((prev) => [...prev, ""])} className="text-[11px] text-primary hover:underline">+ Add goal</button>
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep("pick")} className="text-xs text-muted-foreground hover:text-foreground">Back</button>
              <button onClick={createDepartment} disabled={!customName.trim() || creating} className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Create Department
              </button>
            </div>
          </div>
        )}

        {/* Configure preset */}
        {step === "configure" && selected && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selected.icon}</span>
              <div>
                <p className="text-[13px] font-semibold">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.description}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-[13px] font-medium">Department Goals</label>
              </div>
              <p className="text-[11px] text-muted-foreground">These goals will be tracked on the teams page. You can edit them later.</p>
              {goals.map((g, i) => (
                <div key={i} className="flex gap-2">
                  <input value={g} onChange={(e) => setGoals((prev) => prev.map((p, j) => j === i ? e.target.value : p))} className="flex-1 h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
                  {goals.length > 1 && <button onClick={() => setGoals((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400"><X className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
              <button onClick={() => setGoals((prev) => [...prev, ""])} className="text-[11px] text-primary hover:underline">+ Add goal</button>
            </div>

            <div className="bg-muted/30 rounded-md p-3">
              <p className="text-[11px] text-muted-foreground">This will create:</p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <li>• A <strong>{selected.name}</strong> department with {goals.filter((g) => g.trim()).length} goals</li>
                <li>• A <strong>#{selected.name.toLowerCase().replace(/\s+/g, "-")}</strong> team channel</li>
                <li>• You can hire agents for this department from the builder</li>
              </ul>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => { setStep("pick"); setSelected(null) }} className="text-xs text-muted-foreground hover:text-foreground">Back</button>
              <button onClick={createDepartment} disabled={creating} className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Add {selected.name}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
