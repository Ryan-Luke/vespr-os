"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ArrowRight, Loader2, AlertCircle } from "lucide-react"

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
import { cn } from "@/lib/utils"
import { PixelAvatar } from "@/components/pixel-avatar"

// ── Nova-powered onboarding ──────────────────────────────────
// Phase 1: Static preset greeting + API key collection. No AI calls.
// Phase 2: useChat with the validated key. Nova runs the conversation.

// The static greeting never changes. Same words every time.
const NOVA_GREETING = "Hey, I'm Nova. I'll be your Chief of Staff here.\n\nBefore I can start working, I need your Anthropic API key. It powers the AI behind our entire team.\n\nYou can grab one at console.anthropic.com/settings/keys. It starts with sk-ant-. Paste it below when you're ready."

export default function OnboardingPage() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Phase 1 state: API key collection
  const [phase, setPhase] = useState<"key" | "chat">("key")
  const [keyInput, setKeyInput] = useState("")
  const [validating, setValidating] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [validatedKey, setValidatedKey] = useState<string | null>(null)

  // Phase 2 state: AI conversation
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const redirectTriggered = useRef(false)

  // Redirect if workspace already exists
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
      } catch {}
    })()
    return () => { cancelled = true }
  }, [router])

  // Phase 2: useChat transport with the validated key
  const transport = useMemo(() => {
    if (!validatedKey) return null
    return new DefaultChatTransport({
      api: "/api/onboarding/chat",
      body: { validatedApiKey: validatedKey },
    })
  }, [validatedKey])

  const chat = useChat({ transport: transport! })
  const { messages, sendMessage, status } = transport ? chat : { messages: [], sendMessage: (() => {}) as any, status: "ready" as const }
  const isLoading = status === "streaming" || status === "submitted"

  // When phase switches to chat, send the opening context to Nova
  const chatStarted = useRef(false)
  useEffect(() => {
    if (phase !== "chat" || chatStarted.current || !validatedKey) return
    chatStarted.current = true
    setTimeout(() => {
      sendMessage({ text: "I just connected my API key. Let's set up my business." })
    }, 300)
  }, [phase, validatedKey, sendMessage])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, phase])

  // Focus input
  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isLoading, messages.length, phase])

  // Detect onboarding completion from Nova's messages
  useEffect(() => {
    if (onboardingComplete) return
    for (const msg of messages) {
      if (msg.role !== "assistant") continue
      for (const part of msg.parts ?? []) {
        const text = (part as any).text as string | undefined
        if (text && (
          text.includes("team is being") ||
          (text.includes("workspace") && text.includes("set up")) ||
          text.includes("activating") ||
          text.includes("redirected") ||
          text.includes("ready to go")
        )) {
          setOnboardingComplete(true)
          return
        }
      }
    }
  }, [messages, onboardingComplete])

  // Redirect after completion
  useEffect(() => {
    if (onboardingComplete && !isLoading && !redirectTriggered.current) {
      redirectTriggered.current = true
      setTimeout(() => router.push("/"), 3000)
    }
  }, [onboardingComplete, isLoading, router])

  // Phase 1: Validate API key
  async function handleKeySubmit() {
    const key = keyInput.trim()
    if (!key) return
    if (!key.startsWith("sk-ant-")) {
      setKeyError("That doesn't look right. The key should start with sk-ant-")
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
        setKeyError(data.error || "Key validation failed. Double check it and try again.")
      }
    } catch {
      setKeyError("Could not reach the server. Try again.")
    } finally {
      setValidating(false)
    }
  }

  // Phase 2: Send chat message
  function handleChatSubmit() {
    const text = (inputRef.current?.value ?? "").trim()
    if (!text || isLoading) return
    sendMessage({ text })
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: onboardingComplete ? "100%" : phase === "key" ? "5%" : `${Math.min(95, 10 + messages.length * 8)}%` }}
          />
        </div>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2.5">
          <PixelAvatar characterIndex={3} size={32} className="rounded-md shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold">Nova</p>
              <span className={cn("h-1.5 w-1.5 rounded-full", phase === "chat" ? "bg-emerald-500" : "bg-muted-foreground/30")} />
              <span className="text-[10px] text-muted-foreground">Chief of Staff</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              {onboardingComplete ? "Launching your team..." : phase === "key" ? "Waiting for API key" : "Getting you set up"}
            </p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {/* Phase 1: Static greeting (always visible) */}
          <div className="flex items-end gap-2 justify-start">
            <div className="shrink-0 w-7">
              <PixelAvatar characterIndex={3} size={28} className="rounded-md" />
            </div>
            <div className="max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-all bg-card border border-border">
              {NOVA_GREETING}
            </div>
          </div>

          {/* Phase 1: Show the validated key confirmation */}
          {validatedKey && (
            <>
              <div className="flex items-end gap-2 justify-end">
                <div className="max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed bg-primary text-primary-foreground">
                  {`${validatedKey.slice(0, 10)}...${validatedKey.slice(-4)}`}
                </div>
              </div>
              <div className="flex items-end gap-2 justify-start">
                <div className="shrink-0 w-7">
                  <PixelAvatar characterIndex={3} size={28} className="rounded-md" />
                </div>
                <div className="max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed bg-card border border-border">
                  Key verified. I'm online now. Let's build your business.
                </div>
              </div>
            </>
          )}

          {/* Phase 2: AI conversation messages */}
          {messages.map((msg, i) => {
            const textParts = (msg.parts ?? []).filter((p) => p.type === "text")
            if (textParts.length === 0) return null
            const isAssistant = msg.role === "assistant"
            const isFirstOfRun = isAssistant && (i === 0 || messages[i - 1]?.role !== "assistant")
            // Hide the initial context message
            if (msg.role === "user" && i === 0) return null

            return (
              <div key={msg.id} className={cn("flex items-end gap-2", isAssistant ? "justify-start" : "justify-end")}>
                {isAssistant && (
                  <div className="shrink-0 w-7">
                    {isFirstOfRun && <PixelAvatar characterIndex={3} size={28} className="rounded-md" />}
                  </div>
                )}
                <div className={cn(
                  "max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-all",
                  isAssistant ? "bg-card border border-border" : "bg-primary text-primary-foreground"
                )}>
                  {textParts.map((p, j) => <span key={j}>{(p as any).text}</span>)}
                </div>
              </div>
            )
          })}

          {/* Business type selector: shows when Nova asks about business type */}
          {(() => {
            if (isLoading || phase !== "chat") return null
            const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
            if (!lastAssistant) return null
            const lastText = (lastAssistant.parts ?? [])
              .filter((p) => p.type === "text")
              .map((p) => (p as any).text)
              .join("")
              .toLowerCase()
            const asksBusinessType = (
              lastText.includes("type of business") ||
              lastText.includes("business type") ||
              (lastText.includes("e-commerce") && lastText.includes("agency") && lastText.includes("saas"))
            )
            if (!asksBusinessType) return null
            return (
              <div className="grid gap-2 md:grid-cols-2 pt-2">
                {BUSINESS_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      sendMessage({ text: `${t.icon} ${t.label}` })
                    }}
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
            )
          })()}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="shrink-0 w-7">
                <PixelAvatar characterIndex={3} size={28} className="rounded-md" />
              </div>
              <div className="rounded-2xl px-4 py-2.5 bg-card border border-border">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* Completion indicator */}
          {onboardingComplete && (
            <div className="flex items-end gap-2 justify-start pt-4">
              <div className="shrink-0 w-7">
                <PixelAvatar characterIndex={3} size={28} className="rounded-md" />
              </div>
              <div className="max-w-[78%] rounded-2xl px-4 py-3 bg-card border border-border">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <p className="text-[13px] text-muted-foreground">Setting up your workspace and activating your team...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      {!onboardingComplete && (
        <div className="border-t border-border bg-background/95 backdrop-blur p-4">
          <div className="max-w-2xl mx-auto">
            {phase === "key" ? (
              /* Phase 1: API key input */
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="password"
                    value={keyInput}
                    onChange={(e) => { setKeyInput(e.target.value); setKeyError(null) }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleKeySubmit() } }}
                    placeholder="sk-ant-..."
                    disabled={validating}
                    className="flex-1 h-11 rounded-xl border border-border bg-card px-4 text-[13.5px] font-mono outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={handleKeySubmit}
                    disabled={!keyInput.trim() || validating}
                    className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-40"
                  >
                    {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
                  </button>
                </div>
                {keyError && (
                  <div className="flex items-center gap-1.5 text-[12px] text-red-400">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {keyError}
                  </div>
                )}
              </div>
            ) : (
              /* Phase 2: Chat input */
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  defaultValue=""
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSubmit() } }}
                  disabled={isLoading}
                  className="flex-1 h-11 rounded-xl border border-border bg-card px-4 text-[13.5px] outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={isLoading}
                  className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40"
                >
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
