"use client"

import { useState } from "react"
import { Download, Loader2, CheckCircle2, FileText, Database, Users, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

const EXPORTS = [
  {
    id: "tasks",
    label: "Tasks",
    description: "All tasks with status, assignee, priority, and timestamps",
    format: "CSV",
    icon: <FileText className="h-4 w-4 text-blue-400" />,
    endpoint: "/api/tasks",
  },
  {
    id: "agents",
    label: "Agent Configurations",
    description: "Agent profiles, skills, personality settings, and SOPs",
    format: "JSON",
    icon: <Users className="h-4 w-4 text-emerald-400" />,
    endpoint: "/api/agents",
  },
  {
    id: "knowledge",
    label: "Knowledge Base",
    description: "All wiki entries with content, tags, and links",
    format: "JSON",
    icon: <Database className="h-4 w-4 text-purple-400" />,
    endpoint: "/api/knowledge",
  },
  {
    id: "activity",
    label: "Activity Log",
    description: "Agent actions, decisions, and system events",
    format: "CSV",
    icon: <Activity className="h-4 w-4 text-amber-400" />,
    endpoint: "/api/activity",
  },
]

function downloadFile(data: any, filename: string, format: string) {
  let content: string
  let mimeType: string

  if (format === "CSV") {
    if (!Array.isArray(data) || data.length === 0) {
      content = "No data"
    } else {
      const headers = Object.keys(data[0])
      const rows = data.map((row: any) =>
        headers.map((h) => {
          const val = row[h]
          const str = typeof val === "object" ? JSON.stringify(val) : String(val ?? "")
          return `"${str.replace(/"/g, '""')}"`
        }).join(",")
      )
      content = [headers.join(","), ...rows].join("\n")
    }
    mimeType = "text/csv"
  } else {
    content = JSON.stringify(data, null, 2)
    mimeType = "application/json"
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function DataExport() {
  const [exporting, setExporting] = useState<string | null>(null)
  const [exported, setExported] = useState<Set<string>>(new Set())

  async function handleExport(exp: typeof EXPORTS[0]) {
    setExporting(exp.id)
    try {
      const data = await fetch(exp.endpoint).then((r) => r.json())
      const ext = exp.format === "CSV" ? "csv" : "json"
      const date = new Date().toISOString().split("T")[0]
      downloadFile(data, `vespr-${exp.id}-${date}.${ext}`, exp.format)
      setExported((prev) => new Set([...prev, exp.id]))
    } catch { /* silent */ }
    setExporting(null)
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-md p-4">
        <p className="section-label mb-1">Export Data</p>
        <p className="text-xs text-muted-foreground mb-4">Download your company data for backup or migration.</p>

        <div className="space-y-2">
          {EXPORTS.map((exp) => {
            const isExporting = exporting === exp.id
            const isDone = exported.has(exp.id)
            return (
              <div key={exp.id} className="flex items-center gap-3 p-3 rounded-md border border-border hover:border-muted-foreground/20 transition-colors">
                <div className="shrink-0">{exp.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium">{exp.label}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{exp.format}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{exp.description}</p>
                </div>
                <button
                  onClick={() => handleExport(exp)}
                  disabled={isExporting}
                  className={cn(
                    "h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors shrink-0",
                    isDone ? "text-emerald-400" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {isExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : isDone ? <CheckCircle2 className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                  {isExporting ? "Exporting..." : isDone ? "Downloaded" : "Export"}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-md p-4">
        <p className="section-label mb-1">Export All</p>
        <p className="text-xs text-muted-foreground mb-3">Download everything as a single ZIP-compatible bundle.</p>
        <button
          onClick={async () => {
            setExporting("all")
            for (const exp of EXPORTS) {
              try {
                const data = await fetch(exp.endpoint).then((r) => r.json())
                const ext = exp.format === "CSV" ? "csv" : "json"
                const date = new Date().toISOString().split("T")[0]
                downloadFile(data, `vespr-${exp.id}-${date}.${ext}`, exp.format)
              } catch { /* skip */ }
            }
            setExported(new Set(EXPORTS.map((e) => e.id)))
            setExporting(null)
          }}
          disabled={!!exporting}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          {exporting === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export All Data
        </button>
      </div>
    </div>
  )
}
