"use client"

import { useState, useEffect } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { Check, X } from "lucide-react"

interface ApprovalRequest {
  id: string; agentId: string; agentName: string; actionType: string
  title: string; description: string; urgency: string; status: string; createdAt: string
}

interface DBAgent { id: string; name: string; pixelAvatarIndex: number }

export function ApprovalQueue() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [agents, setAgents] = useState<DBAgent[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/approval-requests?status=pending").then((r) => r.json()),
      fetch("/api/chat-data").then((r) => r.json()),
    ]).then(([reqs, chatData]) => {
      setRequests(Array.isArray(reqs) ? reqs : [])
      setAgents(chatData.agents)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  async function resolve(id: string, status: "approved" | "rejected") {
    await fetch("/api/approval-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  if (!loaded || requests.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-md">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <p className="section-label">Needs Approval</p>
        <span className="h-[18px] min-w-[18px] rounded-full bg-red-500 px-1 text-[10px] font-medium text-white flex items-center justify-center">{requests.length}</span>
      </div>
      <div className="divide-y divide-border">
        {requests.slice(0, 5).map((req) => {
          const agent = agents.find((a) => a.id === req.agentId)
          return (
            <div key={req.id} className="flex items-start gap-3 px-4 py-2.5">
              {agent && <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded-sm mt-0.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium">{req.title}</p>
                <p className="text-xs text-muted-foreground truncate">{req.description}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => resolve(req.id, "approved")} className="h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500/20 transition-colors">
                  <Check className="h-3 w-3" />
                </button>
                <button onClick={() => resolve(req.id, "rejected")} className="h-6 w-6 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
