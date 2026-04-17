"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { PixelAvatar } from "@/components/pixel-avatar"
import { PixelOfficeViewer } from "@/components/pixel-office-viewer"
import type { Agent, AgentStatus } from "@/lib/types"
import { levelTitle } from "@/lib/gamification"
import { PERSONALITY_PRESETS } from "@/lib/personality-presets"
import { X, MessageSquare, Pause, Play, Loader2, Crown } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function OfficePage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then((data) => {
      setAgents(data)
      setLoading(false)
    })
  }, [])

  function handleAgentClick(agentId: string) {
    const agent = agents.find((a) => a.id === agentId)
    if (agent) setSelectedAgent(agent)
  }

  async function togglePause(agent: Agent) {
    const newStatus = agent.status === "paused" ? "idle" : "paused"
    await fetch(`/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, status: newStatus as AgentStatus } : a))
    setSelectedAgent((prev) => prev?.id === agent.id ? { ...prev, status: newStatus as AgentStatus } : prev)
  }

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading office...</div>

  const workingCount = agents.filter((a) => a.status === "working").length
  const preset = selectedAgent?.personalityPresetId ? PERSONALITY_PRESETS.find((p) => p.id === selectedAgent.personalityPresetId) : null

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Office</h1>
            <p className="text-xs text-muted-foreground">
              Click agents to see details. Scroll to pan, Ctrl+scroll to zoom.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              {workingCount}/{agents.length} active
            </Badge>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <PixelOfficeViewer agents={agents as any} onAgentClick={handleAgentClick} />
        </div>
      </div>

      {selectedAgent && (
        <div className="w-64 shrink-0 border-l border-border overflow-y-auto bg-[#0f0f23]">
          <div className="flex items-center justify-between h-12 px-3 border-b border-border">
            <span className="text-[13px] font-medium">Details</span>
            <button className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent" onClick={() => setSelectedAgent(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
          </div>

          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2.5">
              <PixelAvatar characterIndex={selectedAgent.pixelAvatarIndex} size={28} className="rounded-sm" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold">{selectedAgent.name}</span>
                  {selectedAgent.isTeamLead && <Crown className="h-3 w-3 text-amber-500" />}
                  <span className={cn("h-1.5 w-1.5 rounded-full", selectedAgent.status === "working" ? "status-working" : selectedAgent.status === "error" ? "status-error" : selectedAgent.status === "paused" ? "status-paused" : "status-idle")} />
                </div>
                <p className="text-[11px] text-muted-foreground">{selectedAgent.role} · Lv.{selectedAgent.level ?? 1}</p>
              </div>
            </div>

            {preset && (
              <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">{preset.name}</span> — {preset.description}</p>
            )}

            {selectedAgent.currentTask && (
              <div className="bg-muted/50 rounded-md px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">Working on</p>
                <p className="text-xs mt-0.5">{selectedAgent.currentTask}</p>
              </div>
            )}

            <div className="space-y-1.5">
              {[
                { label: "Model", value: selectedAgent.model },
                { label: "Tasks", value: (selectedAgent.tasksCompleted ?? 0).toLocaleString() },
                { label: "Cost/mo", value: `$${(selectedAgent.costThisMonth ?? 0).toFixed(2)}` },
                { label: "Autonomy", value: selectedAgent.autonomyLevel === "full_auto" ? "Full Auto" : selectedAgent.autonomyLevel === "supervised" ? "Supervised" : "Manual" },
              ].map((s) => (
                <div key={s.label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1">
              {(selectedAgent.skills as string[]).map((skill) => (
                <span key={skill} className="text-[11px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{skill}</span>
              ))}
            </div>

            <div className="flex gap-1.5 pt-1 border-t border-border">
              <Link href="/" className="flex-1 h-7 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center gap-1 transition-colors">
                <MessageSquare className="h-3 w-3" />Chat
              </Link>
              <button onClick={() => togglePause(selectedAgent)} className="flex-1 h-7 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center gap-1 transition-colors">
                {selectedAgent.status === "paused" ? <><Play className="h-3 w-3" />Resume</> : <><Pause className="h-3 w-3" />Pause</>}
              </button>
            </div>
            <Link href={selectedAgent.teamId ? `/teams/${selectedAgent.teamId}/agents/${selectedAgent.id}` : `/roster`} className="block text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors">Full Profile</Link>
          </div>
        </div>
      )}
    </div>
  )
}
