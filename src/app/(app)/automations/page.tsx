import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PixelAvatar } from "@/components/pixel-avatar"
import { db } from "@/lib/db"
import { automations as automationsTable, agents as agentsTable } from "@/lib/db/schema"
import {
  Zap, Clock, Play, Pause, AlertCircle, CheckCircle2,
  Calendar, RotateCcw, Plus,
} from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

function cronToHuman(cron: string): string {
  const map: Record<string, string> = {
    "0 9 1 * *": "Monthly, 1st at 9 AM",
    "0 */4 * * *": "Every 4 hours",
    "0 8 * * *": "Daily at 8 AM",
    "0 10,14,18 * * 1-5": "Weekdays at 10 AM, 2 PM, 6 PM",
    "0 7 * * 1": "Weekly, Monday at 7 AM",
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
        <Button size="sm" className="h-7 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />New</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-green-500" /><span className="text-sm text-muted-foreground">Active</span></div>
            <p className="text-2xl font-bold mt-1">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Total Runs</span></div>
            <p className="text-2xl font-bold mt-1">{totalRuns.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2"><Pause className="h-4 w-4 text-yellow-500" /><span className="text-sm text-muted-foreground">Paused</span></div>
            <p className="text-2xl font-bold mt-1">{pausedCount}</p>
          </CardContent>
        </Card>
      </div>

      {allAutomations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Zap className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No automations yet</p>
            <p className="text-xs mt-1">Create recurring workflows to automate repetitive tasks</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allAutomations.map((automation) => {
            const managedBy = automation.managedByAgentId ? allAgents.find((a) => a.id === automation.managedByAgentId) : null
            return (
              <Card key={automation.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{automation.name}</h3>
                        <Badge
                          variant={automation.status === "active" ? "default" : automation.status === "paused" ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {automation.status === "active" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {automation.status === "paused" && <Pause className="h-3 w-3 mr-1" />}
                          {automation.status === "error" && <AlertCircle className="h-3 w-3 mr-1" />}
                          {automation.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{automation.description}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      {automation.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex items-center gap-6 mt-4 text-xs text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />{cronToHuman(automation.schedule)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />Last: {automation.lastRunAt ? new Date(automation.lastRunAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}
                    </div>
                    <div className="flex items-center gap-1">
                      <RotateCcw className="h-3 w-3" />{automation.runCount ?? 0} runs
                    </div>
                    {managedBy && (
                      <div className="flex items-center gap-1.5">
                        <PixelAvatar characterIndex={managedBy.pixelAvatarIndex} size={16} className="rounded" />
                        {managedBy.name}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
