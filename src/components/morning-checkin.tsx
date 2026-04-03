"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PixelAvatar } from "@/components/pixel-avatar"
import { X, MessageSquare, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react"
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

  useEffect(() => {
    // Check if already dismissed today
    const lastDismissed = localStorage.getItem("checkin-dismissed")
    if (lastDismissed) {
      const dismissedDate = new Date(lastDismissed).toDateString()
      const today = new Date().toDateString()
      if (dismissedDate === today) {
        setDismissed(true)
        setLoaded(true)
        return
      }
    }

    fetch("/api/checkin")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  function dismiss() {
    setDismissed(true)
    localStorage.setItem("checkin-dismissed", new Date().toISOString())
  }

  if (!loaded || dismissed || !data) return null

  const greeting = getGreeting()

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-violet-500/5 relative overflow-hidden">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full hover:bg-accent transition-colors z-10"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>

      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-4">
          {/* Chief of Staff avatar */}
          {data.chiefOfStaff && (
            <div className="shrink-0 hidden sm:block">
              <PixelAvatar
                characterIndex={data.chiefOfStaff.pixelAvatarIndex}
                size={48}
                className="rounded-xl border border-border"
              />
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-3">
            {/* Greeting */}
            <div>
              <h2 className="text-base font-semibold">
                {greeting}, boss
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.chiefOfStaff
                  ? `${data.chiefOfStaff.name} here with your daily briefing.`
                  : "Here's your daily briefing."}
              </p>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-3">
              {data.unreadMessages > 0 && (
                <Link href="/chat">
                  <Badge variant="secondary" className="gap-1.5 cursor-pointer hover:bg-accent transition-colors h-7 px-3">
                    <MessageSquare className="h-3 w-3" />
                    {data.unreadMessages} unread message{data.unreadMessages !== 1 ? "s" : ""}
                    <ArrowRight className="h-3 w-3 ml-0.5" />
                  </Badge>
                </Link>
              )}

              {data.tasksCompleted > 0 && (
                <Badge variant="secondary" className="gap-1.5 h-7 px-3 bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3" />
                  {data.tasksCompleted} task{data.tasksCompleted !== 1 ? "s" : ""} completed
                </Badge>
              )}

              {data.tasksInProgress > 0 && (
                <Badge variant="secondary" className="gap-1.5 h-7 px-3">
                  {data.tasksInProgress} in progress
                </Badge>
              )}

              <Badge variant="secondary" className="gap-1.5 h-7 px-3">
                {data.agentsWorking} agent{data.agentsWorking !== 1 ? "s" : ""} working
              </Badge>
            </div>

            {/* Attention items */}
            {data.agentsNeedAttention.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.agentsNeedAttention.map((a) => (
                  <Badge key={a.name} variant="destructive" className="gap-1.5 h-7 px-3">
                    <AlertCircle className="h-3 w-3" />
                    {a.name}: {a.issue}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
