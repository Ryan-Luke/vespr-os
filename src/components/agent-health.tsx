"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AgentHealthRow {
  agentId: string
  agentName: string
  status: string
  completed: number
  failed: number
  total: number
  successRate: number
  tasksThisWeek: number
}

/**
 * Agent health dashboard component.
 * Fetches agent task data and computes success rate, failure rate,
 * and weekly task count per agent.
 */
export function AgentHealth() {
  const [rows, setRows] = useState<AgentHealthRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchHealth() {
      try {
        // Fetch agent tasks
        const tasksRes = await fetch("/api/agent-tasks")
        if (!tasksRes.ok) throw new Error("Failed to fetch agent tasks")
        const tasksData = await tasksRes.json()
        const tasks: Array<{
          agentId: string
          status: string
          createdAt: string
        }> = tasksData.tasks || tasksData || []

        // Fetch agents for names
        const agentsRes = await fetch("/api/agents")
        if (!agentsRes.ok) throw new Error("Failed to fetch agents")
        const agentsData = await agentsRes.json()
        const agents: Array<{ id: string; name: string; status: string }> =
          agentsData.agents || agentsData || []

        const agentMap = new Map(agents.map((a) => [a.id, a]))

        // Compute per-agent metrics
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        const byAgent = new Map<string, { completed: number; failed: number; total: number; thisWeek: number }>()

        for (const task of tasks) {
          if (!task.agentId) continue
          let entry = byAgent.get(task.agentId)
          if (!entry) {
            entry = { completed: 0, failed: 0, total: 0, thisWeek: 0 }
            byAgent.set(task.agentId, entry)
          }
          entry.total++
          if (task.status === "completed") entry.completed++
          if (task.status === "failed") entry.failed++
          if (new Date(task.createdAt).getTime() > weekAgo) entry.thisWeek++
        }

        // Build rows for agents that have tasks, plus agents without tasks
        const result: AgentHealthRow[] = []
        const seen = new Set<string>()

        for (const [agentId, stats] of byAgent) {
          seen.add(agentId)
          const agent = agentMap.get(agentId)
          result.push({
            agentId,
            agentName: agent?.name || "Unknown",
            status: agent?.status || "idle",
            completed: stats.completed,
            failed: stats.failed,
            total: stats.total,
            successRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
            tasksThisWeek: stats.thisWeek,
          })
        }

        // Add agents that have zero tasks
        for (const agent of agents) {
          if (!seen.has(agent.id)) {
            result.push({
              agentId: agent.id,
              agentName: agent.name,
              status: agent.status,
              completed: 0,
              failed: 0,
              total: 0,
              successRate: 0,
              tasksThisWeek: 0,
            })
          }
        }

        // Sort by total tasks desc
        result.sort((a, b) => b.total - a.total)
        setRows(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load agent health")
      } finally {
        setLoading(false)
      }
    }

    fetchHealth()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Agent Health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Agent Health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Agent Health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No agents found.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Agent Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Agent</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium text-right">Success %</th>
                <th className="pb-2 pr-4 font-medium text-right">Tasks (week)</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.agentId} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">{row.agentName}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        row.status === "working"
                          ? "bg-green-500/10 text-green-600"
                          : row.status === "error"
                            ? "bg-red-500/10 text-red-600"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {row.total > 0 ? `${row.successRate}%` : "--"}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.tasksThisWeek}</td>
                  <td className="py-2 text-right tabular-nums">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
