import { cn } from "@/lib/utils"
import type { AgentStatus } from "@/lib/types"

const statusColors: Record<AgentStatus, string> = {
  working: "bg-green-500",
  idle: "bg-zinc-400",
  error: "bg-red-500",
  paused: "bg-yellow-500",
}

const statusLabels: Record<AgentStatus, string> = {
  working: "Working",
  idle: "Idle",
  error: "Error",
  paused: "Paused",
}

export function StatusDot({ status, showLabel = false }: { status: AgentStatus; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", statusColors[status])} />
      {showLabel && (
        <span className="text-xs text-muted-foreground capitalize">{statusLabels[status]}</span>
      )}
    </span>
  )
}
