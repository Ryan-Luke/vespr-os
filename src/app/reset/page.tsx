"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2 } from "lucide-react"

/**
 * Manual demo-data reset.
 *
 * Wipes runtime data (chats, agents, channels, tasks, knowledge, workspaces)
 * while leaving all code, templates, and seeds intact. Use when moving from
 * dev/demo data to a fresh slate. Requires typing "RESET" to confirm.
 */
export default function ResetPage() {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState("")
  const [state, setState] = useState<"idle" | "wiping" | "error">("idle")
  const [error, setError] = useState("")

  async function handleReset() {
    if (confirmText !== "RESET") return
    setState("wiping")
    setError("")
    try {
      const res = await fetch("/api/reset", { method: "POST" })
      if (!res.ok) throw new Error(`Reset failed: ${res.status}`)
      // Clear any local state so the next onboarding launches truly fresh
      try {
        localStorage.removeItem("vespr-active-workspace")
        localStorage.removeItem("vespr-tutorial-completed")
      } catch {}
      router.push("/onboarding")
    } catch (e) {
      setState("error")
      setError(e instanceof Error ? e.message : "Unknown error")
    }
  }

  const canConfirm = confirmText === "RESET" && state === "idle"

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">Reset demo data</h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              This wipes all runtime data — chats, agents, channels, tasks, knowledge, and workspaces. Your code, templates, and features stay intact.
            </p>
          </div>
        </div>

        <div className="bg-muted/40 border border-border rounded-md p-3 mb-4">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">What gets deleted:</span> messages, channels, agents, teams, workspaces, tasks, knowledge entries, SOPs, automations, activity logs, approvals, memories, trophies, and all related records.
          </p>
          <p className="text-[12px] text-muted-foreground leading-relaxed mt-2">
            <span className="font-medium text-foreground">What stays:</span> everything you&apos;ve built — code, components, API routes, schema, auth, and the onboarding flow itself.
          </p>
        </div>

        <label className="block text-[12px] font-medium text-foreground mb-1.5">
          Type <span className="font-mono bg-muted px-1 py-0.5 rounded">RESET</span> to confirm
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="RESET"
          disabled={state !== "idle"}
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-[13px] font-mono outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
          autoFocus
        />

        {error && (
          <p className="text-[12px] text-destructive mt-2">{error}</p>
        )}

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => router.push("/")}
            disabled={state === "wiping"}
            className="flex-1 h-9 rounded-md border border-border bg-background text-[13px] font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReset}
            disabled={!canConfirm}
            className="flex-1 h-9 rounded-md bg-destructive text-destructive-foreground text-[13px] font-medium hover:bg-destructive/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {state === "wiping" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Wiping…
              </>
            ) : (
              "Reset and start fresh"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
