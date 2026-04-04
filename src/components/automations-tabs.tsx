"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { WorkflowBuilder } from "@/components/workflow-builder"

export function AutomationsTabs({ listContent }: { listContent: ReactNode }) {
  const [tab, setTab] = useState<"list" | "builder">("list")

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5 w-fit">
        {(["list", "builder"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "h-7 px-3 rounded text-xs font-medium transition-colors",
              tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "list" ? "Automations" : "Builder"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "list" ? (
        <>{listContent}</>
      ) : (
        <WorkflowBuilder />
      )}
    </>
  )
}
