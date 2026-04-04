"use client"

import { useState, useEffect } from "react"
import { Target, Plus, Check, X, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface CompanyGoal {
  id: string
  title: string
  target: number
  current: number
  unit: string
  category: string
}

const DEFAULT_GOALS: CompanyGoal[] = [
  { id: "revenue", title: "Monthly Revenue", target: 50000, current: 32400, unit: "$", category: "finance" },
  { id: "tasks", title: "Tasks Completed", target: 500, current: 347, unit: "", category: "ops" },
  { id: "customers", title: "Active Customers", target: 200, current: 156, unit: "", category: "growth" },
  { id: "nps", title: "Customer NPS", target: 80, current: 72, unit: "", category: "quality" },
]

export function GoalTracker() {
  const [goals, setGoals] = useState<CompanyGoal[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("bos-company-goals")
    if (stored) {
      try { setGoals(JSON.parse(stored)) } catch { setGoals(DEFAULT_GOALS) }
    } else {
      setGoals(DEFAULT_GOALS)
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) localStorage.setItem("bos-company-goals", JSON.stringify(goals))
  }, [goals, loaded])

  if (!loaded) return null

  // Overall company progress
  const overallPct = goals.length > 0
    ? Math.round(goals.reduce((sum, g) => sum + Math.min(100, (g.current / g.target) * 100), 0) / goals.length)
    : 0

  return (
    <div className="bg-card border border-border rounded-md">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-4 py-3 flex items-center gap-3">
        <Target className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Company Goals</span>
            <span className="text-xs text-muted-foreground tabular-nums">{overallPct}%</span>
          </div>
          <div className="h-1 rounded-full bg-border overflow-hidden mt-1.5">
            <div className={cn("h-full rounded-full transition-all", overallPct >= 70 ? "bg-emerald-500/60" : overallPct >= 40 ? "bg-amber-500/60" : "bg-red-500/60")} style={{ width: `${overallPct}%` }} />
          </div>
        </div>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform shrink-0", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2.5">
          {goals.map((goal) => {
            const pct = Math.min(100, Math.round((goal.current / goal.target) * 100))
            return (
              <div key={goal.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{goal.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {goal.unit === "$" ? `$${goal.current.toLocaleString()}` : goal.current.toLocaleString()} / {goal.unit === "$" ? `$${goal.target.toLocaleString()}` : goal.target.toLocaleString()}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-border overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", pct >= 70 ? "bg-emerald-500/50" : pct >= 40 ? "bg-amber-500/50" : "bg-red-500/50")} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
