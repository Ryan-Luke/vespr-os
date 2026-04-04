"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

export function FocusModeToggle() {
  const [focus, setFocus] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("bos-focus-mode")
    if (stored === "true") setFocus(true)
  }, [])

  useEffect(() => {
    localStorage.setItem("bos-focus-mode", String(focus))
    // Toggle visibility of non-essential dashboard sections
    document.querySelectorAll("[data-dashboard-section]").forEach((el) => {
      const section = el.getAttribute("data-dashboard-section")
      if (section === "essential") return // always visible
      if (focus) {
        (el as HTMLElement).style.display = "none"
      } else {
        (el as HTMLElement).style.display = ""
      }
    })
  }, [focus])

  return (
    <button
      onClick={() => setFocus(!focus)}
      className={cn(
        "h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors",
        focus ? "bg-amber-500/10 text-amber-400" : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
      title={focus ? "Show all sections" : "Focus mode — KPIs only"}
    >
      {focus ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {focus ? "Full View" : "Focus"}
    </button>
  )
}
