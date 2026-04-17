"use client"

import { useState, useEffect, useCallback } from "react"
import { Network, MessageSquare, AlertTriangle, Sparkles } from "lucide-react"
import { CollaborationFeed } from "@/components/collaboration-feed"
import { OrchestrateModal } from "@/components/orchestrate-modal"
import Link from "next/link"

export function DashboardCoordination() {
  const [threadCount, setThreadCount] = useState(0)
  const [escalationCount, setEscalationCount] = useState(0)
  const [showOrchestrate, setShowOrchestrate] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const [thRes, escRes] = await Promise.all([
        fetch("/api/agent-threads?status=active&limit=1"),
        fetch("/api/collaboration?type=escalated&limit=1"),
      ])
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

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [fetchStats])

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Collaboration Feed */}
        <div className="lg:col-span-2 stripe-card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Recent Activity</p>
            <Link
              href="/coordination"
              className="text-[11px] text-[#635bff] hover:text-[#5b52e6] font-medium transition-colors"
            >
              View all
            </Link>
          </div>
          <CollaborationFeed limit={10} compact />
        </div>

        {/* Stats + Actions */}
        <div className="space-y-4">
          {/* Active threads card */}
          <Link href="/coordination" className="stripe-card-sm block hover:border-[rgba(255,255,255,0.14)] transition-all">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#635bff]/15 flex items-center justify-center shrink-0">
                <MessageSquare className="h-[16px] w-[16px] text-[#635bff]" />
              </div>
              <div>
                <p className="text-[22px] font-bold tabular-nums leading-none">{threadCount}</p>
                <p className="text-[11px] text-[rgba(255,255,255,0.45)] mt-0.5">Active Threads</p>
              </div>
            </div>
          </Link>

          {/* Escalations card */}
          <Link href="/coordination" className="stripe-card-sm block hover:border-[rgba(255,255,255,0.14)] transition-all">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-[16px] w-[16px] text-amber-400" />
              </div>
              <div>
                <p className="text-[22px] font-bold tabular-nums leading-none">{escalationCount}</p>
                <p className="text-[11px] text-[rgba(255,255,255,0.45)] mt-0.5">Escalations</p>
              </div>
            </div>
          </Link>

          {/* Agent Network mini viz */}
          <div className="stripe-card-sm">
            <div className="flex items-center gap-2 mb-3">
              <Network className="h-[16px] w-[16px] text-[#635bff]" />
              <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-medium">Agent Network</p>
            </div>
            <div className="flex items-center justify-center py-3">
              <div className="relative h-16 w-full max-w-[180px]">
                {/* Simple node visualization */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-[#635bff] ring-2 ring-[#635bff]/20" />
                <div className="absolute top-8 left-4 h-2.5 w-2.5 rounded-full bg-blue-400 ring-2 ring-blue-400/20" />
                <div className="absolute top-8 right-4 h-2.5 w-2.5 rounded-full bg-violet-400 ring-2 ring-violet-400/20" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
                {/* Connection lines */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 180 64" fill="none">
                  <line x1="90" y1="8" x2="24" y2="36" stroke="rgba(99,91,255,0.25)" strokeWidth="1" />
                  <line x1="90" y1="8" x2="156" y2="36" stroke="rgba(99,91,255,0.25)" strokeWidth="1" />
                  <line x1="24" y1="36" x2="90" y2="58" stroke="rgba(99,91,255,0.15)" strokeWidth="1" />
                  <line x1="156" y1="36" x2="90" y2="58" stroke="rgba(99,91,255,0.15)" strokeWidth="1" />
                </svg>
              </div>
            </div>
            <p className="text-[10px] text-[rgba(255,255,255,0.3)] text-center">
              {threadCount > 0 ? `${threadCount} active connection${threadCount !== 1 ? "s" : ""}` : "No active connections"}
            </p>
          </div>

          {/* Orchestrate button */}
          <button
            onClick={() => setShowOrchestrate(true)}
            className="btn-primary w-full flex items-center justify-center gap-2 text-[13px]"
          >
            <Sparkles className="h-[16px] w-[16px]" />
            Orchestrate Task
          </button>
        </div>
      </div>

      {showOrchestrate && (
        <OrchestrateModal onClose={() => setShowOrchestrate(false)} />
      )}
    </>
  )
}
