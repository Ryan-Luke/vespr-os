"use client"

import { useEffect, useState } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { cn } from "@/lib/utils"
import { levelTitle } from "@/lib/gamification"
import { PERSONALITY_PRESETS } from "@/lib/personality-presets"
import { ChevronDown, X } from "lucide-react"

interface Agent {
  id: string
  name: string
  role: string
  avatar: string
  pixelAvatarIndex: number
  level: number
  xp: number
  streak: number
  tasksCompleted: number
  costThisMonth: number
  autonomyLevel: string
  personalityPresetId: string | null
  skills: string[]
}

export default function ComparePage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data: Agent[]) => {
        setAgents(data)
        setLoading(false)
      })
  }, [])

  function toggleAgent(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }

  function removeAgent(id: string) {
    setSelected((prev) => prev.filter((s) => s !== id))
  }

  function presetName(presetId: string | null): string {
    if (!presetId) return "Custom"
    const preset = PERSONALITY_PRESETS.find((p) => p.id === presetId)
    return preset?.name ?? "Unknown"
  }

  function formatAutonomy(level: string): string {
    switch (level) {
      case "full_auto": return "Full Auto"
      case "supervised": return "Supervised"
      case "manual": return "Manual"
      default: return level
    }
  }

  const compared = selected.map((id) => agents.find((a) => a.id === id)).filter(Boolean) as Agent[]

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-muted-foreground">Loading agents...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[15px] font-semibold">Compare Agents</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Select 2-3 agents to compare side by side.
        </p>
      </div>

      {/* Agent selector */}
      <div className="relative w-full max-w-md">
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className={cn(
            "flex items-center justify-between w-full h-8 px-3 text-[13px]",
            "bg-card border border-border rounded-md",
            "hover:bg-accent transition-colors"
          )}
        >
          <span className="text-muted-foreground">
            {selected.length === 0
              ? "Pick agents to compare..."
              : `${selected.length} agent${selected.length > 1 ? "s" : ""} selected`}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </button>

        {dropdownOpen && (
          <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-md shadow-md max-h-56 overflow-y-auto">
            {agents.map((agent) => {
              const isSelected = selected.includes(agent.id)
              const disabled = !isSelected && selected.length >= 3
              return (
                <button
                  key={agent.id}
                  disabled={disabled}
                  onClick={() => toggleAgent(agent.id)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-1.5 text-[13px] text-left transition-colors",
                    isSelected && "bg-accent font-medium",
                    !isSelected && !disabled && "hover:bg-accent/50",
                    disabled && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} />
                  <span className="flex-1 truncate">{agent.name}</span>
                  <span className="text-[11px] text-muted-foreground truncate">{agent.role}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {compared.map((agent) => (
            <span
              key={agent.id}
              className="inline-flex items-center gap-1.5 h-7 px-2 bg-card border border-border rounded-md text-[12px]"
            >
              {agent.name}
              <button onClick={() => removeAgent(agent.id)} className="opacity-50 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Comparison table */}
      {compared.length >= 2 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${compared.length}, minmax(0, 1fr))` }}>
          {compared.map((agent) => (
            <div key={agent.id} className="bg-card border border-border rounded-md p-4 space-y-4">
              {/* Identity */}
              <div className="flex flex-col items-center text-center gap-2">
                <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={48} />
                <div>
                  <p className="text-[13px] font-medium">{agent.name}</p>
                  <p className="text-[11px] text-muted-foreground">{agent.role}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <p className="section-label">Stats</p>
                <div className="space-y-1.5">
                  <Row label="Level" value={`${agent.level} — ${levelTitle(agent.level)}`} />
                  <Row label="XP" value={agent.xp.toLocaleString()} />
                  <Row label="Streak" value={`${agent.streak} day${agent.streak !== 1 ? "s" : ""}`} />
                  <Row label="Tasks completed" value={agent.tasksCompleted.toLocaleString()} />
                  <Row label="Cost this month" value={`$${agent.costThisMonth.toFixed(2)}`} />
                </div>
              </div>

              {/* Configuration */}
              <div className="space-y-3">
                <p className="section-label">Configuration</p>
                <div className="space-y-1.5">
                  <Row label="Autonomy" value={formatAutonomy(agent.autonomyLevel)} />
                  <Row label="Personality" value={presetName(agent.personalityPresetId)} />
                </div>
              </div>

              {/* Skills */}
              <div className="space-y-3">
                <p className="section-label">Skills</p>
                {agent.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {agent.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-block px-1.5 py-0.5 text-[11px] bg-accent rounded text-muted-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No skills assigned</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {compared.length < 2 && selected.length > 0 && (
        <p className="text-[13px] text-muted-foreground">Select at least 2 agents to compare.</p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[13px] tabular-nums text-right">{value}</span>
    </div>
  )
}
