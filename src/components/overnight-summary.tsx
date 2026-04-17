"use client"

import { useState, useEffect } from "react"
import { Moon, X, CheckCircle2, MessageSquare, BookOpen, FileText, Flag, Activity } from "lucide-react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { cn } from "@/lib/utils"

interface ActivityEntry {
  id: string
  agentId: string | null
  agentName: string
  action: string
  description: string
  metadata: Record<string, unknown>
  createdAt: string
}

const LAST_VISIT_KEY = "overnight-last-visit"
const DISMISS_KEY = "overnight-dismissed"

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function OvernightSummary() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Check if already dismissed for this session
    const lastDismissed = localStorage.getItem(DISMISS_KEY)
    const lastVisit = localStorage.getItem(LAST_VISIT_KEY)

    // Determine the "since" cutoff: last visit or 12h fallback
    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000
    const sinceMs = lastVisit ? Math.max(new Date(lastVisit).getTime(), twelveHoursAgo) : twelveHoursAgo

    // If dismissed after our cutoff, hide it
    if (lastDismissed && new Date(lastDismissed).getTime() > sinceMs) {
      setDismissed(true)
      setLoaded(true)
      // Still update the last visit timestamp
      localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
      return
    }

    fetch("/api/activity?limit=100")
      .then((r) => r.json())
      .then((raw) => {
        const data: ActivityEntry[] = raw.entries ?? (Array.isArray(raw) ? raw : [])
        const filtered = data.filter((e) => new Date(e.createdAt).getTime() > sinceMs)
        setEntries(filtered)
        setLoaded(true)
        // Update last visit
        localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
      })
      .catch(() => setLoaded(true))
  }, [])

  function dismiss() {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, new Date().toISOString())
  }

  if (!loaded || dismissed || entries.length === 0) return null

  // Build summary counts
  const taskCount = entries.filter((e) => e.action === "completed_task").length
  const messageCount = entries.filter((e) => e.action === "sent_message").length
  const sopCount = entries.filter((e) => e.action === "created_sop" || e.action === "updated_knowledge").length
  const otherCount = entries.length - taskCount - messageCount - sopCount

  const parts: string[] = []
  if (taskCount > 0) parts.push(`completed <b>${taskCount}</b> task${taskCount !== 1 ? "s" : ""}`)
  if (messageCount > 0) parts.push(`sent <b>${messageCount}</b> message${messageCount !== 1 ? "s" : ""}`)
  if (sopCount > 0) parts.push(`updated <b>${sopCount}</b> SOP${sopCount !== 1 ? "s" : ""}`)
  if (otherCount > 0 && parts.length > 0) parts.push(`performed <b>${otherCount}</b> other action${otherCount !== 1 ? "s" : ""}`)
  if (parts.length === 0) parts.push(`performed <b>${entries.length}</b> action${entries.length !== 1 ? "s" : ""}`)

  const summaryHtml = `While you were away, your team ${parts.join(", ")}.`

  // Top 5 notable events (most recent)
  const notable = entries.slice(0, 5)

  // Map of agent names to rough avatar indexes (hash-based fallback)
  function agentAvatarIndex(name: string): number {
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 24
    return hash
  }

  const actionIcons: Record<string, React.ReactNode> = {
    completed_task: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
    sent_message: <MessageSquare className="h-3 w-3 text-blue-500" />,
    updated_knowledge: <BookOpen className="h-3 w-3 text-violet-500" />,
    created_sop: <FileText className="h-3 w-3 text-blue-400" />,
    flagged: <Flag className="h-3 w-3 text-red-500" />,
  }

  return (
    <div className="bg-card border border-border border-l-2 border-l-primary rounded-md p-4 relative">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        Dismiss
      </button>

      <div className="flex items-start gap-3">
        <Moon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-2 min-w-0">
          <p className="text-[13px] font-medium">While you were away</p>
          <p
            className="text-[13px] text-muted-foreground [&>b]:text-foreground [&>b]:font-semibold"
            dangerouslySetInnerHTML={{ __html: summaryHtml }}
          />

          <div className="space-y-1 pt-1">
            {notable.map((entry) => {
              const icon = actionIcons[entry.action] ?? <Activity className="h-3 w-3 text-muted-foreground" />
              return (
                <div key={entry.id} className="flex items-center gap-2">
                  <PixelAvatar characterIndex={agentAvatarIndex(entry.agentName)} size={18} className="rounded-sm shrink-0" />
                  <span className="shrink-0">{icon}</span>
                  <span className="text-[13px] truncate flex-1">
                    <span className="font-medium">{entry.agentName}</span>{" "}
                    <span className="text-muted-foreground">{entry.description}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{formatTime(entry.createdAt)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
