"use client"

import { useState, useEffect } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { CheckCircle2, MessageSquare, FileText, Flag, Activity, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActivityEntry {
  id: string
  agentName: string
  agentPixelIndex?: number
  action: string
  description: string
  createdAt: string
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  completed_task: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  sent_message: <MessageSquare className="h-3 w-3 text-blue-500" />,
  created_sop: <FileText className="h-3 w-3 text-violet-500" />,
  updated_knowledge: <Zap className="h-3 w-3 text-cyan-500" />,
  flagged: <Flag className="h-3 w-3 text-red-500" />,
}

export function ActivityTicker() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/activity?limit=20")
      .then((r) => r.json())
      .then((data) => {
        const items = data.entries ?? (Array.isArray(data) ? data : [])
        setEntries(items)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))

    // Poll every 30s
    const poll = setInterval(() => {
      fetch("/api/activity?limit=20")
        .then((r) => r.json())
        .then((data) => {
          const items = data.entries ?? (Array.isArray(data) ? data : [])
          setEntries(items)
        })
        .catch(() => {})
    }, 30000)
    return () => clearInterval(poll)
  }, [])

  if (!loaded || entries.length === 0) return null

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return "now"
    if (min < 60) return `${min}m`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h`
    return `${Math.floor(hr / 24)}d`
  }

  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="flex items-center animate-scroll-left">
        <div className="flex items-center gap-6 py-2 px-4 whitespace-nowrap">
          {entries.slice(0, 12).map((entry) => {
            const icon = ACTION_ICONS[entry.action] ?? <Activity className="h-3 w-3 text-muted-foreground" />
            return (
              <div key={entry.id} className="flex items-center gap-1.5 text-xs">
                {icon}
                <span className="font-medium">{entry.agentName}</span>
                <span className="text-muted-foreground">{entry.description}</span>
                <span className="text-muted-foreground/50 tabular-nums">{timeAgo(entry.createdAt)}</span>
              </div>
            )
          })}
        </div>
        {/* Duplicate for seamless loop */}
        <div className="flex items-center gap-6 py-2 px-4 whitespace-nowrap" aria-hidden>
          {entries.slice(0, 12).map((entry) => {
            const icon = ACTION_ICONS[entry.action] ?? <Activity className="h-3 w-3 text-muted-foreground" />
            return (
              <div key={`dup-${entry.id}`} className="flex items-center gap-1.5 text-xs">
                {icon}
                <span className="font-medium">{entry.agentName}</span>
                <span className="text-muted-foreground">{entry.description}</span>
                <span className="text-muted-foreground/50 tabular-nums">{timeAgo(entry.createdAt)}</span>
              </div>
            )
          })}
        </div>
      </div>
      <style jsx>{`
        @keyframes scroll-left {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-scroll-left {
          animation: scroll-left 60s linear infinite;
        }
        .animate-scroll-left:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
