"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { PixelAvatar } from "@/components/pixel-avatar"

// ── Types ───────────────────────────────────────────────────
interface ActivityEntry {
  id: string
  agentId: string | null
  agentName: string
  action: string
  description: string
  metadata: Record<string, unknown>
  createdAt: string
}

// ── Category helpers ────────────────────────────────────────
type NotificationCategory =
  | "task_completed"
  | "approval_needed"
  | "agent_error"
  | "message_mention"
  | "milestone_unlocked"
  | "other"

function categorize(action: string): NotificationCategory {
  if (action === "completed_task") return "task_completed"
  if (action === "flagged" || action === "approval_needed") return "approval_needed"
  if (action === "error" || action === "agent_error") return "agent_error"
  if (action === "sent_message" || action === "mention") return "message_mention"
  if (action === "milestone" || action === "created_sop") return "milestone_unlocked"
  return "other"
}

const categoryDot: Record<NotificationCategory, string> = {
  task_completed: "bg-[#635bff]",
  approval_needed: "bg-amber-500",
  agent_error: "bg-red-500",
  message_mention: "bg-[#9ca3af]",
  milestone_unlocked: "bg-[#635bff]",
  other: "bg-[#6b7280]",
}

const categoryNav: Record<NotificationCategory, string> = {
  task_completed: "/tasks",
  approval_needed: "/dashboard",
  agent_error: "/dashboard",
  message_mention: "/",
  milestone_unlocked: "/timeline",
  other: "/dashboard",
}

// ── Helpers ─────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/** Derive a stable avatar index from agent name */
function avatarIndex(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xff
  }
  return hash % 8
}

const LS_KEY = "bos-notifications-read-at"

function getReadAt(): number {
  if (typeof window === "undefined") return 0
  return Number(localStorage.getItem(LS_KEY) || "0")
}

function setReadAt(ts: number) {
  localStorage.setItem(LS_KEY, String(ts))
}

// ── Component ───────────────────────────────────────────────
export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [readAt, setReadAtState] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // ── Fetch activity ──
  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/activity?limit=20")
      if (!res.ok) return
      const raw = await res.json()
      const data: ActivityEntry[] = raw.entries ?? (Array.isArray(raw) ? raw : [])
      setEntries(data.slice(0, 20))
    } catch {
      /* silent */
    }
  }, [])

  // Init read-at from localStorage (client-only)
  useEffect(() => {
    setReadAtState(getReadAt())
  }, [])

  // Fetch on mount + poll every 30s
  useEffect(() => {
    fetchActivity()
    const interval = setInterval(fetchActivity, 30000)
    return () => clearInterval(interval)
  }, [fetchActivity])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  // ── Derived state ──
  const unreadCount = entries.filter(
    (e) => new Date(e.createdAt).getTime() > readAt
  ).length

  function handleMarkAllRead() {
    const ts = Date.now()
    setReadAt(ts)
    setReadAtState(ts)
  }

  function handleNotificationClick(entry: ActivityEntry) {
    const cat = categorize(entry.action)
    setOpen(false)
    router.push(categoryNav[cat])
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center h-7 w-7 rounded-lg hover:bg-[#16213e] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 text-[#6b7280]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-[16px] min-w-[16px] rounded-full bg-[#635bff] px-1 text-[9px] font-bold text-white flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full mt-1.5 bg-[#1a1a2e] border border-[rgba(255,255,255,0.08)] rounded-xl w-80 max-h-96 overflow-y-auto z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
            <span className="section-label">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-[#635bff] hover:text-[#5b52e6] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Items */}
          {entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[rgba(255,255,255,0.35)]">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {entries.map((entry) => {
                const isUnread =
                  new Date(entry.createdAt).getTime() > readAt
                const cat = categorize(entry.action)
                return (
                  <button
                    key={entry.id}
                    onClick={() => handleNotificationClick(entry)}
                    className={cn(
                      "flex items-start gap-2.5 px-4 py-3 hover:bg-[#16213e]/40 transition-colors w-full text-left",
                      isUnread && "border-l-2 border-l-[#635bff]"
                    )}
                  >
                    {/* Avatar */}
                    <PixelAvatar
                      characterIndex={avatarIndex(entry.agentName)}
                      size={24}
                      className="shrink-0 mt-0.5 rounded-lg"
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {/* Category dot */}
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            categoryDot[cat]
                          )}
                        />
                        <span
                          className={cn(
                            "text-[13px] leading-tight truncate",
                            isUnread
                              ? "text-[#f3f4f6] font-medium"
                              : "text-[#6b7280]"
                          )}
                        >
                          {entry.agentName}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-[13px] leading-snug mt-0.5 line-clamp-2",
                          isUnread
                            ? "text-[#9ca3af]"
                            : "text-[rgba(255,255,255,0.35)]"
                        )}
                      >
                        {entry.description}
                      </p>
                      <span className="text-[11px] text-[rgba(255,255,255,0.2)] mt-0.5 block">
                        {timeAgo(entry.createdAt)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
