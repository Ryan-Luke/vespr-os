"use client"

import { useState, useEffect } from "react"
import { Check, Circle, FileText } from "lucide-react"
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

    function fetchPhase() {
      fetch(`/api/workflow?workspaceId=${wsId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data?.state?.currentPhaseKey) return
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
    }

    fetchPhase()
    const poll = setInterval(fetchPhase, 5000)
    return () => clearInterval(poll)
  }, [])

  if (outputs.length === 0) return null

  const done = outputs.filter((o) => o.status !== "empty").length
  const total = outputs.length
  const allDone = done === total

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-medium text-muted-foreground">{phaseLabel}</span>
      <div className="flex items-center gap-1.5">
        {outputs.map((o) => (
          <div key={o.key} className="flex items-center gap-1" title={o.label}>
            {o.status !== "empty" ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Circle className="h-3 w-3 text-muted-foreground/30" />
            )}
            <span className={cn(
              "text-[10px]",
              o.status !== "empty" ? "text-emerald-500/80 line-through" : "text-muted-foreground/50",
            )}>
              {o.label}
            </span>
          </div>
        ))}
      </div>
      {allDone && (
        <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
          <FileText className="h-3 w-3" />
          Ready to build doc
        </div>
      )}
    </div>
  )
}
