"use client"

import { useState, useEffect, useRef } from "react"
import { X, Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlanTask {
  agentId: string
  agentName: string
  title: string
  dependsOn: string[]
}

interface OrchestrationResult {
  plan: {
    tasks: PlanTask[]
    reasoning: string
  }
  taskIds: string[]
  status: string
}

interface OrchestrateModalProps {
  onClose: () => void
}

export function OrchestrateModal({ onClose }: OrchestrateModalProps) {
  const [prompt, setPrompt] = useState("")
  const [urgency, setUrgency] = useState<"low" | "normal" | "high" | "urgent">("normal")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<OrchestrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    requestAnimationFrame(() => {
      overlayRef.current?.classList.remove("opacity-0")
      panelRef.current?.classList.remove("translate-y-4", "opacity-0")
    })
  }, [])

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  async function handleSubmit() {
    if (!prompt.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), urgency }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      const data: OrchestrationResult = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Orchestration failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm opacity-0 transition-opacity duration-200"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="relative bg-[#1a1a2e] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl w-full max-w-[560px] mx-4 max-h-[85vh] overflow-y-auto translate-y-4 opacity-0 transition-all duration-200"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-7 w-7 rounded-md flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/[0.04] transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#635bff]/15 flex items-center justify-center">
              <Sparkles className="h-[18px] w-[18px] text-[#635bff]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Orchestrate Task</h2>
              <p className="text-[12px] text-[#6b7280]">
                Describe a complex request — the orchestrator will decompose, assign, and sequence it across agents
              </p>
            </div>
          </div>

          {!result ? (
            <>
              {/* Prompt */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#6b7280] uppercase tracking-wider font-medium">
                  Request
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="e.g. Research competitor pricing, draft a comparison report, and update the sales deck with the findings..."
                  className="w-full rounded-lg bg-[#16213e] border border-[rgba(255,255,255,0.08)] focus:border-[#635bff]/50 focus:ring-1 focus:ring-[#635bff]/20 px-3 py-2.5 text-[13px] outline-none resize-none transition-colors text-white placeholder:text-[rgba(255,255,255,0.25)]"
                  autoFocus
                />
              </div>

              {/* Urgency */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#6b7280] uppercase tracking-wider font-medium">
                  Urgency
                </label>
                <div className="flex gap-1">
                  {(["low", "normal", "high", "urgent"] as const).map((u) => (
                    <button
                      key={u}
                      onClick={() => setUrgency(u)}
                      className={cn(
                        "h-7 px-3 rounded-md text-[11px] font-medium capitalize transition-colors",
                        urgency === u
                          ? "bg-[#635bff] text-white"
                          : "bg-[#16213e] border border-[rgba(255,255,255,0.08)] text-[#9ca3af] hover:text-white hover:bg-white/[0.04]",
                      )}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-[12px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="h-8 px-3 rounded-md text-[12px] font-medium text-[#9ca3af] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!prompt.trim() || submitting}
                  className={cn(
                    "h-8 px-4 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5",
                    prompt.trim() && !submitting
                      ? "bg-[#635bff] text-white hover:bg-[#5b52e6]"
                      : "bg-[#16213e] text-[#6b7280] cursor-not-allowed",
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Orchestrating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      Orchestrate
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Result View */
            <div className="space-y-4">
              {/* Status banner */}
              <div className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-medium",
                result.status === "executed" || result.status === "planned"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : result.status === "no_agents_available"
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-[#635bff]/10 text-[#635bff]",
              )}>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {result.status === "executed" && `Plan executed — ${result.taskIds.length} task${result.taskIds.length !== 1 ? "s" : ""} created`}
                {result.status === "planned" && `Plan created — ${result.taskIds.length} task${result.taskIds.length !== 1 ? "s" : ""} ready`}
                {result.status === "no_agents_available" && "No agents available for this request"}
                {!["executed", "planned", "no_agents_available"].includes(result.status) && `Status: ${result.status}`}
              </div>

              {/* Reasoning */}
              {result.plan.reasoning && (
                <div className="space-y-1">
                  <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-medium">Reasoning</p>
                  <p className="text-[12px] text-[rgba(255,255,255,0.55)] leading-relaxed">
                    {result.plan.reasoning}
                  </p>
                </div>
              )}

              {/* Task plan */}
              {result.plan.tasks.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-medium">Task Plan</p>
                  <div className="space-y-1.5">
                    {result.plan.tasks.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 rounded-lg bg-[#16213e] border border-[rgba(255,255,255,0.06)] px-3 py-2.5"
                      >
                        <span className="text-[10px] font-bold text-[#635bff] bg-[#635bff]/10 rounded-full h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium">{t.title}</p>
                          <p className="text-[11px] text-[rgba(255,255,255,0.45)] mt-0.5">
                            Assigned to <span className="text-[rgba(255,255,255,0.6)]">{t.agentName}</span>
                          </p>
                          {t.dependsOn.length > 0 && (
                            <p className="text-[10px] text-[rgba(255,255,255,0.35)] mt-0.5">
                              Waits for: step {t.dependsOn.map((_, di) => di + 1).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Done */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={onClose}
                  className="h-8 px-4 rounded-lg text-[12px] font-medium bg-[#635bff] text-white hover:bg-[#5b52e6] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
