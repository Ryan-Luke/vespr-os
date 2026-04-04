"use client"

import { useState, useEffect } from "react"
import { TrendingUp, DollarSign, Clock, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function ROICalculator() {
  const [agents, setAgents] = useState<any[]>([])
  const [hourlyRate, setHourlyRate] = useState(50)
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("bos-hourly-rate")
    if (stored) setHourlyRate(Number(stored))
    fetch("/api/agents").then((r) => r.json()).then((data) => {
      setAgents(Array.isArray(data) ? data : [])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  if (!loaded || agents.length === 0) return null

  const totalTasks = agents.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0)
  const totalCost = agents.reduce((sum, a) => sum + (a.costThisMonth ?? 0), 0)
  const hoursPerTask = 0.15 // estimated hours saved per task
  const hoursSaved = Math.round(totalTasks * hoursPerTask)
  const valueSaved = hoursSaved * hourlyRate
  const roi = totalCost > 0 ? Math.round(((valueSaved - totalCost) / totalCost) * 100) : 0

  return (
    <div className="bg-card border border-border rounded-md">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-4 py-3 flex items-center gap-3">
        <TrendingUp className="h-4 w-4 text-emerald-500/70 shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">ROI</span>
            <span className={cn("text-xs font-semibold tabular-nums", roi > 0 ? "text-emerald-500" : "text-muted-foreground")}>{roi > 0 ? "+" : ""}{roi}%</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">${valueSaved.toLocaleString()} value saved vs ${totalCost.toFixed(0)} cost</p>
        </div>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform shrink-0", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          <div className="grid grid-cols-3 gap-px bg-border rounded-md overflow-hidden">
            <div className="bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Hours Saved</p>
              <p className="text-sm font-medium tabular-nums">{hoursSaved}h</p>
            </div>
            <div className="bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Value</p>
              <p className="text-sm font-medium tabular-nums text-emerald-500">${valueSaved.toLocaleString()}</p>
            </div>
            <div className="bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Cost</p>
              <p className="text-sm font-medium tabular-nums">${totalCost.toFixed(0)}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground">Your hourly rate (for ROI calculation)</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">$</span>
              <input type="number" value={hourlyRate} onChange={(e) => { const v = Number(e.target.value); setHourlyRate(v); localStorage.setItem("bos-hourly-rate", String(v)) }} className="h-7 w-20 rounded-md border border-border bg-muted/50 px-2 text-xs outline-none tabular-nums" />
              <span className="text-xs text-muted-foreground">/hour</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/60">Based on {totalTasks} tasks completed at ~{hoursPerTask * 60}min saved per task</p>
        </div>
      )}
    </div>
  )
}
