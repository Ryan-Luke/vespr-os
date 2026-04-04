// Agent Archetypes — per engagement spec Section 5 & 6
// Each archetype has evolution forms tied to outcome thresholds

export type ArchetypeId =
  | "scout"
  | "closer"
  | "researcher"
  | "writer"
  | "strategist"
  | "analyst"
  | "operator"
  | "communicator"
  | "builder"

export type Tier = "common" | "uncommon" | "rare" | "epic" | "legendary"

export interface IdentityStats {
  outreach?: number
  research?: number
  negotiation?: number
  execution?: number
  creativity?: number
}

export interface EvolutionForm {
  name: string               // e.g. "Scout", "Senior Scout"
  tier: Tier
  unlockedCapabilities: string[]
  thresholds: {              // requirements to reach this form
    metric: string           // "qualified_leads", "deals_closed", "tasks_shipped", "revenue_sourced"
    value: number
  }[]
}

export interface Archetype {
  id: ArchetypeId
  label: string
  description: string
  icon: string
  color: string              // tier/brand color
  defaultStats: IdentityStats
  forms: EvolutionForm[]     // ordered progression
}

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  scout: {
    id: "scout",
    label: "Scout",
    description: "Finds and qualifies prospects before anyone else sees them.",
    icon: "🔍",
    color: "blue",
    defaultStats: { outreach: 70, research: 85, negotiation: 40, execution: 60, creativity: 50 },
    forms: [
      { name: "Scout", tier: "common", unlockedCapabilities: ["Basic prospect research", "List building"], thresholds: [] },
      { name: "Senior Scout", tier: "uncommon", unlockedCapabilities: ["Multi-source enrichment", "ICP scoring"], thresholds: [{ metric: "qualified_leads", value: 50 }] },
      { name: "Elite Scout", tier: "rare", unlockedCapabilities: ["Predictive intent scoring", "Competitive intelligence"], thresholds: [{ metric: "qualified_leads", value: 200 }, { metric: "revenue_sourced", value: 25000 }] },
      { name: "Pipeline Architect", tier: "epic", unlockedCapabilities: ["Multi-channel pipeline strategy", "Vertical-specific playbooks"], thresholds: [{ metric: "revenue_sourced", value: 100000 }] },
    ],
  },
  closer: {
    id: "closer",
    label: "Closer",
    description: "Turns qualified leads into signed revenue.",
    icon: "🤝",
    color: "emerald",
    defaultStats: { outreach: 75, research: 50, negotiation: 90, execution: 70, creativity: 55 },
    forms: [
      { name: "Closer", tier: "common", unlockedCapabilities: ["Discovery calls", "Basic objection handling"], thresholds: [] },
      { name: "Senior Closer", tier: "uncommon", unlockedCapabilities: ["Multi-stakeholder deals", "Custom proposals"], thresholds: [{ metric: "deals_closed", value: 10 }] },
      { name: "Enterprise Closer", tier: "rare", unlockedCapabilities: ["Complex contract negotiation", "Procurement navigation"], thresholds: [{ metric: "deals_closed", value: 30 }, { metric: "revenue_sourced", value: 100000 }] },
      { name: "Revenue Architect", tier: "legendary", unlockedCapabilities: ["Strategic account expansion", "Multi-year enterprise contracts"], thresholds: [{ metric: "revenue_sourced", value: 500000 }] },
    ],
  },
  researcher: {
    id: "researcher",
    label: "Researcher",
    description: "Goes deep on any topic and delivers defensible insight.",
    icon: "🧠",
    color: "purple",
    defaultStats: { outreach: 30, research: 95, negotiation: 40, execution: 75, creativity: 70 },
    forms: [
      { name: "Researcher", tier: "common", unlockedCapabilities: ["Web research", "Basic synthesis"], thresholds: [] },
      { name: "Senior Researcher", tier: "uncommon", unlockedCapabilities: ["Competitive analysis", "Multi-source synthesis"], thresholds: [{ metric: "documents_delivered", value: 20 }] },
      { name: "Principal Researcher", tier: "rare", unlockedCapabilities: ["Original frameworks", "Executive-grade reports"], thresholds: [{ metric: "documents_delivered", value: 75 }] },
    ],
  },
  writer: {
    id: "writer",
    label: "Writer",
    description: "Turns thinking into publishable words.",
    icon: "✍️",
    color: "amber",
    defaultStats: { outreach: 55, research: 70, negotiation: 40, execution: 80, creativity: 90 },
    forms: [
      { name: "Writer", tier: "common", unlockedCapabilities: ["Blog posts", "Social captions"], thresholds: [] },
      { name: "Senior Writer", tier: "uncommon", unlockedCapabilities: ["Long-form content", "Email sequences"], thresholds: [{ metric: "documents_delivered", value: 25 }] },
      { name: "Content Architect", tier: "rare", unlockedCapabilities: ["Brand voice systems", "Multi-channel content strategy"], thresholds: [{ metric: "documents_delivered", value: 100 }] },
    ],
  },
  strategist: {
    id: "strategist",
    label: "Strategist",
    description: "Sees the board and makes the call.",
    icon: "♟️",
    color: "indigo",
    defaultStats: { outreach: 60, research: 85, negotiation: 70, execution: 65, creativity: 80 },
    forms: [
      { name: "Strategist", tier: "uncommon", unlockedCapabilities: ["Strategic recommendations", "Framework application"], thresholds: [] },
      { name: "Senior Strategist", tier: "rare", unlockedCapabilities: ["Multi-team planning", "Resource allocation"], thresholds: [{ metric: "tasks_shipped", value: 50 }] },
      { name: "Chief Strategist", tier: "epic", unlockedCapabilities: ["Org-wide initiatives", "Board-level planning"], thresholds: [{ metric: "tasks_shipped", value: 200 }] },
    ],
  },
  analyst: {
    id: "analyst",
    label: "Analyst",
    description: "Turns numbers into decisions.",
    icon: "📊",
    color: "cyan",
    defaultStats: { outreach: 30, research: 85, negotiation: 50, execution: 80, creativity: 55 },
    forms: [
      { name: "Analyst", tier: "common", unlockedCapabilities: ["Data collection", "Basic reporting"], thresholds: [] },
      { name: "Senior Analyst", tier: "uncommon", unlockedCapabilities: ["Forecasting", "KPI dashboards"], thresholds: [{ metric: "documents_delivered", value: 30 }] },
      { name: "Principal Analyst", tier: "rare", unlockedCapabilities: ["Predictive models", "Executive reporting"], thresholds: [{ metric: "documents_delivered", value: 100 }] },
    ],
  },
  operator: {
    id: "operator",
    label: "Operator",
    description: "Keeps the machine running.",
    icon: "⚙️",
    color: "slate",
    defaultStats: { outreach: 40, research: 60, negotiation: 55, execution: 95, creativity: 45 },
    forms: [
      { name: "Operator", tier: "common", unlockedCapabilities: ["Process execution", "Task handoffs"], thresholds: [] },
      { name: "Senior Operator", tier: "uncommon", unlockedCapabilities: ["Process improvement", "SOP authoring"], thresholds: [{ metric: "tasks_shipped", value: 100 }] },
      { name: "Ops Manager", tier: "rare", unlockedCapabilities: ["Cross-team orchestration", "Quality systems"], thresholds: [{ metric: "tasks_shipped", value: 500 }] },
    ],
  },
  communicator: {
    id: "communicator",
    label: "Communicator",
    description: "Makes clients feel seen and supported.",
    icon: "💬",
    color: "rose",
    defaultStats: { outreach: 85, research: 50, negotiation: 75, execution: 70, creativity: 65 },
    forms: [
      { name: "Communicator", tier: "common", unlockedCapabilities: ["Client correspondence", "Basic support"], thresholds: [] },
      { name: "Account Manager", tier: "uncommon", unlockedCapabilities: ["Relationship management", "QBRs"], thresholds: [{ metric: "meetings_booked", value: 50 }] },
      { name: "Client Success Lead", tier: "rare", unlockedCapabilities: ["Retention strategy", "Expansion playbooks"], thresholds: [{ metric: "meetings_booked", value: 200 }] },
    ],
  },
  builder: {
    id: "builder",
    label: "Builder",
    description: "Ships the system that ships the work.",
    icon: "🛠️",
    color: "orange",
    defaultStats: { outreach: 35, research: 75, negotiation: 40, execution: 95, creativity: 80 },
    forms: [
      { name: "Builder", tier: "uncommon", unlockedCapabilities: ["Single workflow builds", "Basic integrations"], thresholds: [] },
      { name: "Senior Builder", tier: "rare", unlockedCapabilities: ["Multi-step workflows", "Error handling"], thresholds: [{ metric: "tasks_shipped", value: 30 }] },
      { name: "Automation Architect", tier: "epic", unlockedCapabilities: ["System-wide orchestration", "Custom AI agents"], thresholds: [{ metric: "tasks_shipped", value: 100 }] },
    ],
  },
}

