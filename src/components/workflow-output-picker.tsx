"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Circle, Loader2, ChevronRight, X, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { normalizeProviderKey, getProvider, type IntegrationProvider } from "@/lib/integrations/registry"

// ── Interactive Output Rows ───────────────────────────────────────────
// Renders the two interactive output kinds on the dashboard phase widget:
//
//   - Integration picker (BLA-67 + BLA-88): user chooses a SaaS tool from
//     suggestions or types a custom one. If the pick matches a provider in
//     the integration registry, a second step collects credentials which
//     are encrypted and stored server-side so agents can call the tool.
//     Users can also skip the credential step and just record the choice.
//
//   - Milestone confirmer: user clicks to confirm a real-world event
//     happened (first campaign shipped, first dollar received, etc.)
//     with an optional evidence note/URL.
//
// Per integrate-don't-rebuild principle: every integration suggestion
// includes at least one free fallback so users without budget can still
// progress (Google Sheets, free tiers, manual templates, etc.).

type OutputStatus = "empty" | "provided" | "confirmed"

interface IntegrationSuggestion {
  name: string
  note?: string
}

interface Props {
  workspaceId: string
  phaseKey: string
  outputKey: string
  outputLabel: string
  outputDescription: string
  kind: "integration" | "milestone"
  currentStatus?: OutputStatus
  currentValue?: string
  suggestions?: IntegrationSuggestion[]
}

