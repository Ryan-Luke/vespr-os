"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PlusCircle,
  Brain,
  Globe,
  Mail,
  Database,
  Calendar,
  FileText,
  Search,
  MessageSquare,
  BarChart3,
  ShoppingCart,
  Megaphone,
  Headphones,
  Code,
  Wrench,
  Loader2,
  SlidersHorizontal,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  PERSONALITY_PRESETS,
  TRAIT_LABELS,
  DEFAULT_TRAITS,
  CATEGORY_INFO,
  COMMUNICATION_AXES,
  TEMPERAMENT_OPTIONS,
  SOCIAL_OPTIONS,
  HUMOR_OPTIONS,
  ENERGY_OPTIONS,
  QUIRK_OPTIONS,
  DEFAULT_CUSTOM_PERSONALITY,
  type PersonalityTraits,
  type PersonalityPreset,
  type CustomPersonalityConfig,
} from "@/lib/personality-presets"

const skillOptions = [
  { id: "web-search", name: "Web Search", icon: Globe, description: "Search the internet for information" },
  { id: "email", name: "Email", icon: Mail, description: "Send and read emails" },
  { id: "crm", name: "CRM Access", icon: Database, description: "Read and write CRM data" },
  { id: "calendar", name: "Calendar", icon: Calendar, description: "Manage calendar events" },
  { id: "file-mgmt", name: "File Management", icon: FileText, description: "Create and edit documents" },
  { id: "research", name: "Deep Research", icon: Search, description: "Conduct thorough research on topics" },
  { id: "messaging", name: "Messaging", icon: MessageSquare, description: "Post to Slack, Teams, etc." },
  { id: "analytics", name: "Analytics", icon: BarChart3, description: "Access analytics data" },
  { id: "ecommerce", name: "E-commerce", icon: ShoppingCart, description: "Manage orders and inventory" },
  { id: "social", name: "Social Media", icon: Megaphone, description: "Post to social platforms" },
  { id: "support", name: "Customer Support", icon: Headphones, description: "Handle support tickets" },
  { id: "coding", name: "Code Generation", icon: Code, description: "Write and review code" },
]

const genericTemplates = [
  { id: "content-writer", name: "Content Writer", role: "Content Writer", team: "Marketing", description: "Writes blog posts, articles, and marketing copy", suggestedSkills: ["web-search", "file-mgmt", "social"] },
  { id: "lead-gen", name: "Lead Generator", role: "Lead Researcher", team: "Sales", description: "Finds and qualifies prospects matching your ICP", suggestedSkills: ["web-search", "crm", "email", "research"] },
  { id: "support-agent", name: "Support Agent", role: "Customer Support", team: "Fulfillment", description: "Handles customer inquiries and support tickets", suggestedSkills: ["support", "messaging", "crm"] },
  { id: "bookkeeper", name: "Bookkeeper", role: "Bookkeeper", team: "Finance", description: "Categorizes transactions and maintains financial records", suggestedSkills: ["file-mgmt", "analytics"] },
  { id: "social-mgr", name: "Social Media Manager", role: "Social Media Manager", team: "Marketing", description: "Creates and schedules social media content", suggestedSkills: ["social", "analytics", "file-mgmt", "calendar"] },
]

