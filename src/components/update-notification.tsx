"use client"
import { useState, useEffect } from "react"
import { useDesktop } from "@/hooks/use-desktop"
import { Button } from "@/components/ui/button"

export function UpdateNotification() {
  const desktop = useDesktop()
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (!desktop) return
    desktop.onUpdateDownloaded(() => setUpdateReady(true))
  }, [desktop])

  if (!updateReady) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-lg p-4 shadow-lg max-w-sm">
      <p className="text-sm font-medium">Update available</p>
      <p className="text-xs text-muted-foreground mt-1">A new version of VESPR is ready to install.</p>
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={() => setUpdateReady(false)}>Later</Button>
        <Button size="sm" onClick={() => desktop?.installUpdate()}>Restart & Update</Button>
      </div>
    </div>
  )
}
