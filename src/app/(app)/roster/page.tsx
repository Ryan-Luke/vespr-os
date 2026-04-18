"use client"

import { useState, useEffect } from "react"
import { ARCHETYPES, TIER_STYLES, UNLOCK_LADDER, STARTER_ARCHETYPES, type ArchetypeId } from "@/lib/archetypes"
import { cn } from "@/lib/utils"
import { Check, Lock, Loader2, ChevronDown, Users } from "lucide-react"
import Link from "next/link"

interface RosterUnlock {
  archetype: string
  tier: string
  triggerMetric: string
  triggerValue: string | null
  unlockedAt: string
}

interface AgentSummary {
  id: string
  name: string
  role: string
  archetype: string | null
  level: number
  currentForm: string | null
  tier: string
}

export default function RosterPage() {
  const [unlocks, setUnlocks] = useState<RosterUnlock[]>([])
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedArchetype, setExpandedArchetype] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/roster-unlocks").then(r => r.json()).then(d => Array.isArray(d) ? d : []),
      fetch("/api/agents").then(r => r.json()).then(d => Array.isArray(d) ? d : d.agents || []),
    ]).then(([u, a]) => {
      setUnlocks(u)
      setAgents(a)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading roster...
      </div>
    )
  }

  const unlockedArchetypes = new Set<string>([...STARTER_ARCHETYPES, ...unlocks.map(u => u.archetype)])
  const unlockedCount = unlockedArchetypes.size
  const totalCount = Object.keys(ARCHETYPES).length
  const archetypeList = Object.values(ARCHETYPES)

  // Count agents per archetype
  const agentsByArchetype: Record<string, AgentSummary[]> = {}
  for (const agent of agents) {
    const arch = agent.archetype || "unknown"
    if (!agentsByArchetype[arch]) agentsByArchetype[arch] = []
    agentsByArchetype[arch].push(agent)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agent Roster</h1>
          <p className="text-sm text-gray-400 mt-1">
            Your team of specialized agents. Each archetype brings unique skills to your business.
          </p>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-300">{agents.length} agents hired</span>
            </div>
            <span className="text-gray-600">·</span>
            <span className="text-sm text-gray-400">{unlockedCount} of {totalCount} roles available</span>
            <div className="flex-1 max-w-[120px] h-1.5 rounded-full bg-[#16213e] overflow-hidden">
              <div className="h-full bg-[#635bff] rounded-full transition-all" style={{ width: `${(unlockedCount / totalCount) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Available Roles */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-gray-500 font-semibold mb-3">Available Roles</p>
          <div className="grid gap-3 md:grid-cols-2">
            {archetypeList.filter(a => unlockedArchetypes.has(a.id)).map(arch => {
              const archAgents = agentsByArchetype[arch.id] || []
              const isExpanded = expandedArchetype === arch.id

              return (
                <div key={arch.id} className="stripe-card-sm">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#635bff]/10 flex items-center justify-center text-xl shrink-0">
                      {arch.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-white">{arch.label}</h3>
                          <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Available</span>
                        </div>
                        {archAgents.length > 0 && (
                          <span className="text-[12px] text-gray-400">{archAgents.length} hired</span>
                        )}
                      </div>
                      <p className="text-[13px] text-gray-400 mt-0.5">{arch.description}</p>
                    </div>
                  </div>

                  {/* Hired agents */}
                  {archAgents.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                      <div className="flex flex-wrap gap-2">
                        {archAgents.map(agent => (
                          <span key={agent.id} className="text-[12px] px-2.5 py-1 rounded-lg bg-[#16213e] text-gray-300">
                            {agent.name} · Lv.{agent.level}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evolution forms toggle */}
                  <button
                    onClick={() => setExpandedArchetype(isExpanded ? null : arch.id)}
                    className="mt-3 flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                    Evolution path ({arch.forms.length} levels)
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-1">
                      {arch.forms.map((form, i) => {
                        const tierStyle = TIER_STYLES[form.tier]
                        return (
                          <div key={form.name} className="flex items-center justify-between rounded-lg bg-[#16213e]/50 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-gray-500 w-4">{i + 1}</span>
                              <span className="text-[13px] font-medium text-gray-200">{form.name}</span>
                              <span className={cn("text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded", tierStyle.bg, tierStyle.text)}>
                                {tierStyle.label}
                              </span>
                            </div>
                            {form.thresholds.length > 0 && (
                              <span className="text-[11px] text-gray-500">
                                {form.thresholds.map(t => `${t.value} ${t.metric.replace(/_/g, " ")}`).join(", ")}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Hire button */}
                  <Link
                    href={`/builder?archetype=${arch.id}`}
                    className="mt-3 inline-flex items-center justify-center w-full h-9 rounded-lg btn-primary text-[13px] font-medium"
                  >
                    Hire {arch.label}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>

        {/* Locked Roles */}
        {archetypeList.filter(a => !unlockedArchetypes.has(a.id)).length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-gray-500 font-semibold mb-3">Unlock More Roles</p>
            <p className="text-[13px] text-gray-500 mb-4">Hit business milestones to unlock new agent specializations.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {archetypeList.filter(a => !unlockedArchetypes.has(a.id)).map(arch => {
                const ladderEntry = UNLOCK_LADDER.find(u => u.archetype === arch.id)

                return (
                  <div key={arch.id} className="rounded-xl border border-[rgba(255,255,255,0.04)] bg-[#1a1a2e]/50 p-5 opacity-70">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[#16213e]/50 flex items-center justify-center text-xl shrink-0 opacity-50">
                        {arch.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-gray-300">{arch.label}</h3>
                          <Lock className="h-3.5 w-3.5 text-gray-600" />
                        </div>
                        <p className="text-[13px] text-gray-500 mt-0.5">{arch.description}</p>
                      </div>
                    </div>

                    {ladderEntry && (
                      <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
                        <p className="text-[12px] text-gray-500">
                          Unlocks when: <span className="text-gray-300 font-medium">{ladderEntry.trigger.label}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
