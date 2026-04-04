"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {} from "@/components/ui/badge"
import {
  Loader2, ArrowRight, Building2, Rocket, Users, Sparkles,
  Lightbulb, Briefcase, Wrench, MessageSquare, Target,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Lane = "new" | "existing" | null

interface TemplateOption {
  id: string
  name: string
  description: string
  icon: string
  teamCount: number
  agentCount: number
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [lane, setLane] = useState<Lane>(null)
  const [businessName, setBusinessName] = useState("")
  const [businessIdea, setBusinessIdea] = useState("")
  // Lane 2 — existing business intake
  const [existingTools, setExistingTools] = useState("")
  const [existingPainPoints, setExistingPainPoints] = useState("")
  const [teamSize, setTeamSize] = useState("")

  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [progress, setProgress] = useState("")

  useEffect(() => {
    fetch("/api/onboarding").then((r) => r.json()).then((d) => setTemplates(d.templates))
  }, [])

  async function handleCreate() {
    if (!selectedTemplate) return
    setCreating(true)

    if (lane === "new") {
      setProgress("Activating your R&D team...")
      setTimeout(() => setProgress("Hiring your AI agents..."), 1500)
      setTimeout(() => setProgress("Briefing your Chief of Staff..."), 3000)
      setTimeout(() => setProgress("Your team is assembling..."), 4500)
    } else {
      setProgress("Mapping your existing operations...")
      setTimeout(() => setProgress("Setting up all departments..."), 1500)
      setTimeout(() => setProgress("Briefing your Chief of Staff..."), 3000)
      setTimeout(() => setProgress("Team leads are ready for intake..."), 4500)
    }

    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          businessName: businessName || undefined,
          lane,
          businessIdea: lane === "new" ? businessIdea : undefined,
          existingTools: lane === "existing" ? existingTools : undefined,
          existingPainPoints: lane === "existing" ? existingPainPoints : undefined,
          teamSize: lane === "existing" ? teamSize : undefined,
        }),
      })

      setTimeout(() => {
        setProgress("You're all set! Redirecting...")
        setTimeout(() => router.push("/"), 1000)
      }, 5500)
    } catch {
      setProgress("Something went wrong. Please try again.")
      setCreating(false)
    }
  }

  // ── Step 0: Welcome ──
  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center mx-auto">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Welcome to Business OS</h1>
            <p className="text-sm text-muted-foreground">
              Set up your AI-powered team in 60 seconds.
            </p>
          </div>

          <div className="space-y-2 text-left">
            {[
              { icon: Users, label: "Agents organized into departments" },
              { icon: Building2, label: "Chief of Staff coordinates everything" },
              { icon: Sparkles, label: "Distinct personalities in every conversation" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-card border border-border">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-[13px]">{label}</p>
              </div>
            ))}
          </div>

          <button onClick={() => setStep(1)} className="w-full h-9 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
            Get Started <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // ── Step 1: Lane Selection ──
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">Where are you starting from?</h1>
            <p className="text-sm text-muted-foreground">This shapes how your team onboards.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => { setLane("new"); setStep(2) }}
              className={cn(
                "flex flex-col gap-3 rounded-md border p-4 text-left transition-all hover:border-muted-foreground/30",
                lane === "new" ? "border-primary" : "border-border"
              )}
            >
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <div>
                <h3 className="text-[13px] font-semibold">Building something new</h3>
                <p className="text-xs text-muted-foreground mt-1">Start from an idea. Guided step-by-step.</p>
              </div>
            </button>

            <button
              onClick={() => { setLane("existing"); setStep(2) }}
              className={cn(
                "flex flex-col gap-3 rounded-md border p-4 text-left transition-all hover:border-muted-foreground/30",
                lane === "existing" ? "border-primary" : "border-border"
              )}
            >
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <div>
                <h3 className="text-[13px] font-semibold">Existing business</h3>
                <p className="text-xs text-muted-foreground mt-1">Migrate operations. All departments active.</p>
              </div>
            </button>
          </div>

          <button onClick={() => setStep(0)} className="text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto block">Back</button>
        </div>
      </div>
    )
  }

  // ── Step 2: Business Details ──
  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">
              {lane === "new" ? "Tell us about your idea" : "About your business"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {lane === "new" ? "Even a rough concept works." : "We'll map your operations."}
            </p>
          </div>

          <div className="bg-card border border-border rounded-md p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Business Name</label>
              <input placeholder={lane === "new" ? "e.g., Project Nova" : "e.g., Fontaine Enterprises"} value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
            </div>

            {lane === "new" ? (
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">What's the idea? <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea placeholder="Describe briefly..." value={businessIdea} onChange={(e) => setBusinessIdea(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium">Team size</label>
                  <input placeholder="e.g., Just me, 5 people" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium">Current tools</label>
                  <textarea placeholder="QuickBooks, HubSpot, Shopify..." value={existingTools} onChange={(e) => setExistingTools(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium">Biggest pain points</label>
                  <textarea placeholder="What's not working..." value={existingPainPoints} onChange={(e) => setExistingPainPoints(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Back</button>
            <button onClick={() => setStep(3)} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1">Next <ArrowRight className="h-3 w-3" /></button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: Template Selection ──
  if (step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">Choose a template</h1>
            <p className="text-xs text-muted-foreground">Pick the closest match. You can customize later.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-md border p-3 text-left transition-all hover:border-muted-foreground/30",
                  selectedTemplate === t.id ? "border-primary" : "border-border"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{t.icon}</span>
                  <span className="text-[13px] font-semibold">{t.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">{t.teamCount} teams · {t.agentCount} agents</p>
              </button>
            ))}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Back</button>
            <button disabled={!selectedTemplate} onClick={() => setStep(4)} className={cn("h-8 px-3 rounded-md text-xs font-medium flex items-center gap-1 transition-colors", selectedTemplate ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed")}>Review <ArrowRight className="h-3 w-3" /></button>
          </div>
        </div>
      </div>
    )
  }

  // ── Creating... ──
  if (creating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-xs w-full text-center space-y-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          <div>
            <p className="text-[13px] font-medium">Setting up</p>
            <p className="text-xs text-muted-foreground mt-0.5">{progress}</p>
          </div>
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-1000 ease-out" style={{ width: "75%" }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Step 4: Review & Launch ──
  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate)

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Ready to launch</h1>
        </div>

        <div className="bg-card border border-border rounded-md divide-y divide-border">
          {/* Summary */}
          <div className="p-4 space-y-2">
            {businessName && (
              <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Business</span>
                <span className="font-medium">{businessName}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">Template</span>
              <span className="font-medium">{selectedTemplateData?.icon} {selectedTemplateData?.name}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">Mode</span>
              <span className="font-medium">{lane === "new" ? "New Build" : "Migration"}</span>
            </div>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-3 gap-px bg-border">
            {[
              { label: "Teams", value: selectedTemplateData?.teamCount ?? 0 },
              { label: "Agents", value: (selectedTemplateData?.agentCount ?? 0) + 1 },
              { label: "Chief of Staff", value: 1 },
            ].map((s) => (
              <div key={s.label} className="bg-card text-center py-3">
                <p className="text-lg font-semibold tabular-nums">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* What happens */}
          <div className="p-4">
            <p className="section-label mb-2">What happens next</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {lane === "new" ? (
                <>
                  <p>R&D activates first to validate your idea</p>
                  <p>Other departments activate as you progress</p>
                  <p>Nova coordinates everything in #team-leaders</p>
                </>
              ) : (
                <>
                  <p>All departments activate immediately</p>
                  <p>Each lead runs an intake on your operations</p>
                  <p>They replicate what works and improve the rest</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button onClick={() => setStep(3)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Back</button>
          <button onClick={handleCreate} className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <Rocket className="h-3 w-3" /> Launch
          </button>
        </div>
      </div>
    </div>
  )
}
