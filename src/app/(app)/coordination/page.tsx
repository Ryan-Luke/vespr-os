"use client"

import { useState, useEffect, useCallback } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { CollaborationFeed } from "@/components/collaboration-feed"
import { AgentThreadViewer } from "@/components/agent-thread-viewer"
import { OrchestrateModal } from "@/components/orchestrate-modal"
import { cn } from "@/lib/utils"

interface AgentWorkload {
  id: string
  name: string
  avatar: string
  pixelAvatarIndex: number
  status: string
  currentTask: string | null
  activeTasks: number
  maxCapacity: number
}

export default function CoordinationPage() {
  const [showOrchestrate, setShowOrchestrate] = useState(false)
  const [workloads, setWorkloads] = useState<AgentWorkload[]>([])
  const [loadingWorkload, setLoadingWorkload] = useState(true)
  const [eventCount, setEventCount] = useState(0)
  const [threadCount, setThreadCount] = useState(0)
  const [escalationCount, setEscalationCount] = useState(0)

  const fetchStats = useCallback(async () => {
    try {
      const [evRes, thRes, escRes] = await Promise.all([
        fetch("/api/collaboration?limit=1"),
        fetch("/api/agent-threads?status=active&limit=1"),
        fetch("/api/collaboration?type=escalated&limit=1"),
      ])
      if (evRes.ok) {
        const data = await evRes.json()
        setEventCount(data.total ?? 0)
      }
      if (thRes.ok) {
        const data = await thRes.json()
        setThreadCount(data.total ?? 0)
      }
      if (escRes.ok) {
        const data = await escRes.json()
        setEscalationCount(data.total ?? 0)
      }
    } catch {
      /* silent */
    }
  }, [])

  const fetchWorkload = useCallback(async () => {
    try {
      const res = await fetch("/api/agents")
      if (res.ok) {
        const data = await res.json()
        const agentList = Array.isArray(data) ? data : data.agents ?? []
        const wl: AgentWorkload[] = agentList.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          name: a.name as string,
          avatar: a.avatar as string,
          pixelAvatarIndex: (a.pixelAvatarIndex as number) ?? 0,
          status: a.status as string,
          currentTask: a.currentTask as string | null,
          activeTasks: a.status === "working" ? 1 : 0,
          maxCapacity: 3,
        }))
        setWorkloads(wl)
      }
    } catch {
      /* silent */
    } finally {
      setLoadingWorkload(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchWorkload()
    const interval = setInterval(() => {
      fetchStats()
      fetchWorkload()
    }, 15000)
    return () => clearInterval(interval)
  }, [fetchStats, fetchWorkload])

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 space-y-12 max-w-[1400px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="display-lg">Coordination</h1>
            <p className="text-[14px] text-[#6b7280] mt-1">
              Cross-agent collaboration activity
            </p>
          </div>
          <button
            onClick={() => setShowOrchestrate(true)}
            className="btn-primary flex items-center gap-2 text-[13px]"
          >
            <Sparkles className="h-[18px] w-[18px]" />
            Orchestrate Task
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Events", value: eventCount },
            { label: "Active Threads", value: threadCount },
            { label: "Escalations", value: escalationCount },
          ].map((kpi) => (
            <div key={kpi.label} className="stripe-card-sm">
              <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-medium mb-2">{kpi.label}</p>
              <p className="text-[28px] font-bold tabular-nums leading-none">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Two-column layout: Feed + Threads */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Collaboration Feed — wider */}
          <div className="lg:col-span-3 stripe-card">
            <p className="section-label mb-4">Collaboration Feed</p>
            <CollaborationFeed limit={50} />
          </div>

          {/* Active Threads — narrower */}
          <div className="lg:col-span-2 stripe-card">
            <p className="section-label mb-4">Active Threads</p>
            <AgentThreadViewer maxThreads={30} />
          </div>
        </div>

        {/* Workload Section */}
        <div>
          <p className="section-label mb-4">Agent Workload</p>
          <div className="stripe-card">
            {loadingWorkload ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-[#635bff]" />
              </div>
            ) : workloads.length === 0 ? (
              <p className="text-[13px] text-[#6b7280] py-6 text-center">No agents in workspace</p>
            ) : (
              <div className="space-y-2.5">
                {workloads.map((agent) => {
                  const utilization = agent.activeTasks / agent.maxCapacity
                  const barPct = Math.min(utilization * 100, 100)
                  const barColor =
                    utilization >= 0.9 ? "bg-red-400" :
                    utilization >= 0.6 ? "bg-amber-400" :
                    "bg-[#635bff]"

                  return (
                    <div key={agent.id} className="flex items-center gap-3">
                      <span className="text-[12px] font-medium text-[rgba(255,255,255,0.7)] w-28 truncate shrink-0">
                        {agent.name}
                      </span>
                      <div className="flex-1 bg-[#16213e] rounded-full h-2">
                        <div
                          className={cn("h-full rounded-full transition-all", barColor)}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[rgba(255,255,255,0.45)] tabular-nums w-12 text-right shrink-0">
                        {agent.activeTasks}/{agent.maxCapacity}
                      </span>
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          agent.status === "working" ? "bg-[#635bff]" :
                          agent.status === "error" ? "bg-red-400" :
                          agent.status === "paused" ? "bg-amber-400" :
                          "bg-[#6b7280]",
                        )}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="pb-8" />
      </div>

      {showOrchestrate && (
        <OrchestrateModal onClose={() => setShowOrchestrate(false)} />
      )}
    </div>
  )
}
