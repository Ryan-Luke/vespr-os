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
  ChevronLeft,
  ChevronRight,
  Plug,
  ClipboardList,
  LogOut,
  Brain,
  Menu,
  X,
  Shield,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useCallback } from "react"

/* ────────────────────────────────────────────────────────────
   Navigation grouped by concern.
   Groups create visual rhythm and semantic clarity.
   ──────────────────────────────────────────────────────────── */
const navGroups = [
  {
    label: null, // primary — no label
    items: [
      { href: "/", label: "Chat", icon: MessageSquare },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/teams", label: "Teams", icon: Users },
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
    <aside className="flex flex-col w-52 border-r border-border bg-sidebar h-full max-md:w-60">
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border shrink-0">
        <span className="text-[13px] font-semibold text-sidebar-primary-foreground tracking-tight">Business OS</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 md:hidden" onClick={onMobileClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navGroups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-4")}>
            {group.label && (
              <p className="section-label px-2 mb-1">{group.label}</p>
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
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                      isActive
                        ? "bg-accent text-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0 opacity-60" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {count > 0 && (
                      <span className="h-4.5 min-w-[18px] rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground flex items-center justify-center">
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

      {/* Footer */}
      <div className="border-t border-border p-2 space-y-0.5">
        <Link
          href="/builder"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
            pathname === "/builder"
              ? "bg-accent text-foreground font-medium"
              : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <PlusCircle className="h-4 w-4 shrink-0 opacity-60" />
          <span>Hire Agent</span>
        </Link>
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
            pathname === "/settings"
              ? "bg-accent text-foreground font-medium"
              : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4 shrink-0 opacity-60" />
          <span>Settings</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-sidebar-foreground hover:bg-accent hover:text-foreground transition-colors w-full"
        >
          <LogOut className="h-4 w-4 shrink-0 opacity-60" />
          <span>Log out</span>
        </button>
        <div className="px-2 pt-2 border-t border-border mt-1">
          <p className="text-[10px] text-muted-foreground/40">v0.1.0 · 55 commits</p>
        </div>
      </div>
    </aside>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="md:hidden fixed top-2 left-2 z-40 h-8 w-8 p-0"
      onClick={onClick}
      aria-label="Open menu"
    >
      <Menu className="h-4 w-4" />
    </Button>
  )
}
