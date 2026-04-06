"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, CornerDownLeft, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Workflow Phase Gate (BLA-66) ─────────────────────────────────────
// Renders when all required outputs for the current phase have been
// captured. Presents the user with a buy-in decision:
//   - Approve → record gate approval + advance to next phase
//   - Needs changes → record gate as needs_changes with optional note;
//                     phase stays active so agents can refine
//
// Per PVD: agents collaborate, they don't decide. Advancement is always
// a human call.

interface Props {
  workspaceId: string
  phaseKey: string
  phaseLabel: string
  nextPhaseLabel: string | null
  captured: { key: string; label: string; value?: string }[]
}

export function WorkflowPhaseGate({
  workspaceId,
  phaseKey,
  phaseLabel,
  nextPhaseLabel,
  captured,
}: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<"idle" | "needs_changes">("idle")
  const [note, setNote] = useState("")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    setError(null)
    startTransition(async () => {
      try {
        const gateRes = await fetch("/api/workflow/gate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, phaseKey, decision: "approved" }),
        })
        if (!gateRes.ok) {
          const err = await gateRes.json().catch(() => ({}))
          throw new Error(err.error ?? "Failed to record gate")
        }
        const advRes = await fetch("/api/workflow/advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId }),
        })
        if (!advRes.ok) {
          const err = await advRes.json().catch(() => ({}))
          throw new Error(err.error ?? "Failed to advance")
        }
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error")
      }
    })
  }

  async function handleNeedsChanges() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch("/api/workflow/gate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            phaseKey,
            decision: "needs_changes",
            note: note.trim() || undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? "Failed to record gate")
        }
        setMode("idle")
        setNote("")
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error")
      }
    })
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex items-start gap-2.5 mb-3">
        <Check className="h-4 w-4 text-emerald-500/70 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">{phaseLabel} is ready for your review.</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            Everything needed has been captured. Approve to move forward
            {nextPhaseLabel ? ` to ${nextPhaseLabel}` : " to steady-state operations"}, or ask the team to refine.
          </p>
        </div>
      </div>

      {/* Captured summary — quiet review list */}
      <div className="rounded-md bg-muted/30 p-3 space-y-1.5 mb-3">
        {captured.map((c) => (
          <div key={c.key} className="flex items-start gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mt-0.5 w-28 shrink-0 truncate">
              {c.label}
            </span>
            <span className="text-[11px] text-foreground/70 flex-1 leading-relaxed">
              {c.value ?? "—"}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="text-[11px] text-red-500 mb-2">{error}</div>
      )}

      {mode === "idle" ? (
        <div className="flex items-center gap-2">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className={cn(
              "h-8 px-3 rounded-md text-xs font-medium bg-foreground text-background",
              "hover:bg-foreground/90 transition-colors flex items-center gap-1.5",
              isPending && "opacity-50 cursor-not-allowed",
            )}
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approve & advance
          </button>
          <button
            onClick={() => setMode("needs_changes")}
            disabled={isPending}
            className="h-8 px-3 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Needs changes
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What needs to change? (optional)"
            rows={2}
            className="w-full text-xs bg-muted/30 border border-border rounded-md p-2 outline-none focus:border-muted-foreground/30 transition-colors resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleNeedsChanges}
              disabled={isPending}
              className="h-8 px-3 rounded-md text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-1.5"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CornerDownLeft className="h-3 w-3" />}
              Send to team
            </button>
            <button
              onClick={() => { setMode("idle"); setNote(""); setError(null) }}
              disabled={isPending}
              className="h-8 px-3 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
