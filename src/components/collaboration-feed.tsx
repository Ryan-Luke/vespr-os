"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ArrowRightLeft, MessageSquare, AlertTriangle, Share2,
  CheckCircle2, Lock, Unlock, ArrowUpRight, HelpCircle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"

interface CollaborationEvent {
  id: string
  eventType: string
  sourceAgentId: string | null
  targetAgentId: string | null
  taskId: string | null
  threadId: string | null
  summary: string
  metadata: Record<string, unknown>
  createdAt: string
}

// Map agent IDs to names — fetched alongside events
interface AgentInfo {
  id: string
  name: string
  avatar: string
}

const EVENT_CONFIG: Record<string, { icon: typeof ArrowRightLeft; color: string; label: string }> = {
  task_delegated: { icon: ArrowRightLeft, color: "text-[#635bff]", label: "Delegated" },
  task_claimed: { icon: CheckCircle2, color: "text-[#635bff]", label: "Claimed" },
  agent_consulted: { icon: MessageSquare, color: "text-blue-400", label: "Consulted" },
  handoff_sent: { icon: ArrowUpRight, color: "text-[#635bff]", label: "Handoff" },
  handoff_received: { icon: ArrowUpRight, color: "text-[#635bff]", label: "Received" },
  artifact_shared: { icon: Share2, color: "text-violet-400", label: "Shared" },
  decision_made: { icon: CheckCircle2, color: "text-emerald-400", label: "Decision" },
  help_requested: { icon: HelpCircle, color: "text-blue-400", label: "Help" },
  status_updated: { icon: CheckCircle2, color: "text-[#9ca3af]", label: "Updated" },
  escalated: { icon: AlertTriangle, color: "text-amber-400", label: "Escalated" },
  blocked: { icon: Lock, color: "text-red-400", label: "Blocked" },
  unblocked: { icon: Unlock, color: "text-emerald-400", label: "Unblocked" },
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return "now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

interface CollaborationFeedProps {
  limit?: number
  compact?: boolean
}

export function CollaborationFeed({ limit = 20, compact = false }: CollaborationFeedProps) {
  const [events, setEvents] = useState<CollaborationEvent[]>([])
  const [agents, setAgents] = useState<Map<string, AgentInfo>>(new Map())
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [evRes, agRes] = await Promise.all([
        fetch(`/api/collaboration?limit=${limit}`),
        fetch("/api/agents"),
      ])
      if (evRes.ok) {
        const data = await evRes.json()
        setEvents(data.events ?? [])
      }
      if (agRes.ok) {
        const agData = await agRes.json()
        const list: AgentInfo[] = Array.isArray(agData) ? agData : agData.agents ?? []
        const map = new Map<string, AgentInfo>()
        list.forEach((a) => map.set(a.id, a))
        setAgents(map)
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  const agentName = (id: string | null) => {
    if (!id) return "System"
    return agents.get(id)?.name ?? "Agent"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-[#635bff]" />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] text-[#6b7280]">No collaboration events yet</p>
        <p className="text-[11px] text-[rgba(255,255,255,0.35)] mt-1">
          Events appear when agents delegate, consult, or hand off work
        </p>
      </div>
    )
  }

  const maxHeight = compact ? "max-h-[320px]" : "max-h-[480px]"

  return (
    <TooltipProvider>
      <div className={cn("overflow-y-auto divide-y divide-[rgba(255,255,255,0.04)]", maxHeight)}>
        {events.map((event) => {
          const config = EVENT_CONFIG[event.eventType] ?? {
            icon: MessageSquare,
            color: "text-[#9ca3af]",
            label: event.eventType,
          }
          const Icon = config.icon
          const source = agentName(event.sourceAgentId)
          const target = agentName(event.targetAgentId)
          const hasTarget = event.targetAgentId && event.targetAgentId !== event.sourceAgentId

          return (
            <Tooltip key={event.id}>
              <TooltipTrigger
                className="flex items-center gap-2.5 py-2.5 px-1 w-full text-left hover:bg-white/[0.02] transition-colors rounded-md"
              >
                <Icon className={cn("h-[18px] w-[18px] shrink-0", config.color)} />
                <span className="flex-1 min-w-0 truncate text-[13px]">
                  <span className="font-medium text-[rgba(255,255,255,0.7)]">{source}</span>
                  {hasTarget && (
                    <>
                      <span className="text-[#6b7280] mx-1">&rarr;</span>
                      <span className="font-medium text-[rgba(255,255,255,0.7)]">{target}</span>
                    </>
                  )}
                  <span className="text-[#6b7280]">: </span>
                  <span className="text-[rgba(255,255,255,0.45)]">{event.summary}</span>
                </span>
                <span className="text-[11px] text-[rgba(255,255,255,0.35)] tabular-nums shrink-0">
                  {relativeTime(event.createdAt)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium text-xs">{config.label}</p>
                  <p className="text-xs opacity-80">{event.summary}</p>
                  <p className="text-[10px] opacity-60">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                  {event.taskId && (
                    <p className="text-[10px] opacity-50">Task: {event.taskId.slice(0, 8)}...</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
