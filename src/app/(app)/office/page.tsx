"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/status-dot"
import { PixelOfficeViewer } from "@/components/pixel-office-viewer"
import { agents } from "@/lib/mock-data"
import type { Agent } from "@/lib/types"
import { X, MessageSquare, Pause, Play } from "lucide-react"

export default function OfficePage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  function handleAgentClick(agentId: string) {
    const agent = agents.find((a) => a.id === agentId)
    if (agent) setSelectedAgent(agent)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Pixel Office Canvas */}
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
              {agents.filter((a) => a.status === "working").length}/{agents.length} active
            </Badge>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <PixelOfficeViewer agents={agents} onAgentClick={handleAgentClick} />
        </div>
      </div>

      {/* Selected Agent Panel */}
      {selectedAgent && (
        <div className="w-72 shrink-0 border-l border-border p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Agent Details</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setSelectedAgent(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary">
                {selectedAgent.avatar}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{selectedAgent.name}</p>
              <p className="text-xs text-muted-foreground">{selectedAgent.role}</p>
            </div>
          </div>

          <StatusDot status={selectedAgent.status} showLabel />

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
              <span className="font-mono text-xs">{selectedAgent.tasksCompleted}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cost (month)</span>
              <span className="font-mono text-xs">${selectedAgent.costThisMonth}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selectedAgent.skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <MessageSquare className="h-3 w-3 mr-1" />
              Chat
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              {selectedAgent.status === "paused" ? (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3 mr-1" />
                  Pause
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
