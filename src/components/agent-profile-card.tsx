"use client"

import { useState, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PixelAvatar } from "@/components/pixel-avatar"
import { StatusDot } from "@/components/status-dot"
import type { Agent, PersonalityTraits } from "@/lib/types"
import { PERSONALITY_PRESETS, TRAIT_LABELS } from "@/lib/personality-presets"
import { levelProgress, levelTitle } from "@/lib/gamification"
import { MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

/** Get the top 3 most distinctive traits (furthest from 50) */
function getTopTraits(traits: PersonalityTraits) {
  return (Object.entries(traits) as [keyof PersonalityTraits, number][])
    .map(([key, val]) => ({ key, val, distance: Math.abs(val - 50) }))
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 3)
    .map(({ key, val }) => {
      const label = TRAIT_LABELS[key]
      return val >= 50 ? label.high : label.low
    })
}

export function AgentProfileCard({
  agent,
  children,
  onDM,
}: {
  agent: Agent
  children: React.ReactNode
  onDM?: (agent: Agent) => void
}) {
  const preset = agent.personalityPresetId
    ? PERSONALITY_PRESETS.find((p) => p.id === agent.personalityPresetId)
    : null

  const [feedback, setFeedback] = useState<{ positive: number; negative: number } | null>(null)
  const [feedbackLoaded, setFeedbackLoaded] = useState(false)

  // Load feedback on popover open (lazy)
  function loadFeedback() {
    if (feedbackLoaded) return
    setFeedbackLoaded(true)
    fetch(`/api/feedback?agentId=${agent.id}`)
      .then((r) => r.json())
      .then((d) => setFeedback(d))
      .catch(() => {})
  }

  return (
    <Popover onOpenChange={(open) => { if (open) loadFeedback() }}>
      <PopoverTrigger className="cursor-pointer hover:opacity-80 transition-opacity">
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" side="right">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={48} className="rounded-xl border border-border" />
            <div>
              <h3 className="font-bold text-sm">{agent.name}</h3>
              <p className="text-xs text-muted-foreground">{agent.role}</p>
              <div className="mt-1">
                <StatusDot status={agent.status} showLabel />
              </div>
            </div>
          </div>

          {/* Level & Autonomy */}
          <div className="mt-2 space-y-1.5">
            {agent.level != null && agent.level > 0 && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium">Lv.{agent.level} {levelTitle(agent.level)}</span>
                  <span className="text-xs text-muted-foreground">{agent.xp ?? 0} XP</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${levelProgress(agent.xp ?? 0)}%` }} />
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {agent.autonomyLevel && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs h-5",
                    agent.autonomyLevel === "full_auto" && "bg-green-500/10 text-green-600 border-green-500/20",
                    agent.autonomyLevel === "manual" && "bg-orange-500/10 text-orange-600 border-orange-500/20",
                  )}
                >
                  {agent.autonomyLevel === "full_auto" ? "Full Auto" : agent.autonomyLevel === "supervised" ? "Supervised" : "Manual"}
                </Badge>
              )}
              {agent.isTeamLead && <Badge variant="secondary" className="text-xs h-5 bg-violet-500/10 text-violet-600 border-violet-500/20">Team Lead</Badge>}
              {(agent.streak ?? 0) >= 7 && <Badge variant="secondary" className="text-xs h-5 bg-orange-500/10 text-orange-600 border-orange-500/20">🔥 {agent.streak}d streak</Badge>}
            </div>
          </div>

          {/* Current Task */}
          {agent.currentTask && (
            <div className="mt-3 p-2 rounded-md bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Working on</p>
              <p className="text-xs">{agent.currentTask}</p>
            </div>
          )}

          {/* Personality */}
          {(preset || agent.personality) && (
            <div className="mt-3 p-2 rounded-md bg-violet-500/5 border border-violet-500/20">
              <p className="text-xs text-muted-foreground mb-1">Personality</p>
              {preset ? (
                <div>
                  <span className="text-xs font-medium">{preset.name}</span>
                  <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-1">{preset.speechStyle}</p>
                </div>
              ) : agent.personality ? (
                <div className="flex flex-wrap gap-1">
                  {getTopTraits(agent.personality).map((trait) => (
                    <Badge key={trait} variant="secondary" className="text-xs h-5">{trait}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Stats */}
          <div className={`grid gap-2 mt-3 ${feedback && (feedback.positive + feedback.negative) > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
            <div className="text-center">
              <p className="text-sm font-bold font-mono">{agent.tasksCompleted}</p>
              <p className="text-xs text-muted-foreground">Tasks</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold font-mono">${agent.costThisMonth}</p>
              <p className="text-xs text-muted-foreground">Cost/mo</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold font-mono">{agent.model.split(" ").pop()}</p>
              <p className="text-xs text-muted-foreground">Model</p>
            </div>
            {feedback && (feedback.positive + feedback.negative) > 0 && (
              <div className="text-center">
                <p className="text-sm font-bold font-mono flex items-center justify-center gap-1">
                  <ThumbsUp className="h-3 w-3 text-green-500" />{feedback.positive}
                  <ThumbsDown className="h-3 w-3 text-red-500 ml-0.5" />{feedback.negative}
                </p>
                <p className="text-xs text-muted-foreground">Rating</p>
              </div>
            )}
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-1 mt-3">
            {agent.skills.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
            ))}
            {agent.skills.length > 4 && (
              <Badge variant="secondary" className="text-xs">+{agent.skills.length - 4}</Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            {onDM && (
              <Button variant="default" size="sm" className="flex-1 h-7 text-xs" onClick={() => onDM(agent)}>
                <MessageSquare className="h-3 w-3 mr-1" />
                Message
              </Button>
            )}
            <Link href={`/teams/${agent.teamId}/agents/${agent.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full h-7 text-xs">
                View Profile
              </Button>
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
