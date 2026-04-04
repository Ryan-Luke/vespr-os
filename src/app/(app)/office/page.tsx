"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/status-dot"
import { PixelAvatar } from "@/components/pixel-avatar"
import { PixelOfficeViewer } from "@/components/pixel-office-viewer"
import type { Agent, AgentStatus } from "@/lib/types"
import { levelTitle } from "@/lib/gamification"
import { PERSONALITY_PRESETS } from "@/lib/personality-presets"
import { X, MessageSquare, Pause, Play, Loader2, Crown, Sparkles } from "lucide-react"
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
        <div className="w-80 shrink-0 border-l border-border p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Agent Details</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedAgent(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <PixelAvatar characterIndex={selectedAgent.pixelAvatarIndex} size={48} className="rounded-md border border-border" />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{selectedAgent.name}</p>
                {selectedAgent.isTeamLead && <Crown className="h-3 w-3 text-amber-400" />}
              </div>
              <p className="text-xs text-muted-foreground">{selectedAgent.role}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusDot status={selectedAgent.status} showLabel />
                {(selectedAgent.level ?? 0) > 0 && (
                  <span className="text-xs font-mono text-muted-foreground">Lv.{selectedAgent.level} {levelTitle(selectedAgent.level ?? 1)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Personality */}
          {(preset || selectedAgent.personalityPresetId) && (
            <div className="p-2.5 rounded-md bg-muted border border-border">
              <div className="flex items-center gap-1.5 text-xs">
                <Sparkles className="h-3 w-3 text-muted-foreground" />
                {preset ? (
                  <span><span className="font-medium">{preset.name}</span> <span className="text-muted-foreground">— {preset.description}</span></span>
                ) : (
                  <span className="text-muted-foreground">Custom personality</span>
                )}
              </div>
            </div>
          )}

          {selectedAgent.currentTask && (
            <Card className="p-3">
              <p className="text-xs text-muted-foreground mb-1">Current Task</p>
              <p className="text-sm">{selectedAgent.currentTask}</p>
            </Card>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Model</span>
              <span className="font-mono text-xs">{selectedAgent.model}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tasks Done</span>
              <span className="font-mono text-xs">{(selectedAgent.tasksCompleted ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cost/mo</span>
              <span className="font-mono text-xs">${(selectedAgent.costThisMonth ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Autonomy</span>
              <Badge variant="secondary" className={cn("text-xs h-5", selectedAgent.autonomyLevel === "full_auto" && "bg-green-500/10 text-green-600")}>
                {selectedAgent.autonomyLevel === "full_auto" ? "Full Auto" : selectedAgent.autonomyLevel === "supervised" ? "Supervised" : "Manual"}
              </Badge>
            </div>
            {(selectedAgent.streak ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Streak</span>
                <span className="text-xs text-orange-500">🔥 {selectedAgent.streak}d</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(selectedAgent.skills as string[]).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Link href="/" className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                <MessageSquare className="h-3 w-3 mr-1" />Chat
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => togglePause(selectedAgent)}>
              {selectedAgent.status === "paused" ? <><Play className="h-3 w-3 mr-1" />Resume</> : <><Pause className="h-3 w-3 mr-1" />Pause</>}
            </Button>
          </div>
          <Link href={`/teams/${selectedAgent.teamId}/agents/${selectedAgent.id}`}>
            <Button variant="outline" size="sm" className="w-full text-xs">View Full Profile</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
