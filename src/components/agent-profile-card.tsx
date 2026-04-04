"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PixelAvatar } from "@/components/pixel-avatar"
import type { Agent, PersonalityTraits } from "@/lib/types"
import { PERSONALITY_PRESETS, TRAIT_LABELS } from "@/lib/personality-presets"
import { levelProgress, levelTitle } from "@/lib/gamification"
import { MessageSquare, Crown, ThumbsUp, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

function getTopTraits(traits: PersonalityTraits) {
  return (Object.entries(traits) as [keyof PersonalityTraits, number][])
    .map(([key, val]) => ({ key, val, distance: Math.abs(val - 50) }))
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 3)
    .map(({ key, val }) => TRAIT_LABELS[key][val >= 50 ? "high" : "low"])
}

export function AgentProfileCard({ agent, children, onDM }: { agent: Agent; children: React.ReactNode; onDM?: (agent: Agent) => void }) {
  const preset = agent.personalityPresetId ? PERSONALITY_PRESETS.find((p) => p.id === agent.personalityPresetId) : null
  const [feedback, setFeedback] = useState<{ positive: number; negative: number; total: number } | null>(null)
  const [loaded, setLoaded] = useState(false)

  function loadFeedback() {
    if (loaded) return
    setLoaded(true)
    fetch(`/api/feedback?agentId=${agent.id}`).then((r) => r.json()).then(setFeedback).catch(() => {})
  }

  return (
    <Popover onOpenChange={(open) => { if (open) loadFeedback() }}>
      <PopoverTrigger className="cursor-pointer hover:opacity-80 transition-opacity">{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0 bg-popover border border-border rounded-md" align="start" side="right">
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={28} className="rounded-sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold truncate">{agent.name}</span>
                {agent.isTeamLead && <Crown className="h-3 w-3 text-amber-500" />}
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", agent.status === "working" ? "status-working" : agent.status === "error" ? "status-error" : agent.status === "paused" ? "status-paused" : "status-idle")} />
              </div>
              <p className="text-[11px] text-muted-foreground">{agent.role} · Lv.{agent.level ?? 1}</p>
            </div>
          </div>

          {/* Current task */}
          {agent.currentTask && (
            <p className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1.5 line-clamp-2">{agent.currentTask}</p>
          )}

          {/* Personality */}
          {preset ? (
            <div className="text-[11px]">
              <span className="text-muted-foreground">Personality:</span> <span className="font-medium">{preset.name}</span>
            </div>
          ) : agent.personality ? (
            <div className="text-[11px] text-muted-foreground">
              {getTopTraits(agent.personality).join(" · ")}
            </div>
          ) : null}

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{agent.tasksCompleted} tasks</span>
            <span className="tabular-nums">${agent.costThisMonth}/mo</span>
            {feedback && feedback.total > 0 && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-2.5 w-2.5" />{feedback.positive}
                <ThumbsDown className="h-2.5 w-2.5 ml-0.5" />{feedback.negative}
              </span>
            )}
          </div>

          {/* XP bar */}
          {(agent.level ?? 0) > 0 && (
            <div>
              <div className="h-1 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${levelProgress(agent.xp ?? 0)}%` }} />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1 border-t border-border">
            {onDM && (
              <button onClick={() => onDM(agent)} className="flex-1 h-6 rounded text-[11px] font-medium text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-1">
                <MessageSquare className="h-3 w-3" />Message
              </button>
            )}
            <Link href={`/teams/${agent.teamId}/agents/${agent.id}`} className="flex-1 h-6 rounded text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center justify-center">
              Profile
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
