"use client"

import { useState } from "react"
import { useWorkspace } from "@/lib/workspace-context"
import { Loader2, Check } from "lucide-react"

export function WorkspaceNameEditor() {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace()
  const [name, setName] = useState(activeWorkspace?.name ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sync when workspace loads/changes
  const wsName = activeWorkspace?.name ?? ""
  const dirty = name !== wsName

  async function handleSave() {
    if (!activeWorkspace || !dirty) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        await refreshWorkspaces()
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch { /* noop */ }
    setSaving(false)
  }

  if (!activeWorkspace) return null

  return (
    <div className="bg-card border border-border rounded-md p-4 space-y-3">
      <p className="section-label">Workspace Name</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false) }}
          className="flex-1 h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors"
        />
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <Check className="h-3.5 w-3.5" />
          ) : null}
          {saving ? "Saving..." : saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  )
}
