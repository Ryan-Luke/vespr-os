"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ChevronDown, MessageSquare, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PixelAvatar } from "@/components/pixel-avatar"

interface AgentThread {
  id: string
  type: string
  subject: string
  initiatorAgentId: string
  participantAgentIds: string[]
  linkedTaskId: string | null
  status: string
  resolution: string | null
  metadata: Record<string, unknown>
  createdAt: string
  resolvedAt: string | null
}

interface ThreadMessage {
  id: string
  threadId: string
  senderAgentId: string
  content: string
  messageType: string
  referencedArtifactIds: string[]
  metadata: Record<string, unknown>
  createdAt: string
  senderName: string | null
  senderAvatar: string | null
  senderPixelAvatarIndex: number | null
}

interface AgentInfo {
  id: string
  name: string
  avatar: string
  pixelAvatarIndex: number
}

const TYPE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  coordination: { label: "Coordination", bg: "bg-[#635bff]/15", text: "text-[#635bff]" },
  negotiation: { label: "Negotiation", bg: "bg-violet-500/15", text: "text-violet-400" },
  review: { label: "Review", bg: "bg-blue-500/15", text: "text-blue-400" },
  escalation: { label: "Escalation", bg: "bg-amber-500/15", text: "text-amber-400" },
}

const MSG_TYPE_BADGES: Record<string, { label: string; color: string }> = {
  message: { label: "Message", color: "text-[#9ca3af]" },
  proposal: { label: "Proposal", color: "text-[#635bff]" },
  approval: { label: "Approved", color: "text-emerald-400" },
  rejection: { label: "Rejected", color: "text-red-400" },
  question: { label: "Question", color: "text-blue-400" },
  deliverable: { label: "Deliverable", color: "text-violet-400" },
  status_update: { label: "Update", color: "text-amber-400" },
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

interface AgentThreadViewerProps {
  maxThreads?: number
  statusFilter?: string
}

export function AgentThreadViewer({ maxThreads = 20, statusFilter = "active" }: AgentThreadViewerProps) {
  const [threads, setThreads] = useState<AgentThread[]>([])
  const [agents, setAgents] = useState<Map<string, AgentInfo>>(new Map())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Map<string, ThreadMessage[]>>(new Map())
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchThreads = useCallback(async () => {
    try {
      const [thRes, agRes] = await Promise.all([
        fetch(`/api/agent-threads?status=${statusFilter}&limit=${maxThreads}`),
        fetch("/api/agents"),
      ])
      if (thRes.ok) {
        const data = await thRes.json()
        setThreads(data.threads ?? [])
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
  }, [statusFilter, maxThreads])

  useEffect(() => {
    fetchThreads()
    const interval = setInterval(fetchThreads, 15000)
    return () => clearInterval(interval)
  }, [fetchThreads])

  async function toggleThread(threadId: string) {
    if (expandedId === threadId) {
      setExpandedId(null)
      return
    }
    setExpandedId(threadId)
    if (!messages.has(threadId)) {
      setLoadingMessages(threadId)
      try {
        const res = await fetch(`/api/agent-threads/${threadId}/messages`)
        if (res.ok) {
          const data = await res.json()
          setMessages((prev) => new Map(prev).set(threadId, data.messages ?? []))
        }
      } catch {
        /* silent */
      } finally {
        setLoadingMessages(null)
      }
    }
  }

  const getAgent = (id: string) => agents.get(id)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-[#635bff]" />
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="py-8 text-center">
        <MessageSquare className="h-5 w-5 text-[#6b7280] mx-auto mb-2" />
        <p className="text-[13px] text-[#6b7280]">No active threads</p>
        <p className="text-[11px] text-[rgba(255,255,255,0.35)] mt-1">
          Agent conversations will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 max-h-[520px] overflow-y-auto">
      {threads.map((thread) => {
        const isExpanded = expandedId === thread.id
        const initiator = getAgent(thread.initiatorAgentId)
        const participants = thread.participantAgentIds
          .map((id) => getAgent(id))
          .filter(Boolean) as AgentInfo[]
        const typeBadge = TYPE_BADGES[thread.type] ?? TYPE_BADGES.coordination
        const threadMessages = messages.get(thread.id) ?? []
        const isLoadingThis = loadingMessages === thread.id

        return (
          <div
            key={thread.id}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#16213e] transition-all"
          >
            {/* Thread Header */}
            <button
              onClick={() => toggleThread(thread.id)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/[0.02] transition-colors rounded-xl"
            >
              {/* Agent avatars */}
              <div className="flex -space-x-1.5 shrink-0">
                {initiator && (
                  <PixelAvatar
                    characterIndex={initiator.pixelAvatarIndex}
                    size={20}
                    className="rounded-full ring-1 ring-[#16213e]"
                  />
                )}
                {participants.slice(0, 2).map((p) => (
                  <PixelAvatar
                    key={p.id}
                    characterIndex={p.pixelAvatarIndex}
                    size={20}
                    className="rounded-full ring-1 ring-[#16213e]"
                  />
                ))}
              </div>

              {/* Subject + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{thread.subject}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      typeBadge.bg,
                      typeBadge.text,
                    )}
                  >
                    {typeBadge.label}
                  </span>
                  <span className="text-[10px] text-[rgba(255,255,255,0.35)]">
                    {relativeTime(thread.createdAt)}
                  </span>
                </div>
              </div>

              {/* Status dot + chevron */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    thread.status === "active" ? "bg-emerald-400" :
                    thread.status === "escalated" ? "bg-amber-400" :
                    "bg-[#6b7280]",
                  )}
                />
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-[#6b7280] transition-transform",
                    isExpanded && "rotate-180",
                  )}
                />
              </div>
            </button>

            {/* Expanded Messages */}
            {isExpanded && (
              <div className="border-t border-[rgba(255,255,255,0.06)] px-3 pb-3">
                {isLoadingThis ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#635bff]" />
                  </div>
                ) : threadMessages.length === 0 ? (
                  <p className="text-[12px] text-[#6b7280] py-3 text-center">No messages yet</p>
                ) : (
                  <div className="space-y-2.5 pt-3">
                    {threadMessages.map((msg) => {
                      const sender = getAgent(msg.senderAgentId)
                      const msgBadge = MSG_TYPE_BADGES[msg.messageType] ?? MSG_TYPE_BADGES.message

                      return (
                        <div key={msg.id} className="flex gap-2.5">
                          {/* Sender avatar */}
                          <div className="shrink-0 pt-0.5">
                            {(sender ?? msg.senderPixelAvatarIndex != null) ? (
                              <PixelAvatar
                                characterIndex={sender?.pixelAvatarIndex ?? msg.senderPixelAvatarIndex ?? 0}
                                size={18}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="h-[18px] w-[18px] rounded-full bg-[#635bff]/20 flex items-center justify-center text-[8px] font-bold text-[#635bff]">
                                {(msg.senderName ?? "A").charAt(0)}
                              </div>
                            )}
                          </div>

                          {/* Message content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[12px] font-medium text-[rgba(255,255,255,0.7)]">
                                {sender?.name ?? msg.senderName ?? "Agent"}
                              </span>
                              {msg.messageType !== "message" && (
                                <span className={cn("text-[9px] font-semibold uppercase tracking-wider", msgBadge.color)}>
                                  {msgBadge.label}
                                </span>
                              )}
                              <span className="text-[10px] text-[rgba(255,255,255,0.25)] tabular-nums ml-auto">
                                {relativeTime(msg.createdAt)}
                              </span>
                            </div>
                            <p className="text-[12px] text-[rgba(255,255,255,0.55)] leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Resolution */}
                {thread.resolution && (
                  <div className="mt-3 pt-2.5 border-t border-[rgba(255,255,255,0.06)]">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-1">Resolution</p>
                    <p className="text-[12px] text-[rgba(255,255,255,0.55)]">{thread.resolution}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
