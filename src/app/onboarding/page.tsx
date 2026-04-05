"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, ArrowRight, Loader2, X, Plus, Rocket } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Chat-style onboarding per PVD ──────────────────────────
// Lemonade-inspired flow: one question at a time, conversational, with inline buttons.
// Order (PVD Section 3): name → business → type → competitors → goals → timeline → anthropic → launch

type Step =
  | "welcome"
  | "user_name"
  | "business_name"
  | "business_description"
  | "business_type"
  | "competitors"
  | "business_goal"
  | "target_scale"
  | "timeline"
  | "anthropic"
  | "launching"
  | "done"

interface ChatEntry {
  role: "assistant" | "user"
  content: string
}

interface BusinessType {
  id: string
  label: string
  icon: string
  description: string
}

const BUSINESS_TYPES: BusinessType[] = [
  { id: "ecommerce", label: "E-commerce", icon: "🛒", description: "Online store selling products" },
  { id: "service", label: "Service-Based", icon: "🛠️", description: "Done-for-you services, freelancing, local" },
  { id: "agency", label: "Agency", icon: "🏢", description: "Marketing, creative, or professional services" },
  { id: "saas", label: "SaaS / Tech", icon: "💻", description: "Software as a service" },
  { id: "consulting", label: "Consulting / Coaching", icon: "🎓", description: "Advisory, coaching, or knowledge work" },
  { id: "content", label: "Creator / Info Product", icon: "🎬", description: "Courses, content, personal brand" },
  { id: "brick_and_mortar", label: "Brick & Mortar", icon: "🏪", description: "Physical location business" },
]

const TOTAL_STEPS = 9

