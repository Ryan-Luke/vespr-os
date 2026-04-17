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

// ── Workflow Phase Widget (BLA-68) ──────────────────────────────────
// Dashboard widget that tells the owner, in one calm glance:
//   - Which phase of the business-building state machine you're in
//   - Who's leading it (Nova + the department lead)
//   - What's done and what's still needed before we move forward
//
// Progressive disclosure: no cockpit of phase data — only the CURRENT phase
// is expanded. The other 6 phases are shown as a subtle breadcrumb strip.

function outputStatusIcon(status?: "empty" | "provided" | "confirmed") {
  if (status === "confirmed") {
    return <Check className="h-3 w-3 text-emerald-500/70" />
  }
  if (status === "provided") {
    return <Check className="h-3 w-3 text-muted-foreground/50" />
  }
  return <Circle className="h-3 w-3 text-muted-foreground/20" />
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
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="mt-0.5 shrink-0">{outputStatusIcon(status)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium", done && "text-muted-foreground/60 line-through decoration-muted-foreground/20")}>
            {spec.label}
          </span>
          {spec.kind === "integration" && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">Integration</span>
          )}
          {spec.kind === "milestone" && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">Milestone</span>
          )}
        </div>
        {!done && (
          <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-relaxed">
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

  // Tolerate workspaces that haven't been initialized yet (legacy rows from
  // before the engine landed). Don't auto-init here — that's onboarding's job.
  let state
  try {
    state = await getWorkflowState(activeWs.id)
  } catch {
    return null
  }

  // Terminal state: Operations was reached and completed — show a quiet steady-state card.
  if (!state.currentPhaseKey) {
    const completedCount = state.phases.filter((p) => p.status === "completed" || p.status === "skipped").length
    return (
      <div className="bg-card border border-border rounded-md p-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="section-label">Workflow</span>
        </div>
        <p className="text-sm mt-2">All {completedCount} phases complete — running in steady state.</p>
        <p className="text-xs text-muted-foreground/50 mt-1">Your team is operating on ongoing rhythms.</p>
      </div>
    )
  }

  const currentKey = state.currentPhaseKey as PhaseKey
  const currentPhase = getPhase(currentKey)
  const currentRun = state.phases.find((p) => p.phaseKey === currentKey)
  if (!currentRun) return null

  const leads = await getPhaseLeads(currentKey)

  // Fetch avatars for the resolved leads (one small query, happy path)
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
    <div className="bg-card border border-border rounded-md p-5">
      {/* Header: phase position + label + tagline */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 tabular-nums">
              Phase {currentPhase.order} of {PHASES.length}
            </span>
            <span className="text-[10px] text-muted-foreground/30">·</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
              {currentPhase.label}
            </span>
          </div>
          <p className="text-base font-medium mt-1.5">{currentPhase.tagline}</p>
        </div>

        {/* Progress ring/number */}
        <div className="text-right shrink-0">
          <p className="text-2xl font-semibold tabular-nums leading-none">
            {done}<span className="text-muted-foreground/30">/{total}</span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mt-1">Outputs</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1 rounded-full bg-border overflow-hidden">
        <div
          className="h-full bg-foreground/70 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Leads */}
      {leadAgents.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          {leadAgents.map((lead) => (
            <div key={lead.id} className="flex items-center gap-2">
              <PixelAvatar characterIndex={lead.pixelAvatarIndex} size={20} className="rounded-sm" />
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-medium">{lead.name}</span>
                <span className="text-[10px] text-muted-foreground/50">{lead.role}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Required outputs — the "what's next" list, progressively disclosed.
          Decisions/artifacts are static rows (captured via chat + tool).
          Integrations/milestones are interactive rows (captured via picker). */}
      <div className="mt-5 border-t border-border pt-4">
        <p className="section-label mb-1">What this phase needs</p>
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

      {/* Gate: shows only when every required output is captured AND the user
          hasn't already approved this phase. Advancement is always human. */}
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

      {/* Phase breadcrumb strip — subtle, at the bottom */}
      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-1">
        {PHASES.map((p) => {
          const run = state.phases.find((r) => r.phaseKey === p.key)
          const isCurrent = p.key === currentKey
          const isDone = run?.status === "completed"
          const isSkipped = run?.status === "skipped"
          return (
            <div key={p.key} className="flex-1 flex flex-col items-center gap-1.5" title={p.label}>
              <div
                className={cn(
                  "h-1 w-full rounded-full transition-colors",
                  isCurrent && "bg-foreground/70",
                  isDone && "bg-emerald-500/40",
                  isSkipped && "bg-muted-foreground/20",
                  !isCurrent && !isDone && !isSkipped && "bg-border",
                )}
              />
              <span
                className={cn(
                  "text-[9px] uppercase tracking-wider truncate max-w-full",
                  isCurrent ? "text-foreground/80 font-medium" : "text-muted-foreground/30",
                )}
              >
                {p.label.split(" ")[0]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Quiet call to action — points into chat for the actual work */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground/50">
          {leads.chiefOfStaff?.name ?? "Your team"} is ready when you are.
        </p>
        <Link
          href="/"
          className="text-[11px] font-medium text-foreground/70 hover:text-foreground transition-colors"
        >
          Go to Chat →
        </Link>
      </div>
    </div>
  )
}