export function WorkflowOutputPicker({
  workspaceId,
  phaseKey,
  outputKey,
  outputLabel,
  outputDescription,
  kind,
  currentStatus,
  currentValue,
  suggestions = [],
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [customValue, setCustomValue] = useState("")
  const [note, setNote] = useState("")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Step 2 state: credential capture for a provider matched in the registry.
  const [connectingProvider, setConnectingProvider] = useState<IntegrationProvider | null>(null)
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({})

  const done = currentStatus === "provided" || currentStatus === "confirmed"

  function resetAll() {
    setOpen(false)
    setCustomValue("")
    setNote("")
    setConnectingProvider(null)
    setCredentialValues({})
    setError(null)
  }

  async function saveChoice(value: string, optionalNote?: string) {
    setError(null)
    const fullValue = optionalNote ? `${value}. ${optionalNote}` : value
    startTransition(async () => {
      try {
        const res = await fetch("/api/workflow/outputs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            phaseKey,
            outputKey,
            status: "provided",
            value: fullValue,
            sourceType: "text",
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? "Failed to save")
        }
        resetAll()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error")
      }
    })
  }

  async function saveCredentialsAndChoice() {
    if (!connectingProvider) return
    setError(null)

    // Validate required fields client-side before hitting the API
    for (const field of connectingProvider.fields) {
      if (field.required && !credentialValues[field.key]?.trim()) {
        setError(`${field.label} is required`)
        return
      }
    }

    startTransition(async () => {
      try {
        const credsRes = await fetch("/api/integrations/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            providerKey: connectingProvider.key,
            credentials: credentialValues,
          }),
        })
        if (!credsRes.ok) {
          const err = await credsRes.json().catch(() => ({}))
          throw new Error(err.error ?? "Failed to save credentials")
        }
        const outputRes = await fetch("/api/workflow/outputs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            phaseKey,
            outputKey,
            status: "confirmed",
            value: `${connectingProvider.name} (connected)`,
            sourceType: "integration",
          }),
        })
        if (!outputRes.ok) {
          const err = await outputRes.json().catch(() => ({}))
          throw new Error(err.error ?? "Failed to mark output provided")
        }
        resetAll()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error")
      }
    })
  }

  function handlePickSuggestion(name: string) {
    // If the pick matches a registered provider, open the credential form.
    // Otherwise just record the choice as plain text.
    const providerKey = normalizeProviderKey(name)
    if (providerKey) {
      const provider = getProvider(providerKey)
      if (provider) {
        setConnectingProvider(provider)
        setCredentialValues({})
        setError(null)
        return
      }
    }
    saveChoice(name)
  }

  function handleSubmitCustom() {
    if (!customValue.trim()) return
    // Also check if the custom value matches a registered provider
    const providerKey = normalizeProviderKey(customValue.trim())
    if (providerKey) {
      const provider = getProvider(providerKey)
      if (provider) {
        setConnectingProvider(provider)
        setCredentialValues({})
        setError(null)
        return
      }
    }
    saveChoice(customValue.trim(), note.trim() || undefined)
  }

  function handleConfirmMilestone() {
    saveChoice("Confirmed", note.trim() || undefined)
  }

  // ── Done state: show the captured value with an unobtrusive reopen ──
  if (done && !open) {
    return (
      <div className="flex items-start gap-2.5 py-1.5">
        <Check className="h-3 w-3 text-emerald-500/70 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground/60 line-through decoration-muted-foreground/20">
              {outputLabel}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
              {kind}
            </span>
          </div>
          {currentValue && (
            <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{currentValue}</p>
          )}
        </div>
        <button
          onClick={() => setOpen(true)}
          className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
        >
          Change
        </button>
      </div>
    )
  }

  // ── Collapsed (empty) state: clickable row that opens the picker ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-start gap-2.5 py-1.5 text-left w-full group"
      >
        <Circle className="h-3 w-3 text-muted-foreground/20 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium group-hover:text-foreground/80 transition-colors">
              {outputLabel}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
              {kind}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-relaxed">
            {outputDescription}
          </p>
        </div>
        <ChevronRight className="h-3 w-3 text-muted-foreground/30 mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    )
  }

  // ── Expanded: picker UI ──
  return (
    <div className="py-2 border-l-2 border-foreground/10 pl-3 my-1.5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{outputLabel}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">{kind}</span>
          </div>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">{outputDescription}</p>
        </div>
        <button
          onClick={resetAll}
          className="text-muted-foreground/40 hover:text-muted-foreground shrink-0"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Step 2: credential capture form for a matched provider */}
      {connectingProvider && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Lock className="h-3 w-3 text-muted-foreground/50" />
            <p className="text-[11px] font-medium">Connect {connectingProvider.name}</p>
          </div>
          <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
            Paste your credentials. They are encrypted before being stored and are never sent back to the browser.
          </p>
          {connectingProvider.fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
                {field.label}{field.required && " *"}
              </label>
              <input
                type={field.type === "password" ? "password" : "text"}
                value={credentialValues[field.key] ?? ""}
                onChange={(e) => setCredentialValues({ ...credentialValues, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                autoComplete="off"
                className="w-full text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5 outline-none focus:border-muted-foreground/30 transition-colors font-mono"
              />
              {field.help && (
                <p className="text-[10px] text-muted-foreground/40">{field.help}</p>
              )}
            </div>
          ))}
          {error && <p className="text-[11px] text-red-500">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={saveCredentialsAndChoice}
              disabled={isPending}
              className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
              Connect
            </button>
            <button
              onClick={() => saveChoice(connectingProvider.name)}
              disabled={isPending}
              className="h-7 px-2.5 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Skip, just record choice
            </button>
            <button
              onClick={() => { setConnectingProvider(null); setCredentialValues({}); setError(null) }}
              disabled={isPending}
              className="h-7 px-2.5 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {!connectingProvider && kind === "integration" && suggestions.length > 0 && (
        <div className="space-y-1 mb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1">
            Pick one
          </p>
          {suggestions.map((s) => (
            <button
              key={s.name}
              onClick={() => handlePickSuggestion(s.name)}
              disabled={isPending}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-md hover:bg-accent/40 transition-colors",
                "flex items-center justify-between gap-2",
                isPending && "opacity-50",
              )}
            >
              <div className="min-w-0">
                <p className="text-xs font-medium">{s.name}</p>
                {s.note && <p className="text-[10px] text-muted-foreground/50 truncate">{s.note}</p>}
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {!connectingProvider && kind === "integration" && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
            Or something else
          </p>
          <input
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="e.g. Beehiiv, custom CRM, existing tool..."
            className="w-full text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5 outline-none focus:border-muted-foreground/30 transition-colors"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5 outline-none focus:border-muted-foreground/30 transition-colors"
          />
          <button
            onClick={handleSubmitCustom}
            disabled={isPending || !customValue.trim()}
            className={cn(
              "h-7 px-2.5 rounded-md text-[11px] font-medium bg-foreground text-background",
              "hover:bg-foreground/90 transition-colors inline-flex items-center gap-1",
              (isPending || !customValue.trim()) && "opacity-50 cursor-not-allowed",
            )}
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Save choice
          </button>
        </div>
      )}

      {!connectingProvider && kind === "milestone" && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground/60">
            Confirm this milestone happened. Optionally add a link or note as evidence.
          </p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Link, number, or brief evidence (optional)"
            className="w-full text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5 outline-none focus:border-muted-foreground/30 transition-colors"
          />
          <button
            onClick={handleConfirmMilestone}
            disabled={isPending}
            className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors inline-flex items-center gap-1"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Yes, this is done
          </button>
        </div>
      )}

      {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}
    </div>
  )
}
