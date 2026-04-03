"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PixelAvatar } from "@/components/pixel-avatar"
import { StatusDot } from "@/components/status-dot"
import type { Agent } from "@/lib/types"
import { MessageSquare, Clock, DollarSign, Brain } from "lucide-react"
import Link from "next/link"

export function AgentProfileCard({
  agent,
  children,
  onDM,
}: {
  agent: Agent
  children: React.ReactNode
  onDM?: (agent: Agent) => void
}) {
  return (
    <Popover>
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

          {/* Current Task */}
          {agent.currentTask && (
            <div className="mt-3 p-2 rounded-md bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Working on</p>
              <p className="text-xs">{agent.currentTask}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-3">
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
