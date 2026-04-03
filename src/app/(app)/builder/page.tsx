"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  PlusCircle,
  Bot,
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
  Sparkles,
  SlidersHorizontal,
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

const templates = [
  { id: "content-writer", name: "Content Writer", role: "Content Writer", team: "Marketing", description: "Writes blog posts, articles, and marketing copy" },
  { id: "lead-gen", name: "Lead Generator", role: "Lead Researcher", team: "Sales", description: "Finds and qualifies prospects matching your ICP" },
  { id: "support-agent", name: "Support Agent", role: "Customer Support", team: "Fulfillment", description: "Handles customer inquiries and support tickets" },
  { id: "bookkeeper", name: "Bookkeeper", role: "Bookkeeper", team: "Finance", description: "Categorizes transactions and maintains financial records" },
  { id: "social-mgr", name: "Social Media Manager", role: "Social Media Manager", team: "Marketing", description: "Creates and schedules social media content" },
  { id: "custom", name: "Custom Agent", role: "", team: "", description: "Build from scratch with full customization" },
]

export default function BuilderPageWrapper() {
  return <Suspense><BuilderPageInner /></Suspense>
}

function BuilderPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillTeam = searchParams.get("team")
  const prefillTeamId = searchParams.get("teamId")
  const [step, setStep] = useState(prefillTeam ? 1 : 0) // skip template if coming from team page
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [agentName, setAgentName] = useState("")
  const [agentRole, setAgentRole] = useState("")
  const [agentTeam, setAgentTeam] = useState(prefillTeam || "")
  const [agentProvider, setAgentProvider] = useState("")
  const [agentDescription, setAgentDescription] = useState("")
  const [agentAutonomy, setAgentAutonomy] = useState("supervised")
  const [creating, setCreating] = useState(false)
  const [dbTeams, setDbTeams] = useState<{ id: string; name: string; icon: string }[]>([])

  // Personality state
  const [personalityMode, setPersonalityMode] = useState<"preset" | "custom">("preset")
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
    fetch("/api/teams").then((r) => r.json()).then((teams) => setDbTeams(teams))
  }, [])

  function toggleSkill(id: string) {
    setSelectedSkills((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectTemplate(id: string) {
    const template = templates.find((t) => t.id === id)
    if (template) {
      setSelectedTemplate(id)
      if (template.role) setAgentRole(template.role)
      if (template.team) setAgentTeam(template.team)
      setStep(1)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent Builder</h1>
        <p className="text-sm text-muted-foreground">
          Create a new AI team member for your business
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 flex-wrap">
        {["Template", "Details", "Personality", "Skills", "Review"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => i <= step && setStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors",
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <span className="font-mono text-xs">{i + 1}</span>
              {label}
            </button>
            {i < 4 && (
              <div className={cn("h-px w-8", i < step ? "bg-primary" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Template Selection */}
      {step === 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={cn(
                "cursor-pointer transition-colors hover:border-primary/50",
                selectedTemplate === template.id && "border-primary"
              )}
              onClick={() => selectTemplate(template.id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  {template.id === "custom" ? (
                    <Wrench className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Bot className="h-5 w-5 text-primary" />
                  )}
                  <h3 className="font-medium text-sm">{template.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {template.description}
                </p>
                {template.team && (
                  <Badge variant="secondary" className="mt-3 text-xs">
                    {template.team}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 1: Agent Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="e.g., Maya, Jordan, Casey"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  placeholder="e.g., Content Writer, Lead Researcher"
                  value={agentRole}
                  onChange={(e) => setAgentRole(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={agentTeam} onValueChange={(v) => setAgentTeam(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {dbTeams.map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.icon} {t.name}</SelectItem>
                    ))}
                    {dbTeams.length === 0 && <SelectItem value="" disabled>Loading teams...</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>AI Provider</Label>
                <Select value={agentProvider} onValueChange={(v) => setAgentProvider(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                    <SelectItem value="google">Google (Gemini)</SelectItem>
                    <SelectItem value="custom">Custom / Self-hosted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Autonomy Level</Label>
              <Select value={agentAutonomy} onValueChange={(v) => setAgentAutonomy(v ?? "supervised")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_auto">Full Auto — works independently 24/7</SelectItem>
                  <SelectItem value="supervised">Supervised — asks before key actions</SelectItem>
                  <SelectItem value="manual">Manual — only works when you ask</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {agentAutonomy === "full_auto" && "This agent will work continuously without asking for permission."}
                {agentAutonomy === "supervised" && "This agent will flag important decisions for your approval."}
                {agentAutonomy === "manual" && "This agent only acts when you directly assign work."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what this agent should do in plain language... e.g., 'Research our competitors' pricing pages daily and alert me if anything changes.'"
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>
                Next: Personality
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Personality */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={personalityMode === "preset" ? "default" : "outline"}
              size="sm"
              onClick={() => setPersonalityMode("preset")}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Choose Character
            </Button>
            <Button
              variant={personalityMode === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => { setPersonalityMode("custom"); setSelectedPreset(null) }}
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Build Custom
            </Button>
          </div>

          {personalityMode === "preset" ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Character Library
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Choose a famous personality — your agent will communicate in their style
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Search + Filter */}
                <div className="flex gap-2">
                  <Input
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
                        "flex flex-col gap-1 rounded-lg border p-3 text-left transition-all hover:border-primary/50",
                        selectedPreset?.id === preset.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{preset.name}</span>
                        <Badge variant="secondary" className="text-xs h-5 px-1.5">
                          {CATEGORY_INFO[preset.category].icon}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {preset.description}
                      </p>
                    </button>
                  ))}
                  {filteredPresets.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-3 text-center py-8">
                      No characters found
                    </p>
                  )}
                </div>

                {/* Selected Preview */}
                {selectedPreset && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-sm">{selectedPreset.name}</h4>
                        <p className="text-xs text-muted-foreground">{selectedPreset.description}</p>
                      </div>
                      <Badge>{CATEGORY_INFO[selectedPreset.category].label}</Badge>
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
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Communication Style — pick one per axis */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Communication Style</CardTitle>
                  <p className="text-xs text-muted-foreground">How your agent speaks — pick one per row</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(Object.entries(COMMUNICATION_AXES) as [keyof typeof COMMUNICATION_AXES, typeof COMMUNICATION_AXES[keyof typeof COMMUNICATION_AXES]][]).map(([key, axis]) => (
                    <div key={key}>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">{axis.label}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {axis.options.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setCustomConfig((prev) => ({ ...prev, communication: { ...prev.communication, [key]: opt.id } }))}
                            className={cn(
                              "rounded-lg border p-2.5 text-sm text-left transition-all",
                              customConfig.communication[key] === opt.id
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "border-border hover:border-primary/40"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Temperament — pick 2-3 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Temperament</CardTitle>
                  <p className="text-xs text-muted-foreground">Their core emotional nature — pick 2-3</p>
                </CardHeader>
                <CardContent>
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
                            "rounded-full border px-3 py-1.5 text-sm transition-all flex items-center gap-1.5",
                            selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                          )}
                        >
                          <span>{opt.emoji}</span> {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Social Traits — pick 2-3 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Social Traits</CardTitle>
                  <p className="text-xs text-muted-foreground">How they interact with people — pick 2-3</p>
                </CardHeader>
                <CardContent>
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
                            "rounded-full border px-3 py-1.5 text-sm transition-all flex items-center gap-1.5",
                            selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                          )}
                        >
                          <span>{opt.emoji}</span> {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Humor — pick 0-2 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Humor Style</CardTitle>
                  <p className="text-xs text-muted-foreground">How (or if) they use humor — pick 0-2</p>
                </CardHeader>
                <CardContent>
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
                            "rounded-full border px-3 py-1.5 text-sm transition-all flex items-center gap-1.5",
                            selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                          )}
                        >
                          <span>{opt.emoji}</span> {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Energy — pick one */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Energy & Vibe</CardTitle>
                  <p className="text-xs text-muted-foreground">Their overall energy — pick one</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {ENERGY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setCustomConfig((prev) => ({ ...prev, energy: opt.id }))}
                        className={cn(
                          "rounded-lg border p-2.5 text-sm text-left transition-all flex items-center gap-2",
                          customConfig.energy === opt.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <span className="text-lg">{opt.emoji}</span> {opt.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quirks — pick 0-3 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Communication Quirks</CardTitle>
                  <p className="text-xs text-muted-foreground">Distinctive habits in how they communicate — pick 0-3</p>
                </CardHeader>
                <CardContent>
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
                            "rounded-full border px-3 py-1.5 text-sm transition-all flex items-center gap-1.5",
                            selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                          )}
                        >
                          <span>{opt.emoji}</span> {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Catchphrases */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Signature Expressions</CardTitle>
                  <p className="text-xs text-muted-foreground">Custom catchphrases they'll use naturally — optional</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Let's get after it, Here's the play..."
                      value={newCatchphrase}
                      onChange={(e) => setNewCatchphrase(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCatchphrase.trim()) {
                          setCustomConfig((prev) => ({ ...prev, catchphrases: [...prev.catchphrases, newCatchphrase.trim()] }))
                          setNewCatchphrase("")
                        }
                      }}
                    />
                    <Button variant="outline" size="sm" onClick={() => {
                      if (newCatchphrase.trim()) {
                        setCustomConfig((prev) => ({ ...prev, catchphrases: [...prev.catchphrases, newCatchphrase.trim()] }))
                        setNewCatchphrase("")
                      }
                    }}>Add</Button>
                  </div>
                  {customConfig.catchphrases.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {customConfig.catchphrases.map((phrase, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                          &ldquo;{phrase}&rdquo;
                          <button className="ml-1 h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center text-xs" onClick={() => setCustomConfig((prev) => ({ ...prev, catchphrases: prev.catchphrases.filter((_, j) => j !== i) }))}>x</button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>Next: Skills</Button>
          </div>
        </div>
      )}

      {/* Step 3: Skills */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Select Skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {skillOptions.map((skill) => {
                  const isSelected = selectedSkills.has(skill.id)
                  return (
                    <button
                      key={skill.id}
                      onClick={() => toggleSkill(skill.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <skill.icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <div>
                        <p className="text-sm font-medium">{skill.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {skill.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={() => setStep(4)}>
              Next: Review
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review Your Agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{agentName || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-medium">{agentRole || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team</p>
                  <p className="font-medium">{agentTeam || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="font-medium capitalize">{agentProvider || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Autonomy</p>
                  <p className="font-medium">{agentAutonomy === "full_auto" ? "Full Auto" : agentAutonomy === "supervised" ? "Supervised" : "Manual"}</p>
                </div>
              </div>
              {agentDescription && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm mt-1">{agentDescription}</p>
                </div>
              )}
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Personality</p>
                {selectedPreset ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{selectedPreset.name}</Badge>
                    <span className="text-xs text-muted-foreground">{selectedPreset.description}</span>
                  </div>
                ) : personalityMode === "custom" ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-xs">{customConfig.communication.formality === "formal" ? "Formal" : "Casual"}</Badge>
                      <Badge variant="secondary" className="text-xs">{customConfig.communication.verbosity === "detailed" ? "Detailed" : "Brief"}</Badge>
                      <Badge variant="secondary" className="text-xs">{customConfig.communication.directness === "blunt" ? "Blunt" : "Diplomatic"}</Badge>
                      <Badge variant="secondary" className="text-xs">{customConfig.communication.vocabulary === "elevated" ? "Elevated" : "Plain"}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {customConfig.temperament.map((t) => <Badge key={t} variant="outline" className="text-xs capitalize">{t}</Badge>)}
                      {customConfig.social.map((s) => <Badge key={s} variant="outline" className="text-xs capitalize">{s.replace("-", " ")}</Badge>)}
                      {customConfig.humor.map((h) => <Badge key={h} variant="outline" className="text-xs capitalize">{h}</Badge>)}
                      <Badge variant="outline" className="text-xs capitalize">{customConfig.energy.replace("-", " ")}</Badge>
                      {customConfig.quirks.map((q) => <Badge key={q} variant="outline" className="text-xs capitalize">{q.replace("-", " ")}</Badge>)}
                    </div>
                    {customConfig.catchphrases.length > 0 && (
                      <p className="text-xs text-muted-foreground italic">Catchphrases: {customConfig.catchphrases.map((c) => `"${c}"`).join(", ")}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Default personality</p>
                )}
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {selectedSkills.size === 0 ? (
                    <p className="text-sm text-muted-foreground">No skills selected</p>
                  ) : (
                    Array.from(selectedSkills).map((skillId) => {
                      const skill = skillOptions.find((s) => s.id === skillId)
                      return (
                        <Badge key={skillId} variant="secondary">
                          {skill?.name}
                        </Badge>
                      )
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button disabled={creating} onClick={async () => {
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
                  }),
                })
                router.push("/teams")
              } catch (e) { console.error(e) }
              setCreating(false)
            }}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlusCircle className="h-4 w-4 mr-2" />}
              {creating ? "Creating..." : "Create Agent"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
