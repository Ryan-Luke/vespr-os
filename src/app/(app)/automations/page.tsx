import { PixelAvatar } from "@/components/pixel-avatar"
import { db } from "@/lib/db"
import { automations as automationsTable, agents as agentsTable } from "@/lib/db/schema"
import {
  Zap, Clock, Play, Pause, AlertCircle, CheckCircle2,
  Calendar, RotateCcw, Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

function cronToHuman(cron: string): string {
  const map: Record<string, string> = {
    "0 9 1 * *": "Monthly, 1st at 9 AM",
    "0 */4 * * *": "Every 4 hours",
    "0 8 * * *": "Daily at 8 AM",
    "0 10,14,18 * * 1-5": "Weekdays 10/2/6",
    "0 7 * * 1": "Weekly, Mon 7 AM",
    "0 6 * * *": "Daily at 6 AM",
    "0 */2 * * *": "Every 2 hours",
    "0 9 * * 1-5": "Weekdays at 9 AM",
  }
  return map[cron] || cron
}

export default async function AutomationsPage() {
  const [allAutomations, allAgents] = await Promise.all([
    db.select().from(automationsTable),
    db.select().from(agentsTable),
  ])

  const activeCount = allAutomations.filter((a) => a.status === "active").length
  const totalRuns = allAutomations.reduce((sum, a) => sum + (a.runCount ?? 0), 0)
  const pausedCount = allAutomations.filter((a) => a.status === "paused").length

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Automations</h1>
        <button className="h-7 px-2.5 rounded-md text-xs font-medium bg-primary text-primary-foreground flex items-center gap-1 hover:bg-primary/90 transition-colors"><Plus className="h-3 w-3" />New</button>
      </div>

      {/* Stats */}
      <div className="grid gap-px bg-border rounded-md overflow-hidden md:grid-cols-3">
        {[
          { label: "Active", value: activeCount, icon: <Zap className="h-3.5 w-3.5 text-emerald-500" /> },
          { label: "Total Runs", value: totalRuns.toLocaleString(), icon: <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /> },
          { label: "Paused", value: pausedCount, icon: <Pause className="h-3.5 w-3.5 text-amber-500" /> },
        ].map((s) => (
          <div key={s.label} className="bg-card p-4">
            <div className="flex items-center gap-1.5">{s.icon}<span className="section-label">{s.label}</span></div>
            <p className="text-xl font-semibold tabular-nums mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {allAutomations.length === 0 ? (
        <div className="text-center py-12 text-xs text-muted-foreground">No automations yet.</div>
      ) : (
        <div className="bg-card border border-border rounded-md divide-y divide-border">
          {allAutomations.map((automation) => {
            const managedBy = automation.managedByAgentId ? allAgents.find((a) => a.id === automation.managedByAgentId) : null
            return (
              <div key={automation.id} className="px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{automation.name}</span>
                      <span className={cn("h-1.5 w-1.5 rounded-full", automation.status === "active" ? "bg-emerald-500" : automation.status === "paused" ? "bg-amber-500" : "bg-red-500")} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{automation.description}</p>
                  </div>
                  <button className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors shrink-0">
                    {automation.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </button>
                </div>
                <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{cronToHuman(automation.schedule)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{automation.lastRunAt ? new Date(automation.lastRunAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "Never"}</span>
                  <span className="tabular-nums">{automation.runCount ?? 0} runs</span>
                  {managedBy && (
                    <span className="flex items-center gap-1">
                      <PixelAvatar characterIndex={managedBy.pixelAvatarIndex} size={12} className="rounded-sm" />
                      {managedBy.name}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
