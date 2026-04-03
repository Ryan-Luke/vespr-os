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
  Bot,
  ChevronLeft,
  ChevronRight,
  Plug,
  ClipboardList,
  LogOut,
  Brain,
  Menu,
  X,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect, useCallback } from "react"

const navItems = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/office", label: "Office", icon: Building2 },
  { href: "/tasks", label: "Task Board", icon: ClipboardList },
  { href: "/knowledge", label: "Knowledge", icon: Brain },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/decisions", label: "Decision Log", icon: Shield },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/builder", label: "Hire Agent", icon: PlusCircle },
  { href: "/settings", label: "Settings", icon: Settings },
]

interface BadgeCounts {
  chatUnread: number
  tasksPending: number
}

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [badges, setBadges] = useState<BadgeCounts>({ chatUnread: 0, tasksPending: 0 })

  const fetchBadges = useCallback(async () => {
    try {
      const [messagesRes, tasksRes] = await Promise.all([
        fetch("/api/messages/unread"),
        fetch("/api/tasks/count"),
      ])
      if (messagesRes.ok && tasksRes.ok) {
        const messagesData = await messagesRes.json()
        const tasksData = await tasksRes.json()
        setBadges({
          chatUnread: messagesData.count ?? 0,
          tasksPending: tasksData.pending ?? 0,
        })
      }
    } catch {
      // Silently fail — badges are non-critical
    }
  }, [])

  useEffect(() => {
    fetchBadges()
    const interval = setInterval(fetchBadges, 30000)
    return () => clearInterval(interval)
  }, [fetchBadges])

  function handleNavClick() {
    onMobileClose?.()
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  function getBadgeForItem(href: string) {
    if (href === "/chat" && badges.chatUnread > 0) {
      return (
        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-semibold">
          {badges.chatUnread > 99 ? "99+" : badges.chatUnread}
        </Badge>
      )
    }
    if (href === "/tasks" && badges.tasksPending > 0) {
      return (
        <Badge variant="default" className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-semibold">
          {badges.tasksPending > 99 ? "99+" : badges.tasksPending}
        </Badge>
      )
    }
    return null
  }

  function getCollapsedBadgeDot(href: string) {
    if (href === "/chat" && badges.chatUnread > 0) {
      return <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-destructive" />
    }
    if (href === "/tasks" && badges.tasksPending > 0) {
      return <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary" />
    }
    return null
  }

  const sidebarContent = (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card h-full transition-all duration-200",
        // On mobile the sidebar is always full-width inside its overlay
        "max-md:w-64",
        // On desktop use collapsed state
        collapsed ? "md:w-16" : "md:w-56"
      )}
    >
      <div className={cn("flex items-center gap-2 border-b border-border p-4", collapsed && "md:justify-center")}>
        <Bot className="h-7 w-7 text-primary shrink-0" />
        <span className={cn("font-semibold text-lg tracking-tight", collapsed && "md:hidden")}>Business OS</span>
        {/* Close button on mobile */}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto md:hidden"
          onClick={onMobileClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const badge = getBadgeForItem(item.href)
          const collapsedDot = getCollapsedBadgeDot(item.href)

          // Collapsed desktop view uses tooltips
          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  className={cn(
                    "relative hidden md:flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors w-full justify-center px-2",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  render={<Link href={item.href} onClick={handleNavClick} />}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {collapsedDot}
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          }

          // Expanded view (desktop) and always on mobile
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                // On mobile when collapsed, still show expanded (collapsed is desktop only)
                collapsed && "md:justify-center md:px-2"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
              {!collapsed && badge}
              {/* On mobile always show badge even when desktop is collapsed */}
              {collapsed && <span className="md:hidden">{badge}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-2 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full text-muted-foreground hover:text-red-400", collapsed ? "md:justify-center justify-start gap-3 px-3" : "justify-start gap-3 px-3")}
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className={cn(collapsed && "md:hidden")}>Log Out</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center hidden md:flex"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  )

  return sidebarContent
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="md:hidden fixed top-3 left-3 z-40"
      onClick={onClick}
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}