const STEP_ORDER: Step[] = [
  "user_name",
  "business_name",
  "business_type",
  "business_description",
  "competitors",
  "business_goal",
  "target_scale",
  "timeline",
  "anthropic",
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("welcome")
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [textInput, setTextInput] = useState("")
  const [progress, setProgress] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Collected data
  const [userName, setUserName] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [businessDescription, setBusinessDescription] = useState("")
  const [businessType, setBusinessType] = useState<string>("")
  const [competitors, setCompetitors] = useState<Array<{ label: string; url: string }>>([])
  const [newCompetitor, setNewCompetitor] = useState("")
  const [businessGoal, setBusinessGoal] = useState("")
  const [targetScale, setTargetScale] = useState("")
  const [timeline, setTimeline] = useState("")

  const stepIdx = STEP_ORDER.indexOf(step)
  const progressPct = stepIdx >= 0 ? Math.round(((stepIdx + 1) / TOTAL_STEPS) * 100) : 0

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [entries, step])

  useEffect(() => {
    if (["user_name", "business_name", "business_description", "business_goal", "target_scale", "timeline", "anthropic"].includes(step)) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [step])

  useEffect(() => {
    if (entries.length === 0) {
      setTimeout(() => {
        setEntries([{ role: "assistant", content: "Hey 👋 I'm Nova, your Chief of Staff. I'm going to get your business set up with an AI team that actually runs things." }])
        setTimeout(() => {
          setEntries((prev) => [...prev, { role: "assistant", content: "Takes about 2 minutes. Ready when you are." }])
          setTimeout(() => setStep("user_name"), 800)
        }, 900)
      }, 300)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === "welcome" || step === "launching" || step === "done") return
    const q = getQuestion(step)
    setEntries((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && prev[prev.length - 1].content === q) return prev
      return [...prev, { role: "assistant", content: q }]
    })
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  function getQuestion(s: Step): string {
    switch (s) {
      case "user_name": return "First — what's your name? I want to make sure the team calls you the right thing."
      case "business_name": return `Nice to meet you, ${userName || "there"}. What's the name of your business? You can skip this and name it later if you're still figuring it out.`
      case "business_type": return "What type of business is this? Pick the one that fits best."
      case "business_description": return "Got it. In one or two sentences — what does your business do?"
      case "competitors": return "Anyone you're watching as competition? Drop their website or Instagram here so the team can study them. You can skip this."
      case "business_goal": return "What's the main goal for this business? What are you actually trying to achieve?"
      case "target_scale": return "Where do you want to scale this to? (Revenue target, customer count, market position — whatever matters to you.)"
      case "timeline": return "What's your timeline? When do you want to hit that?"
      case "anthropic": return "Last thing — I need your Anthropic API key so I can actually run your AI team on your account. You can grab one from console.anthropic.com/settings/keys. I'll keep it secure."
      default: return ""
    }
  }

  function submitText(value: string) {
    if (!value.trim()) return
    setEntries((prev) => [...prev, { role: "user", content: value }])
    setTextInput("")

    setTimeout(() => {
      switch (step) {
        case "user_name":
          setUserName(value.trim())
          setStep("business_name")
          break
        case "business_name":
          setBusinessName(value.trim())
          setStep("business_type")
          break
        case "business_description":
          setBusinessDescription(value.trim())
          setStep("competitors")
          break
        case "business_goal":
          setBusinessGoal(value.trim())
          setStep("target_scale")
          break
        case "target_scale":
          setTargetScale(value.trim())
          setStep("timeline")
          break
        case "timeline":
          setTimeline(value.trim())
          setStep("anthropic")
          break
        case "anthropic":
          launchBusiness(value.trim())
          break
      }
    }, 300)
  }

  function skipCurrent() {
    setEntries((prev) => [...prev, { role: "user", content: "Skip" }])
    setTimeout(() => {
      if (step === "business_name") setStep("business_type")
      else if (step === "competitors") setStep("business_goal")
      else if (step === "anthropic") launchBusiness("")
    }, 300)
  }

  function selectBusinessType(typeId: string) {
    const t = BUSINESS_TYPES.find((x) => x.id === typeId)
    if (!t) return
    setBusinessType(typeId)
    setEntries((prev) => [...prev, { role: "user", content: `${t.icon} ${t.label}` }])
    setTimeout(() => setStep("business_description"), 400)
  }

  function addCompetitor() {
    if (!newCompetitor.trim()) return
    const url = newCompetitor.trim()
    const label = url.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 30)
    setCompetitors((prev) => [...prev, { label, url }])
    setNewCompetitor("")
  }

  function removeCompetitor(i: number) {
    setCompetitors((prev) => prev.filter((_, idx) => idx !== i))
  }

  function doneWithCompetitors() {
    if (competitors.length > 0) {
      setEntries((prev) => [...prev, { role: "user", content: `Added ${competitors.length} competitor${competitors.length === 1 ? "" : "s"}: ${competitors.map((c) => c.label).join(", ")}` }])
    } else {
      setEntries((prev) => [...prev, { role: "user", content: "None right now" }])
    }
    setTimeout(() => setStep("business_goal"), 400)
  }

  async function launchBusiness(apiKey: string) {
    setStep("launching")
    setProgress("Setting up your workspace...")

    setTimeout(() => setProgress("Activating your team..."), 1200)
    setTimeout(() => setProgress("Hiring your R&D lead..."), 2400)
    setTimeout(() => setProgress("Briefing your Chief of Staff..."), 3600)
    setTimeout(() => setProgress("Opening your R&D channel..."), 4800)

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: businessType || "service",
          businessName: businessName || undefined,
          lane: "new",
          ownerName: userName,
          businessDescription,
          businessGoal,
          targetScale,
          timeline,
          competitors,
          anthropicApiKey: apiKey || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.workspaceId) {
          localStorage.setItem("vespr-active-workspace", data.workspaceId)
          document.cookie = `vespr-active-workspace=${data.workspaceId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
        }
        if (data.entryChannelId) {
          // Pre-seed active channel cookie so chat page lands on R&D
          document.cookie = `vespr-entry-channel=${data.entryChannelId}; path=/; max-age=60; SameSite=Lax`
        }
        setTimeout(() => {
          setProgress("You're live! Taking you in...")
          setTimeout(() => router.push("/"), 1200)
        }, 5500)
      } else {
        setProgress("Something went wrong. Please try again.")
      }
    } catch {
      setProgress("Something went wrong. Please try again.")
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: step === "launching" || step === "done" ? "100%" : `${progressPct}%` }}
          />
        </div>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold">VESPR OS</p>
            <p className="text-[10px] text-muted-foreground">
              {step === "launching" || step === "done" ? "Launching" : step === "welcome" ? "Welcome" : `Step ${stepIdx + 1} of ${TOTAL_STEPS}`}
            </p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {entries.map((entry, i) => (
            <div key={i} className={cn("flex", entry.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap",
                entry.role === "assistant"
                  ? "bg-card border border-border"
                  : "bg-primary text-primary-foreground"
              )}>
                {entry.content}
              </div>
            </div>
          ))}

          {step === "business_type" && (
            <div className="grid gap-2 md:grid-cols-2 pt-2">
              {BUSINESS_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectBusinessType(t.id)}
                  className="flex items-start gap-3 text-left rounded-xl border border-border bg-card p-3 hover:border-primary/50 hover:bg-accent/30 transition-all"
                >
                  <span className="text-xl shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === "competitors" && (
            <div className="space-y-2 pt-2">
              {competitors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {competitors.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px]">
                      {c.label}
                      <button onClick={() => removeCompetitor(i)} className="text-muted-foreground hover:text-red-400 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompetitor() } }}
                  placeholder="website.com or @instagram"
                  className="flex-1 h-10 rounded-lg border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/40 transition-colors"
                />
                <button
                  onClick={addCompetitor}
                  disabled={!newCompetitor.trim()}
                  className="h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={doneWithCompetitors}
                  className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                >
                  {competitors.length > 0 ? "Continue" : "Skip this"} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === "launching" && (
            <div className="flex justify-start pt-4">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-card border border-border">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <p className="text-[13px] text-muted-foreground">{progress}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar — text-based steps */}
      {["user_name", "business_name", "business_description", "business_goal", "target_scale", "timeline", "anthropic"].includes(step) && (
        <div className="border-t border-border bg-background/95 backdrop-blur p-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type={step === "anthropic" ? "password" : "text"}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitText(textInput) } }}
                placeholder={
                  step === "user_name" ? "Your first name..." :
                  step === "business_name" ? "Business name..." :
                  step === "business_description" ? "We help X do Y by..." :
                  step === "business_goal" ? "e.g. Hit $100k MRR / Build an audience of 10k..." :
                  step === "target_scale" ? "e.g. $1M ARR, 100 customers, market leader..." :
                  step === "timeline" ? "e.g. By end of year, 6 months, 2026..." :
                  step === "anthropic" ? "sk-ant-..." :
                  "Type here..."
                }
                className="flex-1 h-11 rounded-xl border border-border bg-card px-4 text-[13.5px] outline-none focus:border-primary/50 transition-colors"
              />
              {(step === "business_name" || step === "anthropic") && (
                <button
                  onClick={skipCurrent}
                  className="h-11 px-4 rounded-xl border border-border bg-card text-[12px] text-muted-foreground hover:bg-accent transition-colors"
                >
                  Skip
                </button>
              )}
              <button
                onClick={() => submitText(textInput)}
                disabled={!textInput.trim()}
                className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                {step === "anthropic" ? <Rocket className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
            {step === "anthropic" && (
              <p className="text-[10px] text-muted-foreground/70 mt-2">
                Get your key at console.anthropic.com/settings/keys · Stored securely · You can skip for now
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
