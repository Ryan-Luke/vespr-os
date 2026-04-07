"use client"

import { useState, useEffect } from "react"
import { Check, Circle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PhaseOutput {
  key: string
  label: string
  status: "empty" | "provided" | "confirmed"
}

export function PhaseProgressBar() {
  const [outputs, setOutputs] = useState<PhaseOutput[]>([])
  const [phaseLabel, setPhaseLabel] = useState("")

  useEffect(() => {
    const wsId = localStorage.getItem("vespr-active-workspace")
    if (!wsId) return
    fetch(`/api/workflow?workspaceId=${wsId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.state?.currentPhaseKey) return
        const currentKey = data.state.currentPhaseKey
        const phaseDef = data.phaseDefinitions?.find((p: any) => p.key === currentKey)
        const phaseRun = data.state.phases?.find((p: any) => p.phaseKey === currentKey)
        if (!phaseDef || !phaseRun) return
        setPhaseLabel(phaseDef.label)
        setOutputs(phaseDef.requiredOutputs.map((o: any) => ({
          key: o.key,
          label: o.label,
          status: phaseRun.outputs?.[o.key]?.status ?? "empty",
        })))
      })
      .catch(() => {})

    const poll = setInterval(() => {
      fetch(`/api/workflow?workspaceId=${wsId}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.state?.currentPhaseKey) return
          const currentKey = data.state.currentPhaseKey
          const phaseDef = data.phaseDefinitions?.find((p: any) => p.key === currentKey)
          const phaseRun = data.state.phases?.find((p: any) => p.phaseKey === currentKey)
          if (!phaseDef || !phaseRun) return
          setOutputs(phaseDef.requiredOutputs.map((o: any) => ({
            key: o.key,
            label: o.label,
            status: phaseRun.outputs?.[o.key]?.status ?? "empty",
          })))
        })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(poll)
  }, [])

  if (outputs.length === 0) return null

  const done = outputs.filter((o) => o.status !== "empty").length
  const total = outputs.length
  const pct = Math.round((done / total) * 100)

  return (
    <div className="ml-4 flex items-center gap-2">
      <div className="flex items-center gap-1">
        {outputs.map((o) => (
          <div
            key={o.key}
            title={o.label}
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              o.status !== "empty" ? "bg-emerald-500" : "bg-muted-foreground/20",
            )}
          />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {done}/{total}
      </span>
      {done === total && (
        <span className="text-[10px] text-emerald-500 font-medium">Ready for doc</span>
      )}
    </div>
  )
}
