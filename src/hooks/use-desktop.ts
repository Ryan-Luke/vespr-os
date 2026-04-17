"use client"
import { useState, useEffect } from "react"

interface DesktopAPI {
  isElectron: boolean
  getVersion: () => Promise<string>
  checkForUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
  onUpdateAvailable: (callback: () => void) => void
  onUpdateDownloaded: (callback: () => void) => void
}

export function useDesktop(): DesktopAPI | null {
  const [api, setApi] = useState<DesktopAPI | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).vespr?.isElectron) {
      setApi((window as any).vespr)
    }
  }, [])

  return api
}
