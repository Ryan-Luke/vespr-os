"use client"

import { useState, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function CollapsibleSection({
  id,
  title,
  children,
  defaultOpen = true,
}: {
  id: string
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const storageKey = `bos-section-${id}`
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) setOpen(stored === "true")
  }, [storageKey])

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem(storageKey, String(next))
  }

  return (
    <div>
      <button onClick={toggle} className="flex items-center gap-1.5 mb-3 group">
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        <p className="section-label">{title}</p>
      </button>
      {open && children}
    </div>
  )
}
