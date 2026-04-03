"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowRight, Building2, Rocket, Users, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const [businessName, setBusinessName] = useState("")
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
    setProgress("Setting up your teams...")

    setTimeout(() => setProgress("Hiring your AI agents..."), 1500)
    setTimeout(() => setProgress("Briefing your Chief of Staff..."), 3000)
    setTimeout(() => setProgress("Team leads are introducing themselves..."), 4500)

    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplate, businessName: businessName || undefined }),
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

  // Step 0: Welcome
  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-lg w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Rocket className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome to Business OS</h1>
            <p className="text-muted-foreground text-lg">
              You're about to build your AI-powered team. In 60 seconds, you'll have
              a full workforce ready to execute.
            </p>
          </div>

          <div className="grid gap-4 text-left">
            {[
              { icon: Users, label: "AI agents organized into real departments" },
              { icon: Building2, label: "A Chief of Staff coordinating everything" },
              { icon: Sparkles, label: "Distinct personalities that feel alive" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                <Icon className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm">{label}</p>
              </div>
            ))}
          </div>

          <Button size="lg" className="w-full text-base h-12" onClick={() => setStep(1)}>
            Let's Build Your Team
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    )
  }

  // Step 1: Business name + template
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">What are you building?</h1>
            <p className="text-muted-foreground">
              Pick a template and we'll set up the right teams and agents for you.
              You can customize everything later.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Business Name (optional)</Label>
            <Input
              placeholder="e.g., Fontaine Enterprises, My Side Hustle"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="h-11"
            />
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
            <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
            <Button
              size="lg"
              disabled={!selectedTemplate}
              onClick={() => setStep(2)}
            >
              Preview Team
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Confirm + create
  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate)

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

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Ready to launch?</h1>
          <p className="text-muted-foreground">Here's what we're setting up for you.</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
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
            <div className="grid grid-cols-3 gap-4 pt-2">
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
              <ul className="text-sm space-y-1.5">
                <li>Your teams and agents are created instantly</li>
                <li>Nova (Chief of Staff) briefs your team leads</li>
                <li>Each lead introduces themselves in #team-leaders</li>
                <li>You land on the dashboard, ready to go</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
          <Button size="lg" onClick={handleCreate}>
            <Rocket className="h-4 w-4 mr-2" />
            Launch My Team
          </Button>
        </div>
      </div>
    </div>
  )
}
