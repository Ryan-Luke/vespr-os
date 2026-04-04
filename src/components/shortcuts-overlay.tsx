"use client"

import { useState, useEffect } from "react"
import { X, Keyboard } from "lucide-react"

const SHORTCUT_GROUPS = [
  {
    label: "Navigation",
    shortcuts: [
      ["Cmd + K", "Global search"],
      ["Cmd + 1-9", "Switch channel"],
      ["Cmd + /", "Toggle shortcuts"],
      ["Escape", "Close panel / dialog"],
    ],
  },
  {
    label: "Chat",
    shortcuts: [
      ["Enter", "Send message"],
      ["Shift + Enter", "New line"],
      ["@", "Mention agent"],
      ["/task [title]", "Create task"],
      ["/help", "Show help"],
      ["/status", "System status"],
    ],
  },
  {
    label: "Messages",
    shortcuts: [
      ["Cmd + F", "Search messages"],
      ["Hover + Pin", "Pin message"],
      ["Hover + Bookmark", "Save message"],
      ["Hover + Reply", "Start thread"],
    ],
  },
  {
    label: "Global",
    shortcuts: [
      ["Cmd + K", "Search anything"],
      ["Cmd + /", "Keyboard shortcuts"],
    ],
  },
]

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === "Escape" && open) setOpen(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div className="bg-card border border-border rounded-xl p-6 w-[480px] max-h-[80vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-bold text-sm">Keyboard Shortcuts</h3>
          </div>
          <button onClick={() => setOpen(false)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">{group.label}</p>
              <div className="space-y-1.5">
                {group.shortcuts.map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{desc}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[11px] border border-border whitespace-nowrap shrink-0">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-border text-center">
          <p className="text-[11px] text-muted-foreground">Press <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px] border border-border">Cmd + /</kbd> anywhere to toggle</p>
        </div>
      </div>
    </div>
  )
}