const departmentTemplates: Record<string, typeof genericTemplates> = {
  Marketing: [
    { id: "mkt-content-writer", name: "Content Writer", role: "Content Writer", team: "Marketing", description: "Writes blog posts, articles, and marketing copy", suggestedSkills: ["web-search", "file-mgmt", "social", "research"] },
    { id: "mkt-seo", name: "SEO Specialist", role: "SEO Specialist", team: "Marketing", description: "Optimizes content for search engines and tracks rankings", suggestedSkills: ["web-search", "analytics", "research"] },
    { id: "mkt-social", name: "Social Media Manager", role: "Social Media Manager", team: "Marketing", description: "Creates and schedules social media content across platforms", suggestedSkills: ["social", "analytics", "file-mgmt", "calendar"] },
    { id: "mkt-ads", name: "Ad Campaign Manager", role: "Ad Campaign Manager", team: "Marketing", description: "Manages paid advertising campaigns and optimizes spend", suggestedSkills: ["analytics", "web-search", "research"] },
    { id: "mkt-brand", name: "Brand Strategist", role: "Brand Strategist", team: "Marketing", description: "Develops brand voice, positioning, and messaging guidelines", suggestedSkills: ["research", "file-mgmt", "web-search"] },
    { id: "mkt-email", name: "Email Marketing Specialist", role: "Email Marketing Specialist", team: "Marketing", description: "Creates email campaigns, sequences, and newsletters", suggestedSkills: ["email", "analytics", "crm", "file-mgmt"] },
  ],
  Sales: [
    { id: "sales-researcher", name: "Lead Researcher", role: "Lead Researcher", team: "Sales", description: "Finds and qualifies prospects matching your ICP", suggestedSkills: ["web-search", "crm", "email", "research"] },
    { id: "sales-ae", name: "Account Executive", role: "Account Executive", team: "Sales", description: "Manages deals through the pipeline and closes opportunities", suggestedSkills: ["crm", "email", "calendar", "messaging"] },
    { id: "sales-sdr", name: "SDR (Sales Dev Rep)", role: "Sales Development Rep", team: "Sales", description: "Handles outbound outreach and books qualified meetings", suggestedSkills: ["email", "crm", "web-search", "calendar"] },
    { id: "sales-ops", name: "Sales Ops Analyst", role: "Sales Ops Analyst", team: "Sales", description: "Analyzes pipeline data and optimizes sales processes", suggestedSkills: ["analytics", "crm", "file-mgmt"] },
    { id: "sales-partner", name: "Partnership Manager", role: "Partnership Manager", team: "Sales", description: "Identifies and manages strategic partnership opportunities", suggestedSkills: ["web-search", "email", "crm", "research"] },
  ],
  Operations: [
    { id: "ops-automation", name: "Automation Architect", role: "Automation Architect", team: "Operations", description: "Designs and builds workflow automations across tools", suggestedSkills: ["coding", "file-mgmt", "messaging", "analytics"] },
    { id: "ops-pm", name: "Project Manager", role: "Project Manager", team: "Operations", description: "Tracks project timelines, tasks, and team coordination", suggestedSkills: ["calendar", "messaging", "file-mgmt"] },
    { id: "ops-process", name: "Process Analyst", role: "Process Analyst", team: "Operations", description: "Maps and optimizes business processes for efficiency", suggestedSkills: ["analytics", "file-mgmt", "research"] },
    { id: "ops-sysadmin", name: "Systems Admin", role: "Systems Admin", team: "Operations", description: "Manages integrations, permissions, and system health", suggestedSkills: ["coding", "analytics", "messaging"] },
  ],
  Finance: [
    { id: "fin-bookkeeper", name: "Bookkeeper", role: "Bookkeeper", team: "Finance", description: "Categorizes transactions and maintains financial records", suggestedSkills: ["file-mgmt", "analytics"] },
    { id: "fin-analyst", name: "Financial Analyst", role: "Financial Analyst", team: "Finance", description: "Analyzes financial data, trends, and forecasts", suggestedSkills: ["analytics", "research", "file-mgmt"] },
    { id: "fin-budget", name: "Budget Manager", role: "Budget Manager", team: "Finance", description: "Tracks budgets, spending, and cost optimization", suggestedSkills: ["analytics", "file-mgmt", "email"] },
    { id: "fin-ap-ar", name: "Accounts Payable/Receivable", role: "AP/AR Specialist", team: "Finance", description: "Manages invoices, payments, and collections", suggestedSkills: ["email", "file-mgmt", "analytics"] },
  ],
  Fulfillment: [
    { id: "ful-support", name: "Customer Support", role: "Customer Support", team: "Fulfillment", description: "Handles customer inquiries and resolves support tickets", suggestedSkills: ["support", "messaging", "crm", "email"] },
    { id: "ful-shipping", name: "Shipping Coordinator", role: "Shipping Coordinator", team: "Fulfillment", description: "Tracks shipments, manages logistics, and handles delays", suggestedSkills: ["ecommerce", "email", "messaging"] },
    { id: "ful-returns", name: "Returns Manager", role: "Returns Manager", team: "Fulfillment", description: "Processes returns, exchanges, and refund requests", suggestedSkills: ["support", "ecommerce", "email"] },
    { id: "ful-qa", name: "Quality Assurance", role: "Quality Assurance", team: "Fulfillment", description: "Monitors service quality and ensures standards are met", suggestedSkills: ["analytics", "support", "file-mgmt"] },
  ],
  Product: [
    { id: "prod-pm", name: "Product Manager", role: "Product Manager", team: "Product", description: "Prioritizes features, manages roadmap, and gathers requirements", suggestedSkills: ["research", "analytics", "file-mgmt", "messaging"] },
    { id: "prod-ux", name: "UX Researcher", role: "UX Researcher", team: "Product", description: "Conducts user research and synthesizes feedback", suggestedSkills: ["research", "web-search", "analytics", "file-mgmt"] },
    { id: "prod-feature", name: "Feature Analyst", role: "Feature Analyst", team: "Product", description: "Analyzes feature usage, impact, and competitive landscape", suggestedSkills: ["analytics", "research", "web-search"] },
  ],
  Engineering: [
    { id: "eng-fullstack", name: "Full Stack Developer", role: "Full Stack Developer", team: "Engineering", description: "Builds and maintains frontend and backend features", suggestedSkills: ["coding", "web-search", "file-mgmt"] },
    { id: "eng-devops", name: "DevOps Engineer", role: "DevOps Engineer", team: "Engineering", description: "Manages CI/CD, infrastructure, and deployments", suggestedSkills: ["coding", "analytics", "messaging"] },
    { id: "eng-qa", name: "QA Tester", role: "QA Tester", team: "Engineering", description: "Writes and runs tests, reports bugs, ensures quality", suggestedSkills: ["coding", "file-mgmt", "analytics"] },
  ],
  Design: [
    { id: "des-ui", name: "UI Designer", role: "UI Designer", team: "Design", description: "Designs interfaces, components, and design systems", suggestedSkills: ["file-mgmt", "web-search", "research"] },
    { id: "des-brand", name: "Brand Designer", role: "Brand Designer", team: "Design", description: "Creates brand assets, guidelines, and visual identity", suggestedSkills: ["file-mgmt", "web-search", "research"] },
    { id: "des-motion", name: "Motion Designer", role: "Motion Designer", team: "Design", description: "Creates animations, transitions, and video content", suggestedSkills: ["file-mgmt", "web-search"] },
  ],
}

