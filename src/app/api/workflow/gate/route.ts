import { recordPhaseGate, getWorkflowState, getPhase, type PhaseKey } from "@/lib/workflow-engine"
import { withAuth } from "@/lib/auth/with-auth"

// POST /api/workflow/gate
// Body: { phaseKey, decision, note? }
// Records the user's buy-in decision for a phase. "approved" unlocks advance;
// "needs_changes" keeps the phase active with feedback; "skipped" is recorded
// but the caller should usually hit /skip instead to supply a context dump.
export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json() as {
    phaseKey?: PhaseKey
    decision?: "approved" | "needs_changes" | "skipped"
    note?: string
  }
  if (!body.phaseKey || !body.decision) {
    return Response.json(
      { error: "phaseKey and decision are required" },
      { status: 400 }
    )
  }
  try {
    // Check output completion before accepting an "approved" gate
    let warning: string | undefined
    if (body.decision === "approved") {
      const state = await getWorkflowState(auth.workspace.id)
      const phaseRun = state.phases.find((p) => p.phaseKey === body.phaseKey)
      if (phaseRun) {
        const phaseDef = getPhase(body.phaseKey)
        const totalOutputs = phaseDef.requiredOutputs.length
        const filledOutputs = phaseDef.requiredOutputs.filter((spec) => {
          const out = phaseRun.outputs[spec.key]
          return out && (out.status === "provided" || out.status === "confirmed")
        }).length
        if (filledOutputs < totalOutputs) {
          warning = `Only ${filledOutputs} of ${totalOutputs} outputs are filled. You can still advance, but some work may be incomplete.`
        }
      }
    }

    await recordPhaseGate(auth.workspace.id, body.phaseKey, body.decision, body.note)
    return Response.json({ ok: true, ...(warning ? { warning } : {}) })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    )
  }
}
