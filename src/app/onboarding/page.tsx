"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {lane === "new" ? "Tell us about your idea" : "Tell us about your business"}
            </h1>
            <p className="text-muted-foreground">
              {lane === "new"
                ? "Even a rough concept is fine — your R&D team will help sharpen it."
                : "We'll map your existing operations so agents can hit the ground running."}
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input
                  placeholder={lane === "new" ? "e.g., My Side Hustle, Project Nova" : "e.g., Fontaine Enterprises"}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="h-11"
                />
              </div>

              {lane === "new" ? (
                <div className="space-y-2">
                  <Label>What's the idea? <span className="text-muted-foreground font-normal">(optional — your R&D team will help develop it)</span></Label>
                  <Textarea
                    placeholder="Describe your idea in a few sentences. It can be rough — that's what your team is for. e.g., 'An AI-powered service that helps real estate investors find Section 8 properties...'"
                    value={businessIdea}
                    onChange={(e) => setBusinessIdea(e.target.value)}
                    rows={4}
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Current team size</Label>
                    <Input
                      placeholder="e.g., Just me, 3 people, 15 employees"
                      value={teamSize}
                      onChange={(e) => setTeamSize(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tools you're currently using</Label>
                    <Textarea
                      placeholder="e.g., QuickBooks for accounting, HubSpot CRM, Mailchimp for email, Shopify store, Slack for team chat..."
                      value={existingTools}
                      onChange={(e) => setExistingTools(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Biggest pain points</Label>
                    <Textarea
                      placeholder="e.g., Can't keep up with content creation, spending too much on payroll, inconsistent customer support response times..."
                      value={existingPainPoints}
                      onChange={(e) => setExistingPainPoints(e.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>
              Next: Choose Template
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: Template Selection ──
  if (step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {lane === "new" ? "What type of business?" : "Match your business type"}
            </h1>
            <p className="text-muted-foreground">
              Pick the closest match — we'll set up the right teams and agents. You can customize everything later.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all",
                  selectedTemplate === t.id
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{t.icon}</span>
                  <h3 className="font-semibold">{t.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{t.description}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">{t.teamCount} teams</Badge>
                  <Badge variant="secondary" className="text-xs">{t.agentCount} agents</Badge>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button size="lg" disabled={!selectedTemplate} onClick={() => setStep(4)}>
              Review Setup
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Creating... ──
  if (creating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Setting up your business</h1>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p>{progress}</p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-1000 ease-out animate-pulse" style={{ width: "75%" }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Step 4: Review & Launch ──
  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate)

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Ready to launch?</h1>
          <p className="text-muted-foreground">Here's what we're setting up for you.</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {businessName && (
                <div>
                  <p className="text-xs text-muted-foreground">Business</p>
                  <p className="font-semibold">{businessName}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Template</p>
                <p className="font-semibold">{selectedTemplateData?.icon} {selectedTemplateData?.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mode</p>
                <Badge variant={lane === "new" ? "default" : "secondary"}>
                  {lane === "new" ? "New Build" : "Existing Business"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-bold">{selectedTemplateData?.teamCount}</p>
                <p className="text-xs text-muted-foreground">Teams</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{(selectedTemplateData?.agentCount ?? 0) + 1}</p>
                <p className="text-xs text-muted-foreground">Agents</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">1</p>
                <p className="text-xs text-muted-foreground">Chief of Staff</p>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">What happens next</p>
              {lane === "new" ? (
                <ul className="text-sm space-y-1.5">
                  <li className="flex items-start gap-2"><Target className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" /> R&D activates first — your Product Strategist will help validate your idea</li>
                  <li className="flex items-start gap-2"><Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> Other departments are visible but await activation as you progress</li>
                  <li className="flex items-start gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> Nova (Chief of Staff) coordinates the team in #team-leaders</li>
                  <li className="flex items-start gap-2"><Sparkles className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> Agents guide you step-by-step — no experience needed</li>
                </ul>
              ) : (
                <ul className="text-sm space-y-1.5">
                  <li className="flex items-start gap-2"><Building2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> All departments activate immediately — ready for your context</li>
                  <li className="flex items-start gap-2"><Wrench className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> Agents start by mapping your existing processes and tools</li>
                  <li className="flex items-start gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> Each lead runs an intake to understand your current operations</li>
                  <li className="flex items-start gap-2"><Sparkles className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> They replicate what works and suggest improvements</li>
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
          <Button size="lg" onClick={handleCreate}>
            <Rocket className="h-4 w-4 mr-2" />
            Launch My Team
          </Button>
        </div>
      </div>
    </div>
  )
}
