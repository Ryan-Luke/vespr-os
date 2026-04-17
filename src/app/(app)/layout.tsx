"use client"

import { useState, useEffect } from "react"
import { Sidebar, MobileMenuButton } from "@/components/sidebar"
import { GlobalSearch } from "@/components/global-search"
import { TutorialOverlay } from "@/components/tutorial-overlay"
import { ShortcutsOverlay } from "@/components/shortcuts-overlay"
import { WorkspaceProvider } from "@/lib/workspace-context"
import { EvolutionMoment } from "@/components/evolution-moment"
import { RosterUnlockMoment } from "@/components/roster-unlock-moment"

function WelcomeBanner() {
  const [show, setShow] = useState(false)
  const [workspaceName, setWorkspaceName] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("vespr-welcomed")) {
      localStorage.setItem("vespr-welcomed", "1")
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((data) => {
          if (data.workspace?.name) setWorkspaceName(data.workspace.name)
          setShow(true)
        })
        .catch(() => setShow(true))
    }
  }, [])

  if (!show) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="bg-card border border-border rounded-lg shadow-lg px-5 py-3 flex items-center gap-3 max-w-md">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold">Welcome to {workspaceName || "your workspace"}!</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Start by chatting with Nova, your team coordinator.</p>
        </div>
        <button onClick={() => setShow(false)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors text-xs px-2 py-1 rounded hover:bg-accent">Dismiss</button>
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Auth guard: redirect to login if session is expired or missing
  useEffect(() => {
    fetch("/api/users/preferences").then(r => {
      if (!r.ok) window.location.href = "/login"
    }).catch(() => { window.location.href = "/login" })
  }, [])

  return (
    <WorkspaceProvider>
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — always visible, hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sidebar panel */}
          <div className="relative z-10 h-full w-fit animate-in slide-in-from-left duration-200">
            <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Mobile menu button */}
      <MobileMenuButton onClick={() => setMobileOpen(true)} />

      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-ambient">{children}</main>
      <WelcomeBanner />
      <GlobalSearch />
      <TutorialOverlay />
      <ShortcutsOverlay />
      <EvolutionMoment />
      <RosterUnlockMoment />
    </div>
    </WorkspaceProvider>
  )
}
