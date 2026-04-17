"use client"

import { useState, useEffect } from "react"
import { ARCHETYPES, TIER_STYLES, UNLOCK_LADDER, STARTER_ARCHETYPES, type ArchetypeId, type Tier } from "@/lib/archetypes"
import { cn } from "@/lib/utils"
import { Check, Loader2 } from "lucide-react"
import Link from "next/link"

interface RosterUnlock {
  archetype: string
  tier: string
  triggerMetric: string
  triggerValue: string | null
  unlockedAt: string
}

export default function RosterPage() {
  const [unlocks, setUnlocks] = useState<RosterUnlock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const wsId = typeof window !== "undefined" ? localStorage.getItem("vespr-active-workspace") : null
    const url = wsId ? `/api/roster-unlocks?workspaceId=${wsId}` : "/api/roster-unlocks"
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setUnlocks(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading roster...
      </div>
    )
  }

  const unlockedArchetypes = new Set<string>([...STARTER_ARCHETYPES, ...unlocks.map((u) => u.archetype)])
  const unlockedCount = unlockedArchetypes.size
  const totalCount = Object.keys(ARCHETYPES).length

  const archetypeList = Object.values(ARCHETYPES)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Agent Roster</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {unlockedCount}/{totalCount} archetypes unlocked · Each one evolves through outcome-based forms
          </p>
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-[#16213e] rounded-full overflow-hidden mt-3 max-w-xs">
            <div className="h-full bg-[#635bff] transition-all" style={{ width: `${(unlockedCount / totalCount) * 100}%` }} />
          </div>
        </div>

        {/* Archetype grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {archetypeList.map((arch) => {
            const isUnlocked = unlockedArchetypes.has(arch.id)
            const ladderEntry = UNLOCK_LADDER.find((u) => u.archetype === arch.id)

            return (
              <div
                key={arch.id}
                className={cn(
                  "rounded-xl border p-5 transition-all",
                  isUnlocked
                    ? "bg-[#1a1a2e] border border-[rgba(255,255,255,0.08)] rounded-xl border-border hover:border-muted-foreground/30"
                    : "bg-muted/20 border-border/50"
                )}
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center text-2xl shrink-0", isUnlocked ? "bg-[#635bff]/10" : "bg-muted/60")}>
                    {isUnlocked ? arch.icon : <span className="opacity-40">{arch.icon}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold">{arch.label}</h3>
                      {isUnlocked ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <span className="text-[9px] uppercase tracking-wider font-medium text-amber-400 bg-[rgba(99,91,255,0.1)] text-[#635bff] border border-[rgba(99,91,255,0.15)] rounded-full border border-amber-500/30 rounded px-1.5 py-0.5">Earn to hire</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 italic">{arch.description}</p>
                  </div>
                </div>

                {/* Unlock info */}
                {!isUnlocked && ladderEntry && (
                  <div className="mt-4 bg-muted/40 border border-border/50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Hire this archetype after</p>
                    <p className="text-[13px] font-semibold">{ladderEntry.trigger.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 italic">{ladderEntry.tagline}</p>
                  </div>
                )}

                {/* Forms ladder */}
                <div className="mt-4 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Specialty progression</p>
                  {arch.forms.map((form, i) => {
                    const tierStyle = TIER_STYLES[form.tier]
                    return (
                      <div
                        key={form.name}
                        className={cn(
                          "flex items-center justify-between rounded-md border px-2.5 py-1.5",
                          isUnlocked ? cn(tierStyle.bg, tierStyle.border) : "bg-[#1e2a4a]/30 border-[rgba(255,255,255,0.06)]"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[11px] font-mono tabular-nums w-4", isUnlocked ? tierStyle.text : "text-muted-foreground")}>#{i + 1}</span>
                          <span className={cn("text-[12px] font-semibold", isUnlocked ? tierStyle.text : "text-muted-foreground")}>{form.name}</span>
                          <span className={cn("text-[9px] uppercase tracking-wider font-bold", isUnlocked ? tierStyle.text : "text-muted-foreground/50")}>
                            {tierStyle.label}
                          </span>
                        </div>
                        {form.thresholds.length > 0 && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {form.thresholds.map((t) => `${t.value} ${t.metric.replace(/_/g, " ")}`).join(" + ")}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Hire CTA */}
                {isUnlocked && (
                  <Link
                    href={`/builder?archetype=${arch.id}`}
                    className="mt-4 inline-flex items-center justify-center w-full h-8 rounded-lg btn-primary text-[12px] font-medium transition-colors"
                  >
                    Hire {arch.label}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
