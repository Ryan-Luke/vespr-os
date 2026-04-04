"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"

export interface Workspace {
  id: string
  name: string
  slug: string
  icon: string
  description: string | null
  businessType: string
  industry: string | null
  website: string | null
  businessProfile: Record<string, unknown>
}

interface WorkspaceContextValue {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  setActiveWorkspace: (ws: Workspace) => void
  refreshWorkspaces: () => Promise<void>
  loading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

const STORAGE_KEY = "verspr-active-workspace"

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces")
      if (!res.ok) return
      const ws: Workspace[] = await res.json()
      setWorkspaces(ws)

      // Restore active workspace from localStorage, or pick first
      const storedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
      const active = ws.find((w) => w.id === storedId) || ws[0] || null
      setActiveWorkspaceState(active)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    refreshWorkspaces()
  }, [refreshWorkspaces])

  const setActiveWorkspace = useCallback((ws: Workspace) => {
    setActiveWorkspaceState(ws)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, ws.id)
      // Also set cookie so server components can read it
      document.cookie = `${STORAGE_KEY}=${ws.id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
      // Trigger page refresh so data re-fetches with new workspace
      window.dispatchEvent(new CustomEvent("workspace-changed", { detail: ws }))
    }
  }, [])

  // Also ensure cookie is set on initial load
  useEffect(() => {
    if (activeWorkspace && typeof window !== "undefined") {
      document.cookie = `${STORAGE_KEY}=${activeWorkspace.id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    }
  }, [activeWorkspace])

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, setActiveWorkspace, refreshWorkspaces, loading }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return ctx
}

/** Helper to get the current workspace ID without the hook (for API calls) */
export function getActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(STORAGE_KEY)
}

/** Build a URL with workspaceId query param appended */
export function withWorkspace(url: string): string {
  const wsId = getActiveWorkspaceId()
  if (!wsId) return url
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}workspaceId=${wsId}`
}
