import { advancePhase, getWorkflowState, getPhase } from "@/lib/workflow-engine"
import { withAuth } from "@/lib/auth/with-auth"

// POST /api/workflow/advance
// Marks the current phase completed and starts the next one. Requires the
// current phase to already have an approved gate decision (use /gate first).
export async function POST() {
  const auth = await withAuth()
  try {
    // Check output completion before advancing and include a warning if incomplete
    let warning: string | undefined
    const preState = await getWorkflowState(auth.workspace.id)
    if (preState.currentPhaseKey) {
      const phaseDef = getPhase(preState.currentPhaseKey)
      const phaseRun = preState.phases.find((p) => p.phaseKey === preState.currentPhaseKey)
      if (phaseRun) {
        const totalOutputs = phaseDef.requiredOutputs.length
        const filledOutputs = phaseDef.requiredOutputs.filter((spec) => {
          const out = phaseRun.outputs[spec.key]
          return out && (out.status === "provided" || out.status === "confirmed")
        }).length
        if (filledOutputs < totalOutputs) {
          warning = `Only ${filledOutputs} of ${totalOutputs} outputs are filled. Advancing anyway, but some work may be incomplete.`
        }
      }
    }

    const state = await advancePhase(auth.workspace.id)
    return Response.json({ state, ...(warning ? { warning } : {}) })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    )
  }
}
