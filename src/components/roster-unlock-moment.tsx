"use client"

import { useState, useEffect } from "react"
import { ARCHETYPES, TIER_STYLES, UNLOCK_LADDER, type ArchetypeId, type Tier } from "@/lib/archetypes"
import { cn } from "@/lib/utils"
import { Lock, Unlock, Sparkles, X } from "lucide-react"

interface RosterUnlock {
  id: string
  workspaceId: string | null
  archetype: string
  tier: string
  triggerMetric: string
  triggerValue: string | null
  unlockedAt: string
  acknowledgedAt: string | null
}

export function RosterUnlockMoment() {
  const [unlocks, setUnlocks] = useState<RosterUnlock[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    const wsId = typeof window !== "undefined" ? localStorage.getItem("vespr-active-workspace") : null
    const url = wsId
      ? `/api/roster-unlocks?workspaceId=${wsId}&unacknowledged=true`
      : "/api/roster-unlocks?unacknowledged=true"

    fetch(url)
      .then((r) => r.json())
      .then((data: RosterUnlock[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setUnlocks(data)
          setTimeout(() => setAnimating(true), 400) // slight delay after evolution modal
        }
      })
      .catch(() => {})
  }, [])

  async function dismiss() {
    const current = unlocks[currentIndex]
    if (!current) return
    await fetch("/api/roster-unlocks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id }),
    }).catch(() => {})

    if (currentIndex < unlocks.length - 1) {
      setAnimating(false)
      setCurrentIndex(currentIndex + 1)
      setTimeout(() => setAnimating(true), 200)
    } else {
      setUnlocks([])
      setCurrentIndex(0)
    }
  }

  if (unlocks.length === 0) return null
  const unlock = unlocks[currentIndex]
  if (!unlock) return null

  const archetypeId = unlock.archetype as ArchetypeId
  const archetype = ARCHETYPES[archetypeId] || ARCHETYPES.operator
  const tier = (unlock.tier || "common") as Tier
  const tierStyle = TIER_STYLES[tier] || TIER_STYLES.common

  // Find the unlock requirement for tagline
  const ladderEntry = UNLOCK_LADDER.find((u) => u.archetype === archetypeId)
  const tagline = ladderEntry?.tagline || "A new archetype has joined your roster."
  const triggerLabel = unlock.triggerValue || ladderEntry?.trigger.label || "Milestone reached"

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative max-w-md w-full mx-4">
        <button
          onClick={dismiss}
          className="absolute -top-2 -right-2 z-10 h-8 w-8 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        {unlocks.length > 1 && (
          <div className="absolute -top-6 left-0 flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{currentIndex + 1} of {unlocks.length} unlocks</span>
          </div>
        )}

        <div className={cn("bg-card border-2 rounded-2xl p-8 transition-all duration-700", tierStyle.border, tierStyle.glow)}>
          {/* Lock → Unlock animation */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              {animating ? (
                <Unlock className={cn("h-12 w-12 transition-all duration-500", tierStyle.text)} />
              ) : (
                <Lock className="h-12 w-12 text-muted-foreground" />
              )}
              <Sparkles className={cn("absolute -top-1 -right-1 h-4 w-4", tierStyle.text, animating && "animate-pulse")} />
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <p className={cn("text-[11px] uppercase tracking-widest font-bold", tierStyle.text)}>
              New Archetype Unlocked
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl">{archetype.icon}</span>
              <h2 className="text-2xl font-bold">{archetype.label}</h2>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border", tierStyle.text, tierStyle.bg, tierStyle.border)}>
                {tierStyle.label}
              </span>
            </div>
          </div>

          {/* Trigger */}
          <div className={cn("mt-5 rounded-lg p-3 text-center", tierStyle.bg, "border", tierStyle.border)}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">You unlocked this by hitting</p>
            <p className={cn("text-[13px] font-bold", tierStyle.text)}>{triggerLabel}</p>
          </div>

          {/* Tagline */}
          <p className="text-[13px] text-foreground/80 mt-4 leading-relaxed text-center italic">
            &ldquo;{tagline}&rdquo;
          </p>

          {/* Description */}
          <p className="text-[12px] text-muted-foreground mt-3 text-center leading-relaxed">
            {archetype.description}
          </p>

          {/* CTA */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={dismiss}
              className="flex-1 h-10 rounded-lg text-[13px] text-muted-foreground hover:bg-accent transition-colors"
            >
              Later
            </button>
            <a
              href={`/builder?archetype=${unlock.archetype}`}
              onClick={dismiss}
              className={cn(
                "flex-1 h-10 rounded-lg font-semibold text-[13px] flex items-center justify-center transition-colors border-2",
                tierStyle.text,
                tierStyle.border,
                tierStyle.bg,
                "hover:brightness-125"
              )}
            >
              Hire {archetype.label}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
