"use client"

import { useState } from "react"
import { Sidebar, MobileMenuButton } from "@/components/sidebar"
import { GlobalSearch } from "@/components/global-search"
import { TutorialOverlay } from "@/components/tutorial-overlay"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
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

      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">{children}</main>
      <GlobalSearch />
      <TutorialOverlay />
    </div>
  )
}
