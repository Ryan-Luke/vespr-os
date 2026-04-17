import Link from "next/link"
import { Check, Circle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { getActiveWorkspace } from "@/lib/workspace-server"
import {
  getWorkflowState,
  getPhaseLeads,
  getPhase,
  getNextPhaseKey,
  PHASES,
  type PhaseKey,
  type PhaseOutputSpec,
} from "@/lib/workflow-engine"
import { PixelAvatar } from "@/components/pixel-avatar"
import { WorkflowPhaseGate } from "@/components/workflow-phase-gate"
import { WorkflowOutputPicker } from "@/components/workflow-output-picker"
import { db } from "@/lib/db"
import { agents as agentsTable } from "@/lib/db/schema"
import { inArray } from "drizzle-orm"

// ── Workflow Phase Widget ──────────────────────────────────────
// Stripe-inspired: one calm glance at the current phase.
// Teal accent for active state, clean progress, subtle breadcrumb.

function outputStatusIcon(status?: "empty" | "provided" | "confirmed") {
  if (status === "confirmed") {
    return <Check className="h-3.5 w-3.5 text-teal-500" />
  }
  if (status === "provided") {
    return <Check className="h-3.5 w-3.5 text-stone-500" />
  }
  return <Circle className="h-3.5 w-3.5 text-stone-700" />
}

function OutputRow({
  spec,
  status,
}: {
  spec: PhaseOutputSpec
  status?: "empty" | "provided" | "confirmed"
}) {
  const done = status === "provided" || status === "confirmed"
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span className="mt-0.5 shrink-0">{outputStatusIcon(status)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium", done && "text-stone-600 line-through decoration-stone-700")}>
            {spec.label}
          </span>
          {spec.kind === "integration" && (
            <span className="text-[10px] uppercase tracking-[0.1em] text-stone-600">Integration</span>
          )}
          {spec.kind === "milestone" && (
            <span className="text-[10px] uppercase tracking-[0.1em] text-stone-600">Milestone</span>
          )}
        </div>
        {!done && (
          <p className="text-[11px] text-stone-600 mt-0.5 leading-relaxed">
            {spec.description}
          </p>
        )}
      </div>
    </div>
  )
}

export async function WorkflowPhaseWidget() {
  const activeWs = await getActiveWorkspace()
  if (!activeWs) return null

  let state
  try {
    state = await getWorkflowState(activeWs.id)
  } catch {
    return null
  }

  // Terminal state
  if (!state.currentPhaseKey) {
    const completedCount = state.phases.filter((p) => p.status === "completed" || p.status === "skipped").length
    return (
      <div className="glass-card gradient-border p-5">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5 text-teal-500/50" />
          <span className="section-label">Workflow</span>
        </div>
        <p className="text-sm mt-2 text-stone-300">All {completedCount} phases complete — running in steady state.</p>
        <p className="text-[11px] text-stone-600 mt-1">Your team is operating on ongoing rhythms.</p>
      </div>
    )
  }

  const currentKey = state.currentPhaseKey as PhaseKey
  const currentPhase = getPhase(currentKey)
  const currentRun = state.phases.find((p) => p.phaseKey === currentKey)
  if (!currentRun) return null

  const leads = await getPhaseLeads(currentKey)

  const leadIds = [leads.chiefOfStaff?.id, leads.departmentLead?.id].filter(Boolean) as string[]
  const leadAgents = leadIds.length > 0
    ? await db
        .select({ id: agentsTable.id, name: agentsTable.name, role: agentsTable.role, pixelAvatarIndex: agentsTable.pixelAvatarIndex })
        .from(agentsTable)
        .where(inArray(agentsTable.id, leadIds))
    : []

  const { done, total } = currentRun.progress
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="glass-card gradient-border p-5">
      {/* Header: phase position + label + tagline */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-600 tabular-nums">
              Phase {currentPhase.order} of {PHASES.length}
            </span>
            <span className="text-stone-700">·</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-600">
              {currentPhase.label}
            </span>
          </div>
          <p className="text-base font-semibold mt-2 text-stone-200">{currentPhase.tagline}</p>
        </div>

        {/* Progress number */}
        <div className="text-right shrink-0">
          <p className="text-[28px] font-bold tabular-nums leading-none">
            {done}<span className="text-stone-700">/{total}</span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.1em] text-stone-600 mt-1">Outputs</p>
        </div>
      </div>

      {/* Progress bar — teal fill on stone-800 track */}
      <div className="progress-glass mt-5 h-1">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Leads */}
      {leadAgents.length > 0 && (
        <div className="mt-4 flex items-center gap-4">
          {leadAgents.map((lead) => (
            <div key={lead.id} className="flex items-center gap-2">
              <PixelAvatar characterIndex={lead.pixelAvatarIndex} size={24} className="rounded-lg" />
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-medium text-stone-300">{lead.name}</span>
                <span className="text-[10px] text-stone-600">{lead.role}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Required outputs checklist */}
      <div className="mt-5 border-t border-[rgba(255,255,255,0.06)] pt-4">
        <p className="section-label mb-2">What this phase needs</p>
        <div className="space-y-px">
          {currentPhase.requiredOutputs.map((spec) => {
            const outputState = currentRun.outputs[spec.key]
            if (spec.kind === "integration" || spec.kind === "milestone") {
              return (
                <WorkflowOutputPicker
                  key={spec.key}
                  workspaceId={activeWs.id}
                  phaseKey={currentKey}
                  outputKey={spec.key}
                  outputLabel={spec.label}
                  outputDescription={spec.description}
                  kind={spec.kind}
                  currentStatus={outputState?.status}
                  currentValue={outputState?.value}
                  suggestions={spec.integrationSuggestions}
                />
              )
            }
            return (
              <OutputRow
                key={spec.key}
                spec={spec}
                status={outputState?.status}
              />
            )
          })}
        </div>
      </div>

      {/* Gate */}
      {done === total && total > 0 && currentRun.gateDecision?.decision !== "approved" && (
        <WorkflowPhaseGate
          workspaceId={activeWs.id}
          phaseKey={currentKey}
          phaseLabel={currentPhase.label}
          nextPhaseLabel={(() => {
            const nk = getNextPhaseKey(currentKey)
            return nk ? getPhase(nk).label : null
          })()}
          captured={currentPhase.requiredOutputs.map((spec) => ({
            key: spec.key,
            label: spec.label,
            value: currentRun.outputs[spec.key]?.value,
          }))}
        />
      )}

      {/* Phase breadcrumb — horizontal dots/pills */}
      <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.06)] flex items-center gap-1.5">
        {PHASES.map((p) => {
          const run = state.phases.find((r) => r.phaseKey === p.key)
          const isCurrent = p.key === currentKey
          const isDone = run?.status === "completed"
          const isSkipped = run?.status === "skipped"
          return (
            <div key={p.key} className="flex-1 flex flex-col items-center gap-1.5" title={p.label}>
              <div
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  isCurrent && "bg-teal-500",
                  isDone && "bg-teal-500/30",
                  isSkipped && "bg-stone-700",
                  !isCurrent && !isDone && !isSkipped && "bg-stone-800",
                )}
              />
              <span
                className={cn(
                  "text-[9px] uppercase tracking-[0.1em] truncate max-w-full",
                  isCurrent ? "text-teal-500 font-semibold" : "text-stone-700",
                )}
              >
                {p.label.split(" ")[0]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Call to action */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] text-stone-600">
          {leads.chiefOfStaff?.name ?? "Your team"} is ready when you are.
        </p>
        <Link
          href="/"
          className="text-[11px] font-medium text-teal-500 hover:text-teal-400 transition-colors"
        >
          Go to Chat →
        </Link>
      </div>
    </div>
  )
}
