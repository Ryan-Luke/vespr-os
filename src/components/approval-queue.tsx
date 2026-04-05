"use client"

import { useState, useEffect, useCallback } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { Check, X, Zap, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ApprovalRequest {
  id: string; agentId: string; agentName: string; actionType: string
  title: string; description: string; urgency: string; status: string; createdAt: string
}

interface DBAgent { id: string; name: string; pixelAvatarIndex: number }

// ── Auto-approve helpers (localStorage-backed) ──

const STORAGE_KEY = "bos-approval-counts"
const AUTO_KEY = "bos-auto-approve"

function getApprovalCounts(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") } catch { return {} }
}

function bumpApprovalCount(agentId: string, actionType: string) {
  const counts = getApprovalCounts()
  const key = `${agentId}:${actionType}`
  counts[key] = (counts[key] || 0) + 1
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
  return counts[key]
}

export function getAutoApproveSettings(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(AUTO_KEY) || "{}") } catch { return {} }
}

export function toggleAutoApproveSetting(agentId: string, actionType: string, enabled: boolean) {
  const settings = getAutoApproveSettings()
  settings[`${agentId}:${actionType}`] = enabled
  localStorage.setItem(AUTO_KEY, JSON.stringify(settings))
}

function isAutoApproved(agentId: string, actionType: string) {
  return getAutoApproveSettings()[`${agentId}:${actionType}`] === true
}

// ── Component ──

export function ApprovalQueue() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [agents, setAgents] = useState<DBAgent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showPrompt, setShowPrompt] = useState<Record<string, number>>({})
  const [autoCountdown, setAutoCountdown] = useState<Record<string, number>>({})

  useEffect(() => {
    const wsId = typeof window !== "undefined" ? localStorage.getItem("vespr-active-workspace") : null
    const chatUrl = wsId ? `/api/chat-data?workspaceId=${wsId}` : "/api/chat-data"
    Promise.all([
      fetch("/api/approval-requests?status=pending").then((r) => r.json()),
      fetch(chatUrl).then((r) => r.json()),
    ]).then(([reqs, chatData]) => {
      setRequests(Array.isArray(reqs) ? reqs : [])
      setAgents(chatData.agents)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // Auto-approve countdown timers
  useEffect(() => {
    if (!loaded) return
    const autoReqs = requests.filter((r) => isAutoApproved(r.agentId, r.actionType))
    if (autoReqs.length === 0) return

    // Start 3-second countdown for auto-approvable items
    const initial: Record<string, number> = {}
    autoReqs.forEach((r) => { if (autoCountdown[r.id] === undefined) initial[r.id] = 3 })
    if (Object.keys(initial).length > 0) {
      setAutoCountdown((prev) => ({ ...prev, ...initial }))
    }

    const interval = setInterval(() => {
      setAutoCountdown((prev) => {
        const next = { ...prev }
        let changed = false
        for (const id of Object.keys(next)) {
          if (next[id] > 0) { next[id]--; changed = true }
          if (next[id] === 0) {
            resolve(id, "approved")
            delete next[id]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, requests])

  const resolve = useCallback(async (id: string, status: "approved" | "rejected") => {
    const req = requests.find((r) => r.id === id)
    await fetch("/api/approval-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    setRequests((prev) => prev.filter((r) => r.id !== id))
    setAutoCountdown((prev) => { const n = { ...prev }; delete n[id]; return n })

    // Track approval count and maybe show auto-approve prompt
    if (status === "approved" && req) {
      const count = bumpApprovalCount(req.agentId, req.actionType)
      if (count >= 5 && !isAutoApproved(req.agentId, req.actionType)) {
        setShowPrompt((prev) => ({ ...prev, [`${req.agentId}:${req.actionType}`]: count }))
      }
    }
  }, [requests])

  function cancelAutoApprove(id: string) {
    setAutoCountdown((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  function enableAutoApprove(agentId: string, actionType: string) {
    toggleAutoApproveSetting(agentId, actionType, true)
    setShowPrompt((prev) => { const n = { ...prev }; delete n[`${agentId}:${actionType}`]; return n })
  }

  function dismissPrompt(agentId: string, actionType: string) {
    setShowPrompt((prev) => { const n = { ...prev }; delete n[`${agentId}:${actionType}`]; return n })
  }

  if (!loaded || requests.length === 0) return null

  // Collect unique prompts to show
  const activePrompts = Object.entries(showPrompt)

  return (
    <div className="bg-card border border-border rounded-md">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <p className="section-label">Needs Approval</p>
        <span className="h-[18px] min-w-[18px] rounded-full bg-red-500 px-1 text-[10px] font-medium text-white flex items-center justify-center">{requests.length}</span>
      </div>
      <div className="divide-y divide-border">
        {requests.slice(0, 5).map((req) => {
          const agent = agents.find((a) => a.id === req.agentId)
          const isAuto = isAutoApproved(req.agentId, req.actionType)
          const countdown = autoCountdown[req.id]
          return (
            <div key={req.id} className="px-4 py-2.5">
              <div className="flex items-start gap-3">
                {agent && <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded-sm mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-medium">{req.title}</p>
                    {isAuto && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" />Auto</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{req.description}</p>
                </div>
                {countdown !== undefined ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-muted-foreground tabular-nums">{countdown}s</span>
                    <button onClick={() => cancelAutoApprove(req.id)} className="text-[11px] text-primary hover:underline flex items-center gap-0.5"><Undo2 className="h-3 w-3" />Undo</button>
                  </div>
                ) : (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => resolve(req.id, "approved")} className="h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500/20 transition-colors">
                      <Check className="h-3 w-3" />
                    </button>
                    <button onClick={() => resolve(req.id, "rejected")} className="h-6 w-6 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Auto-approve prompts */}
      {activePrompts.map(([key, count]) => {
        const [agentId, actionType] = key.split(":")
        const agent = agents.find((a) => a.id === agentId)
        return (
          <div key={key} className="px-4 py-2 border-t border-border bg-amber-500/5">
            <p className="text-[11px] text-amber-400">
              You&apos;ve approved <span className="font-medium">{actionType.replace("_", " ")}</span> from <span className="font-medium">{agent?.name || "this agent"}</span> {count} times.
            </p>
            <div className="flex gap-2 mt-1">
              <button onClick={() => enableAutoApprove(agentId, actionType)} className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium">Enable auto-approve</button>
              <button onClick={() => dismissPrompt(agentId, actionType)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Dismiss</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