export const TIER_STYLES: Record<Tier, { label: string; bg: string; border: string; text: string; glow: string }> = {
  common:     { label: "Common",    bg: "bg-slate-500/5",    border: "border-slate-500/20",    text: "text-slate-300",    glow: "" },
  uncommon:   { label: "Uncommon",  bg: "bg-emerald-500/5",  border: "border-emerald-500/30",  text: "text-emerald-400",  glow: "" },
  rare:       { label: "Rare",      bg: "bg-blue-500/8",     border: "border-blue-500/40",     text: "text-blue-400",     glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]" },
  epic:       { label: "Epic",      bg: "bg-purple-500/10",  border: "border-purple-500/50",   text: "text-purple-400",   glow: "shadow-[0_0_24px_rgba(168,85,247,0.2)]" },
  legendary:  { label: "Legendary", bg: "bg-amber-500/10",   border: "border-amber-500/60",    text: "text-amber-400",    glow: "shadow-[0_0_32px_rgba(245,158,11,0.25)]" },
}

/** Determine the current form of an agent based on their outcome stats */
export function getCurrentForm(
  archetypeId: ArchetypeId,
  stats: { qualified_leads?: number; deals_closed?: number; tasks_shipped?: number; revenue_sourced?: number; meetings_booked?: number; documents_delivered?: number }
): EvolutionForm {
  const archetype = ARCHETYPES[archetypeId]
  if (!archetype) return ARCHETYPES.operator.forms[0]

  // Check forms in reverse — highest unlocked form wins
  for (let i = archetype.forms.length - 1; i >= 0; i--) {
    const form = archetype.forms[i]
    if (form.thresholds.length === 0) return form // starter form always unlocked
    const allMet = form.thresholds.every((t) => (stats[t.metric as keyof typeof stats] ?? 0) >= t.value)
    if (allMet) return form
  }
  return archetype.forms[0]
}

/** Pick a sensible archetype for an agent based on their role */
export function inferArchetype(role: string): ArchetypeId {
  const r = role.toLowerCase()
  if (r.includes("lead") && r.includes("research")) return "scout"
  if (r.includes("outreach") || r.includes("sales") && !r.includes("manager")) return "closer"
  if (r.includes("research") || r.includes("analyst") && r.includes("seo")) return "researcher"
  if (r.includes("writer") || r.includes("content")) return "writer"
  if (r.includes("strategist") || r.includes("chief of staff")) return "strategist"
  if (r.includes("analyst") || r.includes("bookkeeper") || r.includes("p&l") || r.includes("finance")) return "analyst"
  if (r.includes("operator") || r.includes("crm") || r.includes("process") || r.includes("tracker")) return "operator"
  if (r.includes("support") || r.includes("success") || r.includes("account")) return "communicator"
  if (r.includes("automation") || r.includes("architect") || r.includes("builder")) return "builder"
  return "operator"
}
