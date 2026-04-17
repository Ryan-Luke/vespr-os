"use client"

import { useState, useEffect } from "react"

interface Agent {
  id: string
  name: string
  costThisMonth: number
}

export function BillingUsage() {
  const [totalCost, setTotalCost] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch agents")
        return r.json()
      })
      .then((agents: Agent[]) => {
        const sum = agents.reduce((acc, a) => acc + (a.costThisMonth ?? 0), 0)
        setTotalCost(sum)
      })
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="bg-card border border-border rounded-md p-4">
        <p className="section-label mb-2">Usage</p>
        <p className="text-sm text-muted-foreground">
          No billing data available.{" "}
          <a href="/settings?tab=api-keys" className="text-primary hover:underline">
            Set up your API keys
          </a>{" "}
          to start tracking costs.
        </p>
      </div>
    )
  }

  if (totalCost === null) {
    return (
      <div className="bg-card border border-border rounded-md p-4">
        <p className="section-label mb-4">Usage</p>
        <div className="h-16 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const formatted = `$${totalCost.toFixed(2)}`

  return (
    <div className="bg-card border border-border rounded-md p-4">
      <p className="section-label mb-4">Usage</p>
      <div className="grid gap-px bg-border rounded-md overflow-hidden md:grid-cols-2">
        <div className="bg-card p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Agent Cost This Month</p>
          <p className="text-xl font-semibold tabular-nums mt-0.5">{formatted}</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Source</p>
          <p className="text-sm text-muted-foreground mt-1">Computed from agent API usage</p>
        </div>
      </div>
    </div>
  )
}
