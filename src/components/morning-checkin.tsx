"use client"

import { useState, useEffect } from "react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { X, MessageSquare, CheckCircle2, AlertCircle, ClipboardList, Loader2 } from "lucide-react"
import { useToast } from "@/components/toast-provider"
import Link from "next/link"

interface CheckinData {
  unreadMessages: number
  tasksCompleted: number
  tasksInProgress: number
  agentsWorking: number
  agentsNeedAttention: { name: string; issue: string }[]
  chiefOfStaff: { name: string; pixelAvatarIndex: number } | null
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function MorningCheckin() {
  const [data, setData] = useState<CheckinData | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [standupRunning, setStandupRunning] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    const lastDismissed = localStorage.getItem("checkin-dismissed")
    if (lastDismissed && new Date(lastDismissed).toDateString() === new Date().toDateString()) {
      setDismissed(true); setLoaded(true); return
    }
    fetch("/api/checkin").then((r) => r.json()).then((d) => { setData(d); setLoaded(true) }).catch(() => setLoaded(true))
  }, [])

  function dismiss() {
    setDismissed(true)
    localStorage.setItem("checkin-dismissed", new Date().toISOString())
  }

  async function runStandups() {
    setStandupRunning(true)
    try {
      const res = await fetch("/api/standup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const result = await res.json()
      if (result.ok) {
        addToast(`Standups posted for ${result.count} agent${result.count === 1 ? "" : "s"}`, "success")
      } else {
        addToast("Failed to run standups", "error")
      }
    } catch {
      addToast("Failed to run standups", "error")
    } finally {
      setStandupRunning(false)
    }
  }

  if (!loaded || dismissed || !data) return null

  return (
    <div className="bg-card border border-border rounded-md p-4 relative">
      <button onClick={dismiss} className="absolute top-3 right-3 h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors">
        <X className="h-3 w-3 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3">
        {data.chiefOfStaff && <PixelAvatar characterIndex={data.chiefOfStaff.pixelAvatarIndex} size={28} className="rounded-sm mt-0.5 shrink-0" />}
        <div className="space-y-2">
          <div>
            <p className="text-[13px] font-medium">{getGreeting()}</p>
            <p className="text-xs text-muted-foreground">{data.chiefOfStaff?.name ?? "Nova"} — daily briefing</p>
          </div>

          <div className="flex gap-3 flex-wrap text-xs">
            {data.unreadMessages > 0 && (
              <Link href="/" className="flex items-center gap-1 text-primary hover:underline">
                <MessageSquare className="h-3 w-3" />{data.unreadMessages} unread
              </Link>
            )}
            {data.tasksCompleted > 0 && (
              <span className="flex items-center gap-1 text-emerald-500">
                <CheckCircle2 className="h-3 w-3" />{data.tasksCompleted} done
              </span>
            )}
            <span className="text-muted-foreground">{data.agentsWorking} agents working</span>
          </div>

          <button
            onClick={runStandups}
            disabled={standupRunning}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {standupRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
            {standupRunning ? "Running standups..." : "Run standups"}
          </button>

          {data.agentsNeedAttention.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {data.agentsNeedAttention.map((a) => (
                <span key={a.name} className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />{a.name}: {a.issue}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
