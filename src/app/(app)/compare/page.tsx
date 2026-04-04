"use client"

import { useEffect, useState } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { cn } from "@/lib/utils"
import { levelTitle } from "@/lib/gamification"
import { PERSONALITY_PRESETS, TRAIT_LABELS, type PersonalityTraits } from "@/lib/personality-presets"
import { ChevronDown, X, Users, Trophy, DollarSign, Flame, Star } from "lucide-react"
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts"

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
  personality: PersonalityTraits
  skills: string[]
}

const AGENT_COLORS = [
  { fill: "hsl(217, 91%, 60%)", stroke: "hsl(217, 91%, 60%)", name: "blue" },
  { fill: "hsl(160, 84%, 39%)", stroke: "hsl(160, 84%, 39%)", name: "emerald" },
  { fill: "hsl(38, 92%, 50%)", stroke: "hsl(38, 92%, 50%)", name: "amber" },
]

const TRAIT_KEYS: (keyof PersonalityTraits)[] = [
  "formality", "humor", "energy", "warmth", "directness", "confidence", "verbosity",
]

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

  // Build radar chart data
  const radarData = TRAIT_KEYS.map((trait) => {
    const entry: Record<string, string | number> = { trait: TRAIT_LABELS[trait].name }
    compared.forEach((agent, i) => {
      entry[agent.id] = agent.personality?.[trait] ?? 50
    })
    return entry
  })

  // Cost efficiency: tasks per dollar
  const costEfficiency = compared.map((agent) => ({
    name: agent.name,
    id: agent.id,
    value: agent.costThisMonth > 0 ? agent.tasksCompleted / agent.costThisMonth : 0,
  }))

  // Recommendations
  function getRecommendations(agents: Agent[]) {
    if (agents.length < 2) return []
    const recs: { label: string; agentName: string; icon: typeof Trophy; detail: string }[] = []

    // Highest output
    const highestOutput = [...agents].sort((a, b) => b.tasksCompleted - a.tasksCompleted)[0]
    recs.push({
      label: "Highest output",
      agentName: highestOutput.name,
      icon: Trophy,
      detail: `${highestOutput.tasksCompleted} tasks completed`,
    })

    // Most cost-efficient
    const mostEfficient = [...agents].sort((a, b) => {
      const aEff = a.costThisMonth > 0 ? a.tasksCompleted / a.costThisMonth : 0
      const bEff = b.costThisMonth > 0 ? b.tasksCompleted / b.costThisMonth : 0
      return bEff - aEff
    })[0]
    const effVal = mostEfficient.costThisMonth > 0
      ? (mostEfficient.tasksCompleted / mostEfficient.costThisMonth).toFixed(1)
      : "0"
    recs.push({
      label: "Most cost-efficient",
      agentName: mostEfficient.name,
      icon: DollarSign,
      detail: `${effVal} tasks/$`,
    })

    // Longest streak
    const longestStreak = [...agents].sort((a, b) => b.streak - a.streak)[0]
    recs.push({
      label: "Longest streak",
      agentName: longestStreak.name,
      icon: Flame,
      detail: `${longestStreak.streak} day streak`,
    })

    // Highest level (proxy for "highest rated")
    const highestLevel = [...agents].sort((a, b) => b.level - a.level || b.xp - a.xp)[0]
    recs.push({
      label: "Highest rated",
      agentName: highestLevel.name,
      icon: Star,
      detail: `Level ${highestLevel.level} — ${levelTitle(highestLevel.level)}`,
    })

    return recs
  }

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
        <h1 className="text-lg font-semibold tracking-tight">Compare Agents</h1>
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
          {compared.map((agent, i) => (
            <span
              key={agent.id}
              className="inline-flex items-center gap-1.5 h-7 px-2 bg-card border border-border rounded-md text-[12px]"
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: AGENT_COLORS[i]?.fill }}
              />
              {agent.name}
              <button onClick={() => removeAgent(agent.id)} className="opacity-50 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Comparison content */}
      {compared.length >= 2 ? (
        <div className="space-y-6">
          {/* Agent cards grid */}
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

          {/* Personality Radar Chart */}
          <div className="bg-card border border-border rounded-md p-4 space-y-3">
            <p className="section-label">Personality Radar</p>
            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="trait"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    tickCount={5}
                  />
                  {compared.map((agent, i) => (
                    <Radar
                      key={agent.id}
                      name={agent.name}
                      dataKey={agent.id}
                      stroke={AGENT_COLORS[i].stroke}
                      fill={AGENT_COLORS[i].fill}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-4">
              {compared.map((agent, i) => (
                <div key={agent.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: AGENT_COLORS[i].fill }}
                  />
                  {agent.name}
                </div>
              ))}
            </div>
          </div>

          {/* Side-by-side Personality Traits */}
          <div className="bg-card border border-border rounded-md p-4 space-y-3">
            <p className="section-label">Personality Traits Breakdown</p>
            <div className="space-y-3">
              {TRAIT_KEYS.map((trait) => (
                <div key={trait} className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] font-medium">{TRAIT_LABELS[trait].name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {TRAIT_LABELS[trait].low} ← → {TRAIT_LABELS[trait].high}
                    </span>
                  </div>
                  {compared.map((agent, i) => {
                    const val = agent.personality?.[trait] ?? 50
                    return (
                      <div key={agent.id} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-16 truncate">{agent.name}</span>
                        <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${val}%`,
                              backgroundColor: AGENT_COLORS[i].fill,
                            }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">{val}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Cost Efficiency */}
          <div className="bg-card border border-border rounded-md p-4 space-y-3">
            <p className="section-label">Cost Efficiency</p>
            <p className="text-[11px] text-muted-foreground">Tasks completed per dollar spent this month</p>
            <div className="w-full h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costEfficiency} layout="vertical" margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                    }}
                    formatter={(value: any) => [`${Number(value).toFixed(2)} tasks/$`, "Efficiency"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {costEfficiency.map((entry, i) => (
                      <Cell key={entry.id} fill={AGENT_COLORS[i]?.fill ?? "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Summary row */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${compared.length}, minmax(0, 1fr))` }}>
              {compared.map((agent, i) => {
                const eff = agent.costThisMonth > 0 ? (agent.tasksCompleted / agent.costThisMonth) : 0
                return (
                  <div key={agent.id} className="text-center">
                    <p className="text-[18px] font-semibold tabular-nums" style={{ color: AGENT_COLORS[i].fill }}>
                      {eff.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">tasks/$ for {agent.name}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-card border border-border rounded-md p-4 space-y-3">
            <p className="section-label">Best For...</p>
            <div className="grid grid-cols-2 gap-3">
              {getRecommendations(compared).map((rec) => {
                const Icon = rec.icon
                return (
                  <div
                    key={rec.label}
                    className="flex items-start gap-2.5 p-3 bg-accent/50 rounded-md"
                  >
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium">{rec.label}</p>
                      <p className="text-[13px] font-semibold truncate">{rec.agentName}</p>
                      <p className="text-[10px] text-muted-foreground">{rec.detail}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="py-20 flex flex-col items-center gap-4">
          <div className="flex items-center -space-x-2">
            {agents.slice(0, 3).map((agent) => (
              <div key={agent.id} className="rounded-full border-2 border-background">
                <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={36} />
              </div>
            ))}
          </div>
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" />
              <p className="text-[13px] font-medium">Select agents to compare</p>
            </div>
            <p className="text-[11px] text-muted-foreground max-w-xs">
              Pick 2-3 agents from the dropdown above to see a detailed side-by-side comparison of their stats, personality, cost efficiency, and more.
            </p>
          </div>
        </div>
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
