"use client"

import { PixelAvatar } from "@/components/pixel-avatar"
import { ARCHETYPES, TIER_STYLES, type ArchetypeId, type Tier, getCurrentForm } from "@/lib/archetypes"
import { cn } from "@/lib/utils"
import { Zap } from "lucide-react"

interface IdentityCardAgent {
  id: string
  name: string
  nickname: string | null
  role: string
  pixelAvatarIndex: number
  archetype: string | null
  tier: string
  identityStats: {
    outreach?: number
    research?: number
    negotiation?: number
    execution?: number
    creativity?: number
  }
  level: number
  xp: number
  tasksCompleted: number
}

const STAT_LABELS: Record<string, string> = {
  outreach: "OUT",
  research: "RES",
  negotiation: "NEG",
  execution: "EXE",
  creativity: "CRE",
}

export function IdentityCard({ agent, compact = false }: { agent: IdentityCardAgent; compact?: boolean }) {
  const archetypeId = (agent.archetype || "operator") as ArchetypeId
  const archetype = ARCHETYPES[archetypeId] || ARCHETYPES.operator
  const tier = (agent.tier || "common") as Tier
  const tierStyle = TIER_STYLES[tier] || TIER_STYLES.common

  // Find current form based on archetype + tier
  const currentForm = archetype.forms.find((f) => f.tier === tier) || archetype.forms[0]
  const formName = currentForm?.name || archetype.label

  const displayName = agent.nickname || agent.name
  const stats = agent.identityStats || {}

  if (compact) {
    return (
      <div className={cn("rounded-lg border-2 p-3 max-w-xs", tierStyle.bg, tierStyle.border, tierStyle.glow)}>
        <div className="flex items-center gap-2.5">
          <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={32} className="rounded-md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold truncate">{displayName}</span>
              <span className={cn("text-[9px] uppercase tracking-wider font-medium", tierStyle.text)}>{tierStyle.label}</span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{formName}</p>
          </div>
          <span className="text-sm shrink-0">{archetype.icon}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("rounded-xl border-2 p-5 max-w-md", tierStyle.bg, tierStyle.border, tierStyle.glow)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={48} className="rounded-lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold truncate">{displayName}</h3>
            <span className="text-base shrink-0">{archetype.icon}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded", tierStyle.text, tierStyle.bg, "border", tierStyle.border)}>
              {tierStyle.label}
            </span>
            <span className="text-[11px] text-muted-foreground">{formName}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Lv.</div>
          <div className="text-lg font-bold tabular-nums leading-none">{agent.level}</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-[12px] text-muted-foreground/80 mt-3 italic leading-relaxed">&ldquo;{archetype.description}&rdquo;</p>

      {/* Stats grid */}
      <div className="mt-4 space-y-1.5">
        {Object.entries(stats).map(([key, value]) => {
          if (value === undefined || value === null) return null
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-8">{STAT_LABELS[key] || key.slice(0, 3).toUpperCase()}</span>
              <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", tierStyle.text.replace("text-", "bg-"))} style={{ width: `${value}%` }} />
              </div>
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-6 text-right">{value}</span>
            </div>
          )
        })}
      </div>

      {/* Capabilities */}
      {currentForm?.unlockedCapabilities && currentForm.unlockedCapabilities.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" />
            Unlocked
          </p>
          <div className="flex flex-wrap gap-1">
            {currentForm.unlockedCapabilities.map((cap) => (
              <span key={cap} className={cn("text-[10px] px-1.5 py-0.5 rounded border", tierStyle.bg, tierStyle.border, tierStyle.text)}>
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer stats */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Shipped</p>
          <p className="text-[13px] font-bold tabular-nums">{agent.tasksCompleted.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">XP</p>
          <p className="text-[13px] font-bold tabular-nums">{agent.xp.toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
