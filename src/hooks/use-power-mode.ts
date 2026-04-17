"use client"

import { useState, useEffect, useCallback } from "react"

export function usePowerMode() {
  const [powerMode, setPowerMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/users/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.powerMode === "boolean") {
          setPowerMode(data.powerMode)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const togglePowerMode = useCallback(async () => {
    const newValue = !powerMode
    setPowerMode(newValue) // optimistic update

    try {
      await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ powerMode: newValue }),
      })
    } catch {
      setPowerMode(!newValue) // revert on error
    }
  }, [powerMode])

  return { powerMode, togglePowerMode, loading }
}
