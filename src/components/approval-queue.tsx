"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PixelAvatar } from "@/components/pixel-avatar"
import { AlertCircle, Check, X, Clock, ChevronRight } from "lucide-react"

interface ApprovalRequest {
  id: string
  agentId: string
  agentName: string
  actionType: string
  title: string
  description: string
  reasoning: string | null
  urgency: string
  status: string
  createdAt: string
}

interface DBAgent {
  id: string; name: string; pixelAvatarIndex: number
}

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
    <Card className="border-amber-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          Needs Your Approval
          <Badge variant="destructive" className="ml-auto text-xs">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.slice(0, 5).map((req) => {
          const agent = agents.find((a) => a.id === req.agentId)
          return (
            <div key={req.id} className="flex items-start gap-3 p-2 rounded-lg border border-border bg-card">
              {agent && <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={28} className="rounded-md border border-border mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{req.title}</span>
                  {req.urgency === "urgent" && <Badge variant="destructive" className="text-xs h-5">Urgent</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{req.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">From {req.agentName}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="default" className="h-7 w-7 p-0" onClick={() => resolve(req.id, "approved")}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => resolve(req.id, "rejected")}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
