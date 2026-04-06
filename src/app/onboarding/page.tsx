"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { PixelAvatar } from "@/components/pixel-avatar"

// Dead simple onboarding. No useChat. No streaming. No hooks.
// Phase 1: static greeting + API key input
// Phase 2: plain fetch to /api/onboarding/chat, display JSON response

const NOVA_GREETING = "Hey, I'm Nova. I'll be your Chief of Staff here.\n\nBefore I can start working, I need your Anthropic API key. It powers the AI behind our entire team.\n\nYou can grab one at console.anthropic.com/settings/keys. It starts with sk-ant-. Paste it below when you're ready."

interface ChatMsg {
  role: "user" | "assistant"
  content: string
}

const BUSINESS_TYPES = [
  { id: "ecommerce", label: "E-Commerce", icon: "🛒", description: "Online store selling products" },
  { id: "service", label: "Service-Based", icon: "🛠️", description: "Done-for-you services, freelancing, local" },
  { id: "agency", label: "Agency", icon: "🏢", description: "Marketing, creative, or professional services" },
  { id: "saas", label: "SaaS / Tech", icon: "💻", description: "Software as a service" },
  { id: "consulting", label: "Coaching / Consulting", icon: "🎓", description: "Coaching programs, advisory, or consulting" },
  { id: "content", label: "Info Product / Course", icon: "📚", description: "Online courses, digital products, memberships" },
  { id: "brick_and_mortar", label: "Brick & Mortar", icon: "🏪", description: "Physical location business" },
  { id: "other", label: "Other", icon: "✨", description: "Something else entirely" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<"key" | "chat">("key")
  const [keyInput, setKeyInput] = useState("")
  const [validating, setValidating] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [validatedKey, setValidatedKey] = useState<string | null>(null)

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState("")
  const [sending, setSending] = useState(false)
  const [onboardingComplete, setOnboardingComplete] = useState(false)

  // No redirect. If user is at /onboarding, they want to onboard.
  // The API handles existing workspaces by wiping and recreating.

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [chatMessages, phase])

  // Focus input
  useEffect(() => {
    if (!sending) setTimeout(() => inputRef.current?.focus(), 100)
  }, [sending, chatMessages.length, phase])

  // Redirect after completion
  useEffect(() => {
    if (onboardingComplete) {
      setTimeout(() => router.push("/"), 3000)
    }
  }, [onboardingComplete, router])

  // Phase 1: validate API key
  async function handleKeySubmit() {
    const key = keyInput.trim()
    if (!key) return
    if (!key.startsWith("sk-ant-")) {
      setKeyError("Key should start with sk-ant-")
      return
    }
    setKeyError(null)
    setValidating(true)
    try {
      const res = await fetch("/api/validate-anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      })
      const data = await res.json()
      if (data.valid) {
        setValidatedKey(key)
        setPhase("chat")
      } else {
        setKeyError(data.error || "Key validation failed.")
      }
    } catch {
      setKeyError("Could not reach the server.")
    } finally {
      setValidating(false)
    }
  }

  // Phase 2: send chat message via plain fetch
  async function handleChatSubmit(text?: string) {
    const msg = text ?? chatInput.trim()
    if (!msg || sending) return
    setChatInput("")

    const newMessages: ChatMsg[] = [...chatMessages, { role: "user", content: msg }]
    setChatMessages(newMessages)
    setSending(true)

    try {
      const res = await fetch("/api/onboarding/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          validatedApiKey: validatedKey,
        }),
      })
      const data = await res.json()
      if (data.onboardingComplete) {
        // Tool fired successfully. Show completion message even if
        // response text is empty (tool call consumed the response).
        const msg = data.response || "Your team is being activated right now. First up, you'll meet your Head of R&D. They'll help you build out and validate your offer."
        setChatMessages([...newMessages, { role: "assistant", content: msg }])
        setOnboardingComplete(true)
      } else if (data.response) {
        setChatMessages([...newMessages, { role: "assistant", content: data.response }])
      } else if (data.error) {
        setChatMessages([...newMessages, { role: "assistant", content: `Something went wrong: ${data.error}. Try sending your message again.` }])
      } else {
        // Empty response. Check if workspace was created despite empty text.
        try {
          const wsCheck = await fetch("/api/workspaces").then(r => r.json())
          if (Array.isArray(wsCheck) && wsCheck.length > 0) {
            setChatMessages([...newMessages, { role: "assistant", content: "Your team is being activated right now. First up, you'll meet your Head of R&D. They'll help you build out and validate your offer." }])
            setOnboardingComplete(true)
            return
          }
        } catch {}
        // Actually empty. Ask again.
        setChatMessages([...newMessages, { role: "assistant", content: "Sorry about that, could you say that one more time?" }])
      }
    } catch (err) {
      setChatMessages([...newMessages, { role: "assistant", content: "Something went wrong. Try sending your message again." }])
    } finally {
      setSending(false)
    }
  }

  // Detect what Nova is asking about to show the right UI helpers
  const lastAssistant = [...chatMessages].reverse().find(m => m.role === "assistant")
  const lastText = lastAssistant?.content.toLowerCase() ?? ""
  const showBusinessTypeCards = lastText.includes("type of business")
  const showCompetitorInput = (lastText.includes("competitor") || lastText.includes("competition")) && !sending

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="h-1 w-full bg-muted">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: onboardingComplete ? "100%" : phase === "key" ? "5%" : `${Math.min(95, 10 + chatMessages.length * 6)}%` }} />
        </div>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2.5">
          <PixelAvatar characterIndex={3} size={32} className="rounded-md shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold">Nova</p>
              <span className={cn("h-1.5 w-1.5 rounded-full", phase === "chat" ? "bg-emerald-500" : "bg-muted-foreground/30")} />
              <span className="text-[10px] text-muted-foreground">Chief of Staff</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {/* Static greeting */}
          <div className="flex items-end gap-2 justify-start">
            <div className="shrink-0 w-7"><PixelAvatar characterIndex={3} size={28} className="rounded-md" /></div>
            <div className="max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-all bg-card border border-border">
              {NOVA_GREETING}
            </div>
          </div>

          {/* Key validated + first question */}
          {validatedKey && (
            <>
              <div className="flex items-end gap-2 justify-end">
                <div className="max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed bg-primary text-primary-foreground">
                  {`${validatedKey.slice(0, 10)}...${validatedKey.slice(-4)}`}
                </div>
              </div>
              <div className="flex items-end gap-2 justify-start">
                <div className="shrink-0 w-7"><PixelAvatar characterIndex={3} size={28} className="rounded-md" /></div>
                <div className="max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed bg-card border border-border">
                  Connected! I'm online now. Here's how this works: we'll go through a quick onboarding together. I'll ask a few questions about you and your business. Then I'll introduce you to your team, starting with your Head of R&D who will help you build and validate your offer. The whole thing takes about 2 minutes. Let's go. What's your name?
                </div>
              </div>
            </>
          )}

          {/* Chat messages */}
          {chatMessages.map((msg, i) => (
            <div key={i} className={cn("flex items-end gap-2", msg.role === "assistant" ? "justify-start" : "justify-end")}>
              {msg.role === "assistant" && (
                <div className="shrink-0 w-7"><PixelAvatar characterIndex={3} size={28} className="rounded-md" /></div>
              )}
              <div className={cn(
                "max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-all",
                msg.role === "assistant" ? "bg-card border border-border" : "bg-primary text-primary-foreground"
              )}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Business type cards */}
          {showBusinessTypeCards && !sending && (
            <div className="grid gap-2 md:grid-cols-2 pt-2">
              {BUSINESS_TYPES.map((t) => (
                <button key={t.id} onClick={() => handleChatSubmit(`${t.icon} ${t.label}`)}
                  className="flex items-start gap-3 text-left rounded-xl border border-border bg-card p-3 hover:border-primary/50 hover:bg-accent/30 transition-all">
                  <span className="text-xl shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Competitor input with skip option */}
          {showCompetitorInput && (
            <div className="ml-9 space-y-2 pt-1">
              <p className="text-[11px] text-muted-foreground/60">Drop an Instagram handle, website, or brand name.</p>
              <button
                onClick={() => handleChatSubmit("Skip")}
                className="h-8 px-4 rounded-lg border border-border bg-card text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                Skip
              </button>
            </div>
          )}

          {/* Typing indicator */}
          {sending && (
            <div className="flex items-end gap-2 justify-start">
              <div className="shrink-0 w-7"><PixelAvatar characterIndex={3} size={28} className="rounded-md" /></div>
              <div className="rounded-2xl px-4 py-2.5 bg-card border border-border">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* Completion */}
          {onboardingComplete && (
            <div className="flex items-end gap-2 justify-start pt-4">
              <div className="shrink-0 w-7"><PixelAvatar characterIndex={3} size={28} className="rounded-md" /></div>
              <div className="max-w-[78%] rounded-2xl px-4 py-3 bg-card border border-border">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <p className="text-[13px] text-muted-foreground">Setting up your workspace...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      {!onboardingComplete && (
        <div className="border-t border-border bg-background/95 backdrop-blur p-4">
          <div className="max-w-2xl mx-auto">
            {phase === "key" ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input ref={inputRef} type="password" value={keyInput}
                    onChange={(e) => { setKeyInput(e.target.value); setKeyError(null) }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleKeySubmit() }}
                    placeholder="sk-ant-..." disabled={validating}
                    className="flex-1 h-11 rounded-xl border border-border bg-card px-4 text-[13.5px] font-mono outline-none focus:border-primary/50 transition-colors disabled:opacity-50" />
                  <button onClick={handleKeySubmit} disabled={!keyInput.trim() || validating}
                    className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-2">
                    {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
                  </button>
                </div>
                {keyError && <div className="flex items-center gap-1.5 text-[12px] text-red-400"><AlertCircle className="h-3 w-3" />{keyError}</div>}
              </div>
            ) : (
              <div className="flex gap-2">
                <input ref={inputRef} type="text" value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSubmit() } }}
                  disabled={sending}
                  className="flex-1 h-11 rounded-xl border border-border bg-card px-4 text-[13.5px] outline-none focus:border-primary/50 transition-colors disabled:opacity-50" />
                <button onClick={() => handleChatSubmit()} disabled={!chatInput.trim() || sending}
                  className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40">
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
