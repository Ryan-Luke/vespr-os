import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { automations, agents } from "@/lib/mock-data"
import {
  Zap,
  Clock,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  Calendar,
  RotateCcw,
  Plus,
} from "lucide-react"

function formatDate(date: Date) {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function cronToHuman(cron: string): string {
  const parts = cron.split(" ")
  if (cron === "0 9 1 * *") return "Monthly, 1st at 9 AM"
  if (cron === "0 */4 * * *") return "Every 4 hours"
  if (cron === "0 8 * * *") return "Daily at 8 AM"
  if (cron === "0 10,14,18 * * 1-5") return "Weekdays at 10 AM, 2 PM, 6 PM"
  if (cron === "0 7 * * 1") return "Weekly, Monday at 7 AM"
  if (cron === "0 6 * * *") return "Daily at 6 AM"
  return cron
}

export default function AutomationsPage() {
  const activeCount = automations.filter((a) => a.status === "active").length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
          <p className="text-sm text-muted-foreground">
            Recurring workflows managed by Nyx, your Automation Architect
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Automation
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold mt-1">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Runs</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {automations.reduce((sum, a) => sum + a.runCount, 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Pause className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Paused</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {automations.filter((a) => a.status === "paused").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Automation List */}
      <div className="space-y-3">
        {automations.map((automation) => {
          const managedBy = agents.find((a) => a.id === automation.managedByAgentId)

          return (
            <Card key={automation.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{automation.name}</h3>
                      <Badge
                        variant={
                          automation.status === "active"
                            ? "default"
                            : automation.status === "paused"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {automation.status === "active" && (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {automation.status === "paused" && (
                          <Pause className="h-3 w-3 mr-1" />
                        )}
                        {automation.status === "error" && (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        )}
                        {automation.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {automation.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                  >
                    {automation.status === "active" ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-6 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {cronToHuman(automation.schedule)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last: {automation.lastRun ? formatDate(automation.lastRun) : "Never"}
                  </div>
                  <div className="flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />
                    {automation.runCount} runs
                  </div>
                  {managedBy && (
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Managed by {managedBy.name}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
