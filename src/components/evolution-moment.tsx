"use client"

import { useState, useEffect } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { ARCHETYPES, TIER_STYLES, type ArchetypeId, type Tier } from "@/lib/archetypes"
import { cn } from "@/lib/utils"
import { Sparkles, ArrowRight, Zap, X, Share2 } from "lucide-react"

interface EvolutionEvent {
  id: string
  agentId: string
  fromForm: string
  toForm: string
  triggerMetric: string
  triggerValue: number
  unlockedCapabilities: string[]
  occurredAt: string
  acknowledgedAt: string | null
  agent: {
    id: string
    name: string
    nickname: string | null
    pixelAvatarIndex: number
    archetype: string | null
    tier: string
  } | null
}

type AnimationStage = "hidden" | "flash" | "glow" | "reveal"

export function EvolutionMoment() {
  const [events, setEvents] = useState<EvolutionEvent[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [stage, setStage] = useState<AnimationStage>("hidden")

  function runAnimation() {
    // Stage 1: white flash (~200ms)
    setStage("flash")
    setTimeout(() => {
      // Stage 2: tier glow pulse (~400ms)
      setStage("glow")
      setTimeout(() => {
        // Stage 3: full card reveal
        setStage("reveal")
      }, 400)
    }, 250)
  }

  useEffect(() => {
    // Check for unacknowledged evolutions on mount (next session start)
    fetch("/api/evolution-events?unacknowledged=true")
      .then((r) => r.json())
      .then((data: EvolutionEvent[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setEvents(data)
          setTimeout(runAnimation, 150)
        }
      })
      .catch(() => {})
  }, [])

  async function dismissCurrent() {
    const current = events[currentIndex]
    if (!current) return
    // Mark acknowledged
    await fetch("/api/evolution-events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id }),
    }).catch(() => {})

    if (currentIndex < events.length - 1) {
      setStage("hidden")
      setCurrentIndex(currentIndex + 1)
      setTimeout(runAnimation, 200)
    } else {
      setEvents([])
      setCurrentIndex(0)
      setStage("hidden")
    }
  }

  const animating = stage === "reveal"

  if (events.length === 0) return null
  const event = events[currentIndex]
  if (!event || !event.agent) return null

  const archetypeId = (event.agent.archetype || "operator") as ArchetypeId
  const archetype = ARCHETYPES[archetypeId] || ARCHETYPES.operator
  const newTier = (event.agent.tier || "common") as Tier
  const tierStyle = TIER_STYLES[newTier] || TIER_STYLES.common
  const displayName = event.agent.nickname || event.agent.name

  // Find previous form's tier
  const fromFormObj = archetype.forms.find((f) => f.name === event.fromForm)
  const fromTier = (fromFormObj?.tier || "common") as Tier
  const fromTierStyle = TIER_STYLES[fromTier] || TIER_STYLES.common

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      {/* White flash overlay — stage 1 */}
      {stage === "flash" && (
        <div className="absolute inset-0 bg-white animate-in fade-in duration-150" style={{ animationDuration: "150ms" }} />
      )}
      {/* Tier glow pulse — stage 2 */}
      {(stage === "glow" || stage === "reveal") && (
        <div
          className={cn("absolute inset-0 pointer-events-none transition-opacity duration-700", stage === "glow" ? "opacity-100" : "opacity-30")}
          style={{
            background: `radial-gradient(circle at center, ${newTier === "legendary" ? "rgba(245,158,11,0.35)" : newTier === "epic" ? "rgba(168,85,247,0.35)" : newTier === "rare" ? "rgba(59,130,246,0.35)" : newTier === "uncommon" ? "rgba(16,185,129,0.30)" : "rgba(100,116,139,0.25)"} 0%, transparent 60%)`,
          }}
        />
      )}

      <div className={cn("relative max-w-lg w-full mx-4 transition-all duration-500", stage === "reveal" ? "scale-100 opacity-100" : "scale-90 opacity-0")}>
        {/* Close */}
        <button
          onClick={dismissCurrent}
          className="absolute -top-2 -right-2 z-10 h-8 w-8 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Queue indicator */}
        {events.length > 1 && (
          <div className="absolute -top-6 left-0 flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              {currentIndex + 1} of {events.length} evolutions
            </span>
          </div>
        )}

        <div className={cn("bg-card border-2 rounded-2xl p-8 transition-all duration-700", tierStyle.border, tierStyle.glow)}>
          {/* Header with sparkle */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-2">
              <Sparkles className={cn("h-4 w-4", tierStyle.text, animating && "animate-pulse")} />
              <p className={cn("text-[11px] uppercase tracking-widest font-bold", tierStyle.text)}>Evolution</p>
              <Sparkles className={cn("h-4 w-4", tierStyle.text, animating && "animate-pulse")} />
            </div>
            <h2 className="text-xl font-bold">{displayName} evolved!</h2>
          </div>

          {/* Before / After cards */}
          <div className="flex items-center gap-3">
            {/* Before */}
            <div className={cn("flex-1 rounded-lg border p-3 opacity-60 transition-all", fromTierStyle.bg, fromTierStyle.border)}>
              <div className="flex flex-col items-center text-center">
                <PixelAvatar characterIndex={event.agent.pixelAvatarIndex} size={36} className="rounded-md mb-2" />
                <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{fromTierStyle.label}</p>
                <p className="text-[13px] font-semibold mt-0.5">{event.fromForm}</p>
              </div>
            </div>

            {/* Arrow */}
            <div className={cn("transition-all duration-700", animating ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0")}>
              <ArrowRight className={cn("h-5 w-5", tierStyle.text)} />
            </div>

            {/* After */}
            <div className={cn("flex-1 rounded-lg border-2 p-3 transition-all duration-700", tierStyle.bg, tierStyle.border, animating && "scale-105")}>
              <div className="flex flex-col items-center text-center">
                <div className={cn("rounded-md transition-all", animating && tierStyle.glow)}>
                  <PixelAvatar characterIndex={event.agent.pixelAvatarIndex} size={36} className="rounded-md mb-2" />
                </div>
                <p className={cn("text-[11px] uppercase tracking-wider font-bold", tierStyle.text)}>{tierStyle.label}</p>
                <p className="text-[13px] font-semibold mt-0.5">{event.toForm}</p>
              </div>
            </div>
          </div>

          {/* Trigger reason */}
          <div className="mt-5 text-center">
            <p className="text-[11px] text-muted-foreground">
              Crossed {event.triggerValue.toLocaleString()} {event.triggerMetric.replace(/_/g, " ")}
            </p>
          </div>

          {/* Unlocked capabilities */}
          {event.unlockedCapabilities && event.unlockedCapabilities.length > 0 && (
            <div className="mt-5 pt-5 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-center gap-1">
                <Zap className="h-3 w-3" />
                New capabilities unlocked
              </p>
              <div className="space-y-1.5">
                {event.unlockedCapabilities.map((cap, i) => (
                  <div
                    key={cap}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] transition-all",
                      tierStyle.bg,
                      "border",
                      tierStyle.border,
                    )}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <Zap className={cn("h-3 w-3 shrink-0", tierStyle.text)} />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="flex gap-2 mt-6">
            <a
              href={`/api/share-card/evolution?id=${event.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "h-10 px-4 rounded-lg font-semibold text-[13px] transition-colors border-2 flex items-center gap-2",
                "text-muted-foreground border-border hover:bg-accent"
              )}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </a>
            <button
              onClick={dismissCurrent}
              className={cn(
                "flex-1 h-10 rounded-lg font-semibold text-[13px] transition-colors",
                tierStyle.text,
                "border-2",
                tierStyle.border,
                tierStyle.bg,
                "hover:brightness-125"
              )}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