const customTemplate = { id: "custom", name: "Custom Agent", role: "", team: "", description: "Build from scratch with full customization", suggestedSkills: [] as string[] }

function getTemplatesForTeam(teamName: string | null): typeof genericTemplates {
  if (!teamName) return [...genericTemplates, customTemplate]
  const normalized = teamName.charAt(0).toUpperCase() + teamName.slice(1).toLowerCase()
  const deptTemplates = departmentTemplates[normalized] || departmentTemplates[teamName]
  if (deptTemplates) return [...deptTemplates, customTemplate]
  return [...genericTemplates, customTemplate]
}

export default function BuilderPageWrapper() {
  return <Suspense><BuilderPageInner /></Suspense>
}

function BuilderPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillTeam = searchParams.get("team")
  const prefillTeamId = searchParams.get("teamId")
  const isClone = searchParams.get("clone") === "true"
  const cloneName = searchParams.get("name")
  const cloneRole = searchParams.get("role")
  const cloneTeamId = searchParams.get("teamId")
  const cloneSkills = searchParams.get("skills")
  const clonePersonality = searchParams.get("personality")
  const cloneAutonomy = searchParams.get("autonomy")
  const prefillArchetype = searchParams.get("archetype")
  const [step, setStep] = useState(prefillTeam || isClone || prefillArchetype ? 1 : 0) // skip template if coming from team page, cloning, or roster
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(isClone || prefillArchetype ? "custom" : null)
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(() => {
    if (isClone && cloneSkills) {
      const names = cloneSkills.split(",")
      const ids = names.map((name) => {
        const match = skillOptions.find((s) => s.name === name)
        return match ? match.id : null
      }).filter(Boolean) as string[]
      return new Set(ids)
    }
    return new Set()
  })
  const [agentName, setAgentName] = useState(isClone && cloneName ? cloneName : "")
  const archetypeRoleMap: Record<string, string> = {
    scout: "Lead Researcher", closer: "Sales Lead", researcher: "Research Analyst",
    writer: "Content Strategist", strategist: "Business Strategist", analyst: "Data Analyst",
    operator: "Operations Manager", communicator: "Communications Lead", builder: "Dev Coordinator",
  }
  const [agentRole, setAgentRole] = useState(
    isClone && cloneRole ? cloneRole :
    prefillArchetype ? (archetypeRoleMap[prefillArchetype] || "") : ""
  )
  const [agentTeam, setAgentTeam] = useState(prefillTeam || "")
  const [agentProvider, setAgentProvider] = useState("")
  const [agentDescription, setAgentDescription] = useState("")
  const [agentAutonomy, setAgentAutonomy] = useState(isClone && cloneAutonomy ? cloneAutonomy : "supervised")
  const [creating, setCreating] = useState(false)
  const [dbTeams, setDbTeams] = useState<{ id: string; name: string; icon: string }[]>([])

  // Personality state
  const [personalityMode, setPersonalityMode] = useState<"preset" | "sliders" | "custom">("preset")
  const [selectedPreset, setSelectedPreset] = useState<PersonalityPreset | null>(null)
  const [customTraits, setCustomTraits] = useState<PersonalityTraits>({ ...DEFAULT_TRAITS })
  const [customConfig, setCustomConfig] = useState<CustomPersonalityConfig>({ ...DEFAULT_CUSTOM_PERSONALITY, temperament: [...DEFAULT_CUSTOM_PERSONALITY.temperament], social: [...DEFAULT_CUSTOM_PERSONALITY.social], humor: [...DEFAULT_CUSTOM_PERSONALITY.humor], quirks: [...DEFAULT_CUSTOM_PERSONALITY.quirks], catchphrases: [...DEFAULT_CUSTOM_PERSONALITY.catchphrases], communication: { ...DEFAULT_CUSTOM_PERSONALITY.communication } })
  const [newCatchphrase, setNewCatchphrase] = useState("")
  const [presetSearch, setPresetSearch] = useState("")
  const [presetCategory, setPresetCategory] = useState<string>("all")

  const filteredPresets = useMemo(() => {
    return PERSONALITY_PRESETS.filter((p) => {
      const matchesSearch = !presetSearch || p.name.toLowerCase().includes(presetSearch.toLowerCase()) || p.description.toLowerCase().includes(presetSearch.toLowerCase())
      const matchesCategory = presetCategory === "all" || p.category === presetCategory
      return matchesSearch && matchesCategory
    })
  }, [presetSearch, presetCategory])

  useEffect(() => {
    fetch("/api/teams").then((r) => r.json()).then((teams) => {
      setDbTeams(teams)
      // When cloning, resolve teamId to team name
      if (isClone && cloneTeamId) {
        const match = teams.find((t: { id: string; name: string }) => t.id === cloneTeamId)
        if (match) setAgentTeam(match.name)
      }
    })
  }, [])

  // Pre-select personality preset when cloning
  useEffect(() => {
    if (isClone && clonePersonality) {
      const preset = PERSONALITY_PRESETS.find((p) => p.id === clonePersonality)
      if (preset) {
        setSelectedPreset(preset)
        setPersonalityMode("preset")
      }
    }
  }, [])

  function toggleSkill(id: string) {
    setSelectedSkills((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const activeTemplates = useMemo(() => getTemplatesForTeam(prefillTeam), [prefillTeam])

  function selectTemplate(id: string) {
    const template = activeTemplates.find((t) => t.id === id)
    if (template) {
      setSelectedTemplate(id)
      if (template.role) setAgentRole(template.role)
      if (template.team) setAgentTeam(template.team)
      if (template.suggestedSkills && template.suggestedSkills.length > 0) {
        setSelectedSkills(new Set(template.suggestedSkills))
      }
      setStep(1)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto h-full overflow-y-auto">
      <h1 className="text-lg font-semibold tracking-tight">Hire Agent</h1>

      {/* Progress Steps */}
      <div className="flex items-center gap-1">
        {["Template", "Details", "Personality", "Skills", "Review"].map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <button
              onClick={() => i <= step && setStep(i)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                i === step
                  ? "bg-[#635bff]/10 text-[#635bff] font-medium"
                  : i < step
                  ? "text-[#635bff]"
                  : "text-[rgba(255,255,255,0.2)]"
              )}
            >
              <span className="font-mono text-[10px] tabular-nums">{i + 1}</span>
              {label}
            </button>
            {i < 4 && (
              <div className={cn("h-px w-4", i < step ? "bg-[#635bff]" : "bg-[#1e2a4a]")} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Template Selection */}
      {step === 0 && (
        <div className="space-y-3">
        {prefillTeam && (
          <p className="text-xs text-muted-foreground">Showing roles for <span className="font-medium text-foreground">{prefillTeam}</span> team</p>
        )}
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {activeTemplates.map((template) => (
            <button
              key={template.id}
              className={cn(
                "text-left rounded-xl border p-3 transition-all hover:border-muted-foreground/30 bg-[#1a1a2e] border border-[rgba(255,255,255,0.08)] rounded-xl",
                selectedTemplate === template.id ? "border-[#635bff]" : "border-border"
              )}
              onClick={() => selectTemplate(template.id)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {template.id === "custom" ? <Wrench className="h-3.5 w-3.5 text-muted-foreground" /> : <Wrench className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-[13px] font-medium">{template.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{template.description}</p>
              {template.team && <p className="text-[11px] text-muted-foreground mt-1.5">{template.team}</p>}
            </button>
          ))}
        </div>
        </div>
      )}

      {/* Step 1: Agent Details */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-md p-4 space-y-4">
          <p className="section-label">Agent Details</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Name</label>
              <input placeholder="e.g., Maya, Jordan" value={agentName} onChange={(e) => setAgentName(e.target.value)} className="w-full h-8 rounded-lg bg-[#16213e] border border-[rgba(255,255,255,0.08)] rounded-xl focus:border-[#635bff] px-3 text-[13px] outline-none transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Role</label>
              <input placeholder="e.g., Content Writer" value={agentRole} onChange={(e) => setAgentRole(e.target.value)} className="w-full h-8 rounded-lg bg-[#16213e] border border-[rgba(255,255,255,0.08)] rounded-xl focus:border-[#635bff] px-3 text-[13px] outline-none transition-colors" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Team</label>
              <Select value={agentTeam} onValueChange={(v) => setAgentTeam(v ?? "")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {dbTeams.map((t) => <SelectItem key={t.id} value={t.name}>{t.icon} {t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Provider</label>
              <Select value={agentProvider} onValueChange={(v) => setAgentProvider(v ?? "")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                  <SelectItem value="google">Google (Gemini)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Autonomy</label>
            <Select value={agentAutonomy} onValueChange={(v) => setAgentAutonomy(v ?? "supervised")}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_auto">Full Auto</SelectItem>
                <SelectItem value="supervised">Supervised</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {agentAutonomy === "full_auto" ? "Works independently." : agentAutonomy === "supervised" ? "Asks before key actions." : "Only works when asked."}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Description</label>
            <textarea placeholder="Describe what this agent should do..." value={agentDescription} onChange={(e) => setAgentDescription(e.target.value)} rows={3} className="w-full rounded-lg bg-[#16213e] border border-[rgba(255,255,255,0.08)] rounded-xl focus:border-[#635bff] px-3 py-2 text-[13px] outline-none resize-none transition-colors" />
            </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => setStep(2)} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">Next</button>
          </div>
        </div>
      )}

      {/* Step 2: Personality */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Mode Toggle: Preset / Sliders / Full Custom */}
          <div className="flex gap-1">
            <button onClick={() => { setPersonalityMode("preset"); }} className={cn("h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors", personalityMode === "preset" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}><Settings className="h-3.5 w-3.5" />Preset</button>
            <button onClick={() => { setPersonalityMode("sliders"); setSelectedPreset(null) }} className={cn("h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors", personalityMode === "sliders" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}><SlidersHorizontal className="h-3.5 w-3.5" />Sliders</button>
            <button onClick={() => { setPersonalityMode("custom"); setSelectedPreset(null) }} className={cn("h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors", personalityMode === "custom" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}><Brain className="h-3.5 w-3.5" />Full Custom</button>
          </div>

          {/* Preset Mode */}
          {personalityMode === "preset" && (
            <div className="bg-card border border-border rounded-md">
              <div>
                <p className="section-label mb-2">
                  <Settings className="h-4 w-4" />
                  Character Library
                </p>
                <p className="text-xs text-muted-foreground">
                  Choose a famous personality — your agent will communicate in their style
                </p>
              </div>
              <div>
                {/* Search + Filter */}
                <div className="flex gap-2">
                  <input
                    placeholder="Search characters..."
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={presetCategory} onValueChange={(v) => setPresetCategory(v ?? "all")}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.entries(CATEGORY_INFO).map(([key, { label, icon }]) => (
                        <SelectItem key={key} value={key}>{icon} {label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Character Grid */}
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto pr-1">
                  {filteredPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedPreset(preset)}
                      className={cn(
                        "flex flex-col gap-1 rounded-md border p-3 text-left transition-all hover:border-muted-foreground/30",
                        selectedPreset?.id === preset.id
                          ? "bg-white/10 border-white/20"
                          : "border-border"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{preset.name}</span>
                        <span className="text-[11px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                          {CATEGORY_INFO[preset.category].icon}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {preset.description}
                      </p>
                    </button>
                  ))}
                  {filteredPresets.length === 0 && (
                    <p className="text-xs text-muted-foreground col-span-3 text-center py-8">
                      No characters found
                    </p>
                  )}
                </div>

                {/* Selected Preview */}
                {selectedPreset && (
                  <div className="rounded-md border border-white/20 bg-white/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-[13px]">{selectedPreset.name}</h4>
                        <p className="text-xs text-muted-foreground">{selectedPreset.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{CATEGORY_INFO[selectedPreset.category].label}</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Communication style</p>
                      <p className="text-xs italic">&ldquo;{selectedPreset.speechStyle}&rdquo;</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {(Object.entries(selectedPreset.traits) as [keyof PersonalityTraits, number][]).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-20">{TRAIT_LABELS[key].name}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${val}%` }} />
                          </div>
                          <span className="text-xs font-mono w-7 text-right">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sliders Mode — the classic 7-slider system */}
          {personalityMode === "sliders" && (
            <div className="bg-card border border-border rounded-md p-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-foreground">Trait Sliders</p>
                <p className="text-[11px] text-muted-foreground">Fine-tune each personality dimension manually</p>
              </div>
              <div className="space-y-3">
                {(Object.entries(TRAIT_LABELS) as [keyof PersonalityTraits, { name: string; low: string; high: string }][]).map(([key, meta]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium">{meta.name}</span>
                      <span className="text-xs font-mono text-muted-foreground w-7 text-right">{customTraits[key]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-16 text-right">{meta.low}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={customTraits[key]}
                        onChange={(e) => setCustomTraits((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        className="flex-1 h-1.5 accent-primary"
                      />
                      <span className="text-[11px] text-muted-foreground w-16">{meta.high}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Custom Mode — PVD v2 trait categories */}
          {personalityMode === "custom" && (
            <div className="space-y-3">
              {/* Communication Style — pick one per axis */}
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Communication Style</p>
                  <p className="text-[11px] text-muted-foreground">How your agent speaks — pick one per row</p>
                </div>
                <div className="space-y-3">
                  {(Object.entries(COMMUNICATION_AXES) as [keyof typeof COMMUNICATION_AXES, typeof COMMUNICATION_AXES[keyof typeof COMMUNICATION_AXES]][]).map(([key, axis]) => (
                    <div key={key}>
                      <label className="text-[11px] text-muted-foreground mb-1.5 block">{axis.label}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {axis.options.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setCustomConfig((prev) => ({ ...prev, communication: { ...prev.communication, [key]: opt.id } }))}
                            className={cn(
                              "rounded-md border px-3 py-2 text-[13px] text-left transition-all",
                              customConfig.communication[key] === opt.id
                                ? "bg-white/10 border-white/20"
                                : "bg-card border-border hover:border-muted-foreground/30"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Temperament — pick 2-3 */}
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Temperament</p>
                  <p className="text-[11px] text-muted-foreground">Their core emotional nature — pick 2-3</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TEMPERAMENT_OPTIONS.map((opt) => {
                    const selected = customConfig.temperament.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setCustomConfig((prev) => {
                          const next = selected ? prev.temperament.filter((t) => t !== opt.id) : prev.temperament.length < 3 ? [...prev.temperament, opt.id] : prev.temperament
                          return { ...prev, temperament: next }
                        })}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-[13px] transition-all flex items-center gap-1.5",
                          selected ? "bg-white/10 border-white/20" : "bg-card border-border hover:border-muted-foreground/30"
                        )}
                      >
                        <span>{opt.emoji}</span> {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Social Traits — pick 2-3 */}
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Social Traits</p>
                  <p className="text-[11px] text-muted-foreground">How they interact with people — pick 2-3</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_OPTIONS.map((opt) => {
                    const selected = customConfig.social.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setCustomConfig((prev) => {
                          const next = selected ? prev.social.filter((s) => s !== opt.id) : prev.social.length < 3 ? [...prev.social, opt.id] : prev.social
                          return { ...prev, social: next }
                        })}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-[13px] transition-all flex items-center gap-1.5",
                          selected ? "bg-white/10 border-white/20" : "bg-card border-border hover:border-muted-foreground/30"
                        )}
                      >
                        <span>{opt.emoji}</span> {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Humor — pick 0-2 */}
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Humor Style</p>
                  <p className="text-[11px] text-muted-foreground">How (or if) they use humor — pick 0-2</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {HUMOR_OPTIONS.map((opt) => {
                    const selected = customConfig.humor.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setCustomConfig((prev) => {
                          let next: string[]
                          if (opt.id === "none") {
                            next = selected ? [] : ["none"]
                          } else if (selected) {
                            next = prev.humor.filter((h) => h !== opt.id)
                          } else {
                            next = prev.humor.filter((h) => h !== "none")
                            next = next.length < 2 ? [...next, opt.id] : next
                          }
                          return { ...prev, humor: next }
                        })}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-[13px] transition-all flex items-center gap-1.5",
                          selected ? "bg-white/10 border-white/20" : "bg-card border-border hover:border-muted-foreground/30"
                        )}
                      >
                        <span>{opt.emoji}</span> {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Energy — pick one */}
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Energy & Vibe</p>
                  <p className="text-[11px] text-muted-foreground">Their overall energy — pick one</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ENERGY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setCustomConfig((prev) => ({ ...prev, energy: opt.id }))}
                      className={cn(
                        "rounded-md border px-3 py-2 text-[13px] text-left transition-all flex items-center gap-2",
                        customConfig.energy === opt.id
                          ? "bg-white/10 border-white/20"
                          : "bg-card border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <span>{opt.emoji}</span> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quirks — pick 0-3 */}
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Communication Quirks</p>
                  <p className="text-[11px] text-muted-foreground">Distinctive habits in how they communicate — pick 0-3</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUIRK_OPTIONS.map((opt) => {
                    const selected = customConfig.quirks.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setCustomConfig((prev) => {
                          const next = selected ? prev.quirks.filter((q) => q !== opt.id) : prev.quirks.length < 3 ? [...prev.quirks, opt.id] : prev.quirks
                          return { ...prev, quirks: next }
                        })}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-[13px] transition-all flex items-center gap-1.5",
                          selected ? "bg-white/10 border-white/20" : "bg-card border-border hover:border-muted-foreground/30"
                        )}
                      >
                        <span>{opt.emoji}</span> {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Catchphrases */}
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Signature Expressions</p>
                  <p className="text-[11px] text-muted-foreground">Custom catchphrases they'll use naturally — optional</p>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      placeholder="e.g., Let's get after it, Here's the play..."
                      value={newCatchphrase}
                      onChange={(e) => setNewCatchphrase(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCatchphrase.trim()) {
                          setCustomConfig((prev) => ({ ...prev, catchphrases: [...prev.catchphrases, newCatchphrase.trim()] }))
                          setNewCatchphrase("")
                        }
                      }}
                      className="flex-1 h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors"
                    />
                    <button className="h-8 px-2.5 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-border" onClick={() => {
                      if (newCatchphrase.trim()) {
                        setCustomConfig((prev) => ({ ...prev, catchphrases: [...prev.catchphrases, newCatchphrase.trim()] }))
                        setNewCatchphrase("")
                      }
                    }}>Add</button>
                  </div>
                  {customConfig.catchphrases.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {customConfig.catchphrases.map((phrase, i) => (
                        <span key={i} className="text-xs text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 flex items-center gap-1">
                          &ldquo;{phrase}&rdquo;
                          <button className="ml-1 h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center text-xs" onClick={() => setCustomConfig((prev) => ({ ...prev, catchphrases: prev.catchphrases.filter((_, j) => j !== i) }))}>x</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Back</button>
            <button onClick={() => setStep(3)} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">Next</button>
          </div>
        </div>
      )}

      {/* Step 3: Skills */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-md p-4">
            <p className="section-label mb-3">Select Skills</p>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {skillOptions.map((skill) => {
                  const isSelected = selectedSkills.has(skill.id)
                  return (
                    <button
                      key={skill.id}
                      onClick={() => toggleSkill(skill.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md border p-2.5 text-left transition-all",
                        isSelected ? "border-primary" : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <skill.icon className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <div>
                        <p className="text-[13px] font-medium">{skill.name}</p>
                        <p className="text-[11px] text-muted-foreground">{skill.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Back</button>
            <button onClick={() => setStep(4)} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">Next</button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-md divide-y divide-border">
            <div className="p-4">
              <p className="section-label mb-3">Review</p>
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  { label: "Name", value: agentName || "\u2014" },
                  { label: "Role", value: agentRole || "\u2014" },
                  { label: "Team", value: agentTeam || "\u2014" },
                  { label: "Provider", value: agentProvider || "\u2014" },
                  { label: "Autonomy", value: agentAutonomy === "full_auto" ? "Full Auto" : agentAutonomy === "supervised" ? "Supervised" : "Manual" },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium capitalize">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Personality</p>
              {selectedPreset ? (
                <p className="text-[13px]"><span className="font-medium">{selectedPreset.name}</span> <span className="text-muted-foreground">&mdash; {selectedPreset.description}</span></p>
              ) : personalityMode === "sliders" ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {(Object.entries(customTraits) as [keyof PersonalityTraits, number][]).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20">{TRAIT_LABELS[key].name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${val}%` }} />
                      </div>
                      <span className="text-xs font-mono w-7 text-right">{val}</span>
                    </div>
                  ))}
                </div>
              ) : personalityMode === "custom" ? (
                <div className="flex flex-wrap gap-1">
                  {[customConfig.communication.formality, customConfig.communication.verbosity, customConfig.communication.directness, customConfig.communication.vocabulary, ...customConfig.temperament, ...customConfig.social, ...customConfig.humor, customConfig.energy, ...customConfig.quirks].map((t) => (
                    <span key={t} className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 capitalize">{t.replace("-", " ")}</span>
                  ))}
                  {customConfig.catchphrases.length > 0 && customConfig.catchphrases.map((phrase, i) => (
                    <span key={`cp-${i}`} className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">&ldquo;{phrase}&rdquo;</span>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">Default</p>}
            </div>
            <div className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Skills</p>
              <div className="flex flex-wrap gap-1">
                {selectedSkills.size === 0 ? <p className="text-xs text-muted-foreground">None</p> : Array.from(selectedSkills).map((id) => {
                  const skill = skillOptions.find((s) => s.id === id)
                  return <span key={id} className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">{skill?.name}</span>
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Back</button>
            <button disabled={creating} className="h-7 px-3 rounded-md btn-primary text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50" onClick={async () => {
              setCreating(true)
              try {
                const team = dbTeams.find((t) => t.name === agentTeam)
                await fetch("/api/agents/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: agentName,
                    role: agentRole,
                    teamId: team?.id || null,
                    provider: agentProvider || "anthropic",
                    model: agentProvider === "openai" ? "GPT-4o" : agentProvider === "google" ? "Gemini" : "Claude Haiku",
                    description: agentDescription,
                    skills: Array.from(selectedSkills).map((id) => skillOptions.find((s) => s.id === id)?.name || id),
                    personalityPresetId: selectedPreset?.id || null,
                    personality: selectedPreset ? selectedPreset.traits : customTraits,
                    personalityConfig: personalityMode === "custom" ? customConfig : null,
                    autonomyLevel: agentAutonomy,
                    archetype: prefillArchetype || undefined,
                  }),
                })
                router.push("/teams")
              } catch (e) { console.error(e) }
              setCreating(false)
            }}>
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlusCircle className="h-3 w-3" />}
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
