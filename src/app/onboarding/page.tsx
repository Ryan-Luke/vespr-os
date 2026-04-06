"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ArrowRight, Loader2, Rocket } from "lucide-react"
import { cn } from "@/lib/utils"
import { PixelAvatar } from "@/components/pixel-avatar"

// ── Nova-powered onboarding ──────────────────────────────────
// Single useChat conversation. No step machine, no setTimeout chains,
// no duplicate message bugs. Nova collects everything she needs
// naturally and calls complete_onboarding when ready.

export default function OnboardingPage() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [validatedApiKey, setValidatedApiKey] = useState<string | null>(null)
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const redirectTriggered = useRef(false)

  // Redirect to dashboard if a workspace already exists
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

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/onboarding/chat",
    body: { validatedApiKey },
  }), [validatedApiKey])

  const { messages, sendMessage, status } = useChat({ transport })
  const [input, setInput] = useState("")

  const isLoading = status === "streaming" || status === "submitted"

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  // Focus input when not loading
  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isLoading, messages.length])

  // Watch for tool results to capture the validated API key and detect
  // onboarding completion. In AI SDK v6, tool parts are typed as
  // `tool-<toolName>` with a toolInvocation object.
  useEffect(() => {
    for (const msg of messages) {
      for (const part of msg.parts ?? []) {
        // Detect validated API key
        if (
          part.type?.startsWith("tool-") &&
          (part as any).toolInvocation?.toolName === "validate_api_key"
        ) {
          const result = (part as any).toolInvocation?.result
          if (result?.valid && result?.apiKey && !validatedApiKey) {
            setValidatedApiKey(result.apiKey)
          }
        }
        // Detect onboarding completion
        if (
          part.type?.startsWith("tool-") &&
          (part as any).toolInvocation?.toolName === "complete_onboarding"
        ) {
          const result = (part as any).toolInvocation?.result
          if (result?.success && !onboardingComplete) {
            setOnboardingComplete(true)
          }
        }
      }
    }
  }, [messages, validatedApiKey, onboardingComplete])

  // Redirect after completion with a short delay for Nova's final message
  useEffect(() => {
    if (onboardingComplete && !isLoading && !redirectTriggered.current) {
      redirectTriggered.current = true
      setTimeout(() => router.push("/"), 3000)
    }
  }, [onboardingComplete, isLoading, router])

  // Send initial message on mount to trigger Nova's greeting
  const initialSent = useRef(false)
  useEffect(() => {
    if (initialSent.current) return
    initialSent.current = true
    // Small delay so the page renders first
    setTimeout(() => {
      sendMessage({ text: "hi" })
    }, 400)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit() {
    const text = input.trim()
    if (!text || isLoading) return
    sendMessage({ text })
    setInput("")
  }

  // Count how many info items Nova has extracted (rough progress indicator)
  const progressEstimate = Math.min(100, Math.round((messages.length / 18) * 100))

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: onboardingComplete ? "100%" : `${progressEstimate}%` }}
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
              {onboardingComplete ? "Launching your team..." : "Getting you set up"}
            </p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.map((msg, i) => {
            // Only render text parts. Tool calls are invisible.
            const textParts = (msg.parts ?? []).filter((p) => p.type === "text")
            if (textParts.length === 0) return null

            const isAssistant = msg.role === "assistant"
            const isFirstOfRun = isAssistant && (i === 0 || messages[i - 1]?.role !== "assistant")
            // Hide the initial "hi" trigger message
            if (msg.role === "user" && i === 0 && textParts.length === 1 && (textParts[0] as any).text === "hi") return null

            return (
              <div key={msg.id} className={cn("flex items-end gap-2", isAssistant ? "justify-start" : "justify-end")}>
                {isAssistant && (
                  <div className="shrink-0 w-7">
                    {isFirstOfRun && <PixelAvatar characterIndex={3} size={28} className="rounded-md" />}
                  </div>
                )}
                <div className={cn(
                  "max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]",
                  isAssistant
                    ? "bg-card border border-border"
                    : "bg-primary text-primary-foreground"
                )}>
                  {textParts.map((p, j) => <span key={j}>{(p as any).text}</span>)}
                </div>
              </div>
            )
          })}

          {/* Typing indicator while streaming */}
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

          {/* Completion state */}
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
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type={!validatedApiKey ? "password" : "text"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                placeholder={!validatedApiKey ? "Paste your Anthropic API key (sk-ant-...)" : "Type your answer..."}
                disabled={isLoading}
                className="flex-1 h-11 rounded-xl border border-border bg-card px-4 text-[13.5px] outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                {!validatedApiKey ? <Rocket className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
