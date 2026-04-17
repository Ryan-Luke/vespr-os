"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Building2,
  Zap,
  PlusCircle,
  Settings,
  ChevronDown,
  Plug,
  ClipboardList,
  LogOut,
  Brain,
  Menu,
  X,
  Shield,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/notification-bell"
import { useState, useEffect, useCallback } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useWorkspace } from "@/lib/workspace-context"

const navGroups = [
  {
    label: null,
    items: [
      { href: "/feed", label: "Home", icon: Trophy },
      { href: "/", label: "Chat", icon: MessageSquare },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/business", label: "My Business", icon: Building2 },
      { href: "/teams", label: "Teams", icon: Users },
      { href: "/roster", label: "Roster", icon: Trophy },
      { href: "/tasks", label: "Tasks", icon: ClipboardList },
      { href: "/knowledge", label: "Knowledge", icon: Brain },
      { href: "/automations", label: "Automations", icon: Zap },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/decisions", label: "Decisions", icon: Shield },
      { href: "/timeline", label: "Timeline", icon: TrendingUp },
      { href: "/integrations", label: "Integrations", icon: Plug },
      { href: "/office", label: "Office", icon: Building2 },
    ],
  },
]

interface BadgeCounts {
  chatUnread: number
  tasksPending: number
  approvalsPending: number
}

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [badges, setBadges] = useState<BadgeCounts>({ chatUnread: 0, tasksPending: 0, approvalsPending: 0 })
  const { workspaces, activeWorkspace, setActiveWorkspace, refreshWorkspaces } = useWorkspace()
  const [showNewWs, setShowNewWs] = useState(false)
  const [newWsName, setNewWsName] = useState("")
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; avatarEmoji: string | null } | null>(null)

  useEffect(() => {
    fetch("/api/users/preferences").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.name) setCurrentUser({ name: data.name, email: data.email, avatarEmoji: data.avatarEmoji })
    }).catch(() => {})
  }, [])

  async function createWorkspace() {
    if (!newWsName.trim()) return
    const res = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newWsName.trim() }) })
    if (res.ok) {
      const ws = await res.json()
      await refreshWorkspaces()
      setActiveWorkspace(ws)
      setNewWsName("")
      setShowNewWs(false)
    }
  }

  const fetchBadges = useCallback(async () => {
    try {
      const [messagesRes, tasksRes, approvalsRes] = await Promise.all([
        fetch("/api/messages/unread"),
        fetch("/api/tasks/count"),
        fetch("/api/approval-requests?status=pending"),
      ])
      const messagesData = messagesRes.ok ? await messagesRes.json() : {}
      const tasksData = tasksRes.ok ? await tasksRes.json() : {}
      const approvalsData = approvalsRes.ok ? await approvalsRes.json() : []
      setBadges({
        chatUnread: messagesData.total ?? messagesData.count ?? 0,
        tasksPending: tasksData.pending ?? 0,
        approvalsPending: Array.isArray(approvalsData) ? approvalsData.length : 0,
      })
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchBadges()
    const interval = setInterval(fetchBadges, 30000)
    return () => clearInterval(interval)
  }, [fetchBadges])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  function badgeFor(href: string) {
    if (href === "/" && badges.chatUnread > 0) return badges.chatUnread
    if (href === "/dashboard" && badges.approvalsPending > 0) return badges.approvalsPending
    if (href === "/tasks" && badges.tasksPending > 0) return badges.tasksPending
    return 0
  }

  return (
    <aside className="flex flex-col w-[240px] border-r border-[rgba(255,255,255,0.06)] bg-[#0a0a1a] h-full max-md:w-64 shrink-0">
      {/* ─── Header: Workspace Switcher ─── */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-[rgba(255,255,255,0.06)] shrink-0">
        <Popover>
          <PopoverTrigger className="flex items-center gap-2.5 hover:bg-white/[0.04] rounded-lg px-2 py-1.5 transition-colors -ml-1.5 min-w-0">
            {activeWorkspace ? (
              <>
                <span className="h-7 w-7 rounded-lg bg-[#635bff]/15 flex items-center justify-center text-sm shrink-0">{activeWorkspace.icon}</span>
                <span className="text-[14px] font-semibold tracking-tight truncate text-white">{activeWorkspace.name}</span>
              </>
            ) : (
              <span className="text-[14px] font-semibold tracking-tight text-white">VESPR</span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-2 bg-[#1a1a2e] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-xl">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.1em] font-medium px-2 py-1.5">Workspaces</p>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws)}
                className={cn(
                  "flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-[13px] transition-all",
                  activeWorkspace?.id === ws.id
                    ? "bg-[#635bff]/10 text-[#635bff]"
                    : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <span className="h-6 w-6 rounded-md bg-[#635bff]/10 flex items-center justify-center text-xs shrink-0">{ws.icon}</span>
                <span className="truncate flex-1 text-left">{ws.name}</span>
                {activeWorkspace?.id === ws.id && <span className="h-1.5 w-1.5 rounded-full bg-[#635bff] shrink-0" />}
              </button>
            ))}
            {!showNewWs ? (
              <button onClick={() => setShowNewWs(true)} className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-[13px] text-gray-500 hover:bg-white/[0.04] hover:text-white transition-all mt-1 border-t border-[rgba(255,255,255,0.06)] pt-2.5">
                <PlusCircle className="h-3.5 w-3.5" />
                New Workspace
              </button>
            ) : (
              <div className="mt-1.5 border-t border-[rgba(255,255,255,0.06)] pt-2 px-0.5">
                <input
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createWorkspace(); if (e.key === "Escape") setShowNewWs(false) }}
                  placeholder="Business name..."
                  className="w-full h-8 rounded-lg bg-[#16213e] border border-[rgba(255,255,255,0.08)] px-3 text-[12px] text-white outline-none transition-all focus:border-[#635bff]/50 focus:ring-1 focus:ring-[#635bff]/20"
                  autoFocus
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button onClick={createWorkspace} className="flex-1 h-7 rounded-lg bg-[#635bff] text-white text-[11px] font-medium hover:bg-[#5b52e6] transition-colors">Create</button>
                  <button onClick={() => setShowNewWs(false)} className="h-7 px-3 rounded-lg text-[11px] text-gray-500 hover:bg-white/[0.04] transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-0.5 shrink-0">
          <NotificationBell />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 md:hidden text-gray-500" onClick={onMobileClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ─── Navigation ─── */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {navGroups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-5")}>
            {group.label && (
              <p className="text-[10px] uppercase tracking-[0.1em] text-gray-500 font-semibold px-3 mb-2">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
                const count = badgeFor(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onMobileClose?.()}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all",
                      isActive
                        ? "bg-[#635bff]/10 text-white font-medium"
                        : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#635bff]" />
                    )}
                    <item.icon className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      isActive ? "text-[#635bff]" : "text-gray-500"
                    )} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {count > 0 && (
                      <span className="h-5 min-w-[20px] rounded-full bg-[#635bff] px-1.5 text-[10px] font-semibold text-white flex items-center justify-center">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ─── Footer ─── */}
      <div className="border-t border-[rgba(255,255,255,0.06)] px-3 py-3 space-y-0.5">
        <Link
          href="/builder"
          className={cn(
            "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all",
            pathname === "/builder"
              ? "bg-[#635bff]/10 text-white font-medium"
              : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
          )}
        >
          {pathname === "/builder" && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#635bff]" />
          )}
          <PlusCircle className={cn("h-[18px] w-[18px] shrink-0", pathname === "/builder" ? "text-[#635bff]" : "text-gray-500")} />
          <span>Hire Agent</span>
        </Link>
        <Link
          href="/settings"
          className={cn(
            "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all",
            pathname === "/settings"
              ? "bg-[#635bff]/10 text-white font-medium"
              : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
          )}
        >
          {pathname === "/settings" && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#635bff]" />
          )}
          <Settings className={cn("h-[18px] w-[18px] shrink-0", pathname === "/settings" ? "text-[#635bff]" : "text-gray-500")} />
          <span>Settings</span>
        </Link>

        {/* User Identity */}
        {currentUser && (
          <div className="flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg bg-white/[0.02] border border-[rgba(255,255,255,0.04)]">
            <div className="h-8 w-8 rounded-full bg-[#635bff]/15 flex items-center justify-center text-xs font-semibold text-[#635bff] shrink-0">
              {currentUser.avatarEmoji || currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-white truncate leading-tight">{currentUser.name}</p>
              <p className="text-[11px] text-gray-500 truncate leading-tight">{currentUser.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-gray-500 hover:bg-white/[0.04] hover:text-gray-300 transition-all w-full mt-1"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="md:hidden fixed top-3 left-3 z-40 h-9 w-9 p-0 rounded-lg"
      onClick={onClick}
      aria-label="Open menu"
    >
      <Menu className="h-4 w-4" />
    </Button>
  )
}
