"use client"

import { useState } from "react"
import { Pause, Play, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

export function BulkAgentActions() {
  const [acting, setActing] = useState<string | null>(null)

  async function bulkAction(action: "pause" | "resume" | "restart") {
    setActing(action)
    const status = action === "pause" ? "paused" : "idle"
    try {
      const agents = await fetch("/api/agents").then((r) => r.json())
      const targets = action === "resume"
        ? agents.filter((a: any) => a.status === "paused")
        : action === "pause"
        ? agents.filter((a: any) => a.status === "working" || a.status === "idle")
        : agents

      await Promise.all(
        targets.map((a: any) =>
          fetch(`/api/agents/${a.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
        )
      )
      // Reload to reflect changes
      window.location.reload()
    } catch { /* silent */ }
    setActing(null)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => bulkAction("pause")}
        disabled={!!acting}
        className={cn("h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-1 transition-colors", acting === "pause" && "opacity-50")}
        title="Pause all agents"
      >
        <Pause className="h-3 w-3" />Pause All
      </button>
      <button
        onClick={() => bulkAction("resume")}
        disabled={!!acting}
        className={cn("h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-1 transition-colors", acting === "resume" && "opacity-50")}
        title="Resume all paused agents"
      >
        <Play className="h-3 w-3" />Resume All
      </button>
    </div>
  )
}
