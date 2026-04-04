"use client"

import { useState } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { cn } from "@/lib/utils"

interface Agent {
  id: string
  name: string
  pixelAvatarIndex: number
  status: string
  tasksCompleted: number
  currentTask: string | null
}

// Seeded pseudo-random based on agent id + day index
function seededRandom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return Math.abs((Math.sin(hash) * 10000) % 1)
}

function getActivityLevel(agent: Agent, dayIndex: number): number {
  const base = seededRandom(`${agent.id}-${dayIndex}`)
  // Weight by agent productivity — more completed tasks = generally busier
  const taskWeight = Math.min(agent.tasksCompleted / 50, 1)
  // Working agents skew busier on recent days
  const recencyBoost = agent.status === "working" && dayIndex >= 5 ? 0.2 : 0
  // Paused/error agents skew lower
  const statusPenalty = agent.status === "paused" || agent.status === "error" ? -0.3 : 0
  return Math.max(0, Math.min(1, base * 0.5 + taskWeight * 0.4 + recencyBoost + statusPenalty))
}

function getOpacityClass(level: number): string {
  if (level < 0.15) return "bg-primary/[0.06]"
  if (level < 0.35) return "bg-primary/10"
  if (level < 0.55) return "bg-primary/30"
  if (level < 0.75) return "bg-primary/[0.55]"
  return "bg-primary/90"
}

function getTaskCount(level: number): number {
  if (level < 0.15) return 0
  if (level < 0.35) return Math.round(level * 4)
  if (level < 0.55) return Math.round(level * 8)
  if (level < 0.75) return Math.round(level * 12)
  return Math.round(level * 16)
}

function getDayLabels(): string[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const today = new Date()
  const labels: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    labels.push(days[d.getDay()])
  }
  return labels
}

export function UtilizationHeatmap({ agents }: { agents: Agent[] }) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  const dayLabels = getDayLabels()

  return (
    <div className="relative">
      {/* Day labels */}
      <div className="flex items-center gap-1 mb-1.5 pl-[88px]">
        {dayLabels.map((day, i) => (
          <span key={i} className="h-6 w-6 flex items-center justify-center text-[10px] text-muted-foreground/60">
            {day}
          </span>
        ))}
      </div>

      {/* Agent rows */}
      <div className="space-y-1">
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 w-[80px] shrink-0">
              <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={14} className="rounded-sm shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate">{agent.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {dayLabels.map((_, dayIndex) => {
                const level = getActivityLevel(agent, dayIndex)
                const tasks = getTaskCount(level)
                return (
                  <div
                    key={dayIndex}
                    className={cn("h-6 w-6 rounded cursor-default transition-colors", getOpacityClass(level))}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setTooltip({
                        text: `${agent.name} — ${dayLabels[dayIndex]}: ${tasks} tasks`,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 rounded bg-popover border border-border text-[11px] text-popover-foreground shadow-sm pointer-events-none whitespace-nowrap -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y - 4 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
