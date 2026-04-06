"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, ArrowRight, Loader2, X, Plus, Rocket } from "lucide-react"
import { cn } from "@/lib/utils"
import { PixelAvatar } from "@/components/pixel-avatar"

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

// Anthropic FIRST so Nova can reason for the rest of the flow (per user direction)
const STEP_ORDER: Step[] = [
  "anthropic",
  "user_name",
  "business_name",
  "business_type",
  "business_description",
  "competitors",
  "business_goal",
  "target_scale",
  "timeline",
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("welcome")
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [textInput, setTextInput] = useState("")
  const [progress, setProgress] = useState("")
  const [riffing, setRiffing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Ref guards to prevent React Strict Mode double-invocation from doubling
  // the initial greeting chain and re-pushing per-step questions.
  const initGreetingStarted = useRef(false)
  const lastQuestionStep = useRef<Step | null>(null)

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
  const [anthropicKey, setAnthropicKey] = useState("")

  const stepIdx = STEP_ORDER.indexOf(step)
  const progressPct = stepIdx >= 0 ? Math.round(((stepIdx + 1) / TOTAL_STEPS) * 100) : 0

  // Single-tenant per deploy: if a workspace already exists, bounce to dashboard.
  // Prevents the "stacked duplicate workspaces" bug where re-visiting /onboarding
  // would spawn another VESPR, another team set, another 13 agents.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/workspaces")
        if (!res.ok) return
        const list = await res.json()
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          router.replace("/")
        }
      } catch {
        // ignore — onboarding proceeds if we can't check
      }
    })()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [entries, step, riffing])

  useEffect(() => {
    if (["user_name", "business_name", "business_description", "business_goal", "target_scale", "timeline", "anthropic"].includes(step)) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [step])

  useEffect(() => {
    // Ref guard: Strict Mode double-invokes effects in dev. Without this
    // guard, two setTimeout chains race and the second greeting line gets
    // pushed twice. Refs persist across double-mounts, so the second
    // invocation short-circuits cleanly.
    if (initGreetingStarted.current) return
    initGreetingStarted.current = true

    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(setTimeout(() => {
      setEntries([{ role: "assistant", content: "Hey, I'm Nova. I'll be your Chief of Staff here." }])
      timers.push(setTimeout(() => {
        setRiffing(true)
        timers.push(setTimeout(() => {
          setRiffing(false)
          setEntries((prev) => [...prev, { role: "assistant", content: "Before I bring the rest of the team online, I'm going to walk you through setup myself. I want to understand your business properly so I can brief everyone before they even start." }])
          timers.push(setTimeout(() => setStep("anthropic"), 2200))
        }, 1400))
      }, 1200))
    }, 600))

    return () => { timers.forEach(clearTimeout) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === "welcome" || step === "launching" || step === "done") return
    // Ref guard: ensure we only push the question once per step transition,
    // even if the effect fires twice from Strict Mode or rapid state churn.
    if (lastQuestionStep.current === step) return
    lastQuestionStep.current = step

    const q = getQuestion(step)
    setEntries((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && prev[prev.length - 1].content === q) return prev
      return [...prev, { role: "assistant", content: q }]
    })
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  function getQuestion(s: Step): string {
    switch (s) {
      case "anthropic": return "First thing I need is your Anthropic API key — it's what powers Claude, the brain behind our team.\n\nNo key yet? Here's how to grab one in about 2 minutes:\n\n1. Head to console.anthropic.com/settings/keys and sign up (or log in)\n2. Under 'Plans & Billing', add a small amount of credit — $5 is plenty to start\n3. Back on the Keys page, click 'Create Key', name it anything, and copy it\n4. Paste it here — it should start with 'sk-ant-'\n\nYour key stays private and is only used to run your agents."
      case "user_name": return "Perfect — I'm wired in. So, what's your name? I want to make sure the team calls you the right thing."
      case "business_name": return `What's the name of your business? You can skip this if you're still figuring it out.`
      case "business_type": return "What type of business is this?"
      case "business_description": return "In one or two sentences — what does your business do?"
      case "competitors": return "Anyone you're watching as competition? Drop websites or Instagram handles here. You can skip this."
      case "business_goal": return "What's the main goal for this business? What are you trying to achieve?"
      case "target_scale": return "Where do you want to scale this to? Revenue target, customer count, market position — whatever matters."
      case "timeline": return "Last one — what's your timeline? When do you want to hit that?"
      default: return ""
    }
  }

  async function submitText(value: string) {
    if (!value.trim()) return
    setEntries((prev) => [...prev, { role: "user", content: value }])
    setTextInput("")

    // Step 1: Anthropic auth — validate immediately, no riff (Nova isn't reasoning yet)
    if (step === "anthropic") {
      setEntries((prev) => [...prev, { role: "assistant", content: "Verifying your key..." }])
      try {
        const res = await fetch("/api/validate-anthropic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: value.trim() }),
        })
        const data = await res.json()
        if (data.valid) {
          setAnthropicKey(value.trim())
          setTimeout(() => setStep("user_name"), 400)
        } else {
          setEntries((prev) => [...prev, { role: "assistant", content: `That key didn't work: ${data.error || "Unknown error"}. Try another key or skip to continue without AI reasoning during setup.` }])
        }
      } catch {
        setEntries((prev) => [...prev, { role: "assistant", content: "Couldn't reach Anthropic. Try again or skip." }])
      }
      return
    }

    // Determine the next step and update local state for this step
    let nextStep: Step = step
    switch (step) {
      case "user_name":
        setUserName(value.trim())
        nextStep = "business_name"
        break
      case "business_name":
        setBusinessName(value.trim())
        nextStep = "business_type"
        break
      case "business_description":
        setBusinessDescription(value.trim())
        nextStep = "competitors"
        break
      case "business_goal":
        setBusinessGoal(value.trim())
        nextStep = "target_scale"
        break
      case "target_scale":
        setTargetScale(value.trim())
        nextStep = "timeline"
        break
      case "timeline":
        setTimeline(value.trim())
        // Timeline is the final step — launch directly
        launchBusiness(anthropicKey)
        return
    }

    // Riff: Nova generates a contextual acknowledgment before the next question.
    // The riff API also returns `coversNext` which lets Nova skip ahead when
    // the user's answer already covered the next topic. Example: "200k in the
    // next 12 months" covers both target_scale and timeline in one breath.
    if (anthropicKey) {
      setRiffing(true)
      // Artificial latency floor so even fast API round-trips feel like a real
      // person thinking. Without this, riffs appear instantly and the flow
      // feels robotic.
      const riffStart = Date.now()
      try {
        const nextQ = getQuestion(nextStep)
        const res = await fetch("/api/onboarding/riff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: anthropicKey,
            stepJustAnswered: step,
            latestAnswer: value.trim(),
            nextQuestion: nextQ,
            context: {
              userName: step === "user_name" ? value.trim() : userName,
              businessName: step === "business_name" ? value.trim() : businessName,
              businessType,
              businessDescription: step === "business_description" ? value.trim() : businessDescription,
              competitors,
              businessGoal: step === "business_goal" ? value.trim() : businessGoal,
              targetScale: step === "target_scale" ? value.trim() : targetScale,
              timeline,
            },
          }),
        })
        const data = await res.json() as { riff?: string; coversNext?: boolean; fallback?: boolean }
        if (data.riff && !data.fallback) {
          // Floor the riff latency at ~1.8s so it never appears too fast
          const elapsed = Date.now() - riffStart
          const minRiffDelay = 1800
          if (elapsed < minRiffDelay) {
            await new Promise((r) => setTimeout(r, minRiffDelay - elapsed))
          }
          setRiffing(false)
          setEntries((prev) => [...prev, { role: "assistant", content: data.riff! }])

          // If Nova detected that this answer already covered the next
          // question, decide whether to skip ahead or launch. Example:
          // "200k in the next 12 months" in target_scale covers timeline,
          // which is the last step, so we launch directly instead of
          // asking about timeline separately.
          let destination: Step = nextStep
          let shouldLaunch = false
          if (data.coversNext) {
            if (nextStep === "timeline") {
              // Implicit timeline captured from this answer. Launch.
              setTimeline(value.trim())
              shouldLaunch = true
            } else {
              const nextIdx = STEP_ORDER.indexOf(nextStep)
              if (nextIdx >= 0 && nextIdx + 1 < STEP_ORDER.length) {
                destination = STEP_ORDER[nextIdx + 1]
                // Best-effort: save the implicit answer to the skipped step.
                if (nextStep === "target_scale") setTargetScale(value.trim())
              }
            }
          }

          // Pause after the riff appears, then show typing dots again for
          // the next question. Gives the conversation a human cadence.
          await new Promise((r) => setTimeout(r, 900))
          setRiffing(true)
          await new Promise((r) => setTimeout(r, 1200))
          setRiffing(false)

          if (shouldLaunch) {
            launchBusiness(anthropicKey)
            return
          }
          setStep(destination)
          return
        }
      } catch {}
      setRiffing(false)
    }
    // Fallback (no key or riff failed): skip to next question with a short pause
    await new Promise((r) => setTimeout(r, 600))
    setStep(nextStep)
  }

  function skipCurrent() {
    setEntries((prev) => [...prev, { role: "user", content: "Skip" }])
    setTimeout(() => {
      if (step === "business_name") setStep("business_type")
      else if (step === "competitors") setStep("business_goal")
      // Note: anthropic step is no longer skippable — it's required for Nova to reason
    }, 300)
  }

  async function selectBusinessType(typeId: string) {
    const t = BUSINESS_TYPES.find((x) => x.id === typeId)
    if (!t) return
    setBusinessType(typeId)
    setEntries((prev) => [...prev, { role: "user", content: `${t.icon} ${t.label}` }])

    // Riff based on business type selection
    if (anthropicKey) {
      setRiffing(true)
      try {
        const res = await fetch("/api/onboarding/riff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: anthropicKey,
            stepJustAnswered: "business_type",
            latestAnswer: t.label,
            nextQuestion: getQuestion("business_description"),
            context: { userName, businessName, businessType: t.label },
          }),
        })
        const data = await res.json()
        if (data.riff && !data.fallback) {
          setEntries((prev) => [...prev, { role: "assistant", content: data.riff }])
          setRiffing(false)
          setTimeout(() => setStep("business_description"), 700)
          return
        }
      } catch {}
      setRiffing(false)
    }
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
        // Reset the product tour so it re-triggers for this fresh onboarding
        try { localStorage.removeItem("bos-tutorial-completed") } catch {}
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
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: step === "launching" || step === "done" ? "100%" : `${progressPct}%` }}
          />
        </div>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2.5">
          <PixelAvatar characterIndex={3} size={32} className="rounded-md shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold">Nova</p>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-muted-foreground">Chief of Staff</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              {step === "launching" || step === "done" ? "Launching your team..." : step === "welcome" ? "Getting you set up" : `Setup · Step ${stepIdx + 1} of ${TOTAL_STEPS}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">VESPR OS</p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {entries.map((entry, i) => {
            // Show avatar only on the first message of an assistant run
            const isFirstOfRun = entry.role === "assistant" && (i === 0 || entries[i - 1].role !== "assistant")
            return (
              <div key={i} className={cn("flex items-end gap-2", entry.role === "user" ? "justify-end" : "justify-start")}>
                {entry.role === "assistant" && (
                  <div className="shrink-0 w-7">
                    {isFirstOfRun && <PixelAvatar characterIndex={3} size={28} className="rounded-md" />}
                  </div>
                )}
                <div className={cn(
                  "max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap",
                  entry.role === "assistant"
                    ? "bg-card border border-border"
                    : "bg-primary text-primary-foreground"
                )}>
                  {entry.content}
                </div>
              </div>
            )
          })}

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
            <div className="flex items-end gap-2 justify-start pt-4">
              <PixelAvatar characterIndex={3} size={28} className="rounded-md shrink-0" />
              <div className="max-w-[78%] rounded-2xl px-4 py-3 bg-card border border-border">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <p className="text-[13px] text-muted-foreground">{progress}</p>
                </div>
              </div>
            </div>
          )}

          {riffing && (
            <div className="flex items-end gap-2 justify-start">
              <PixelAvatar characterIndex={3} size={28} className="rounded-md shrink-0" />
              <div className="rounded-2xl px-4 py-2.5 bg-card border border-border">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
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
              {step === "business_name" && (
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
