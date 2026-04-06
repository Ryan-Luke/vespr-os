import { recordPhaseGate, type PhaseKey } from "@/lib/workflow-engine"

// POST /api/workflow/gate
// Body: { workspaceId, phaseKey, decision, note? }
// Records the user's buy-in decision for a phase. "approved" unlocks advance;
// "needs_changes" keeps the phase active with feedback; "skipped" is recorded
// but the caller should usually hit /skip instead to supply a context dump.
export async function POST(req: Request) {
  const body = await req.json() as {
    workspaceId?: string
    phaseKey?: PhaseKey
    decision?: "approved" | "needs_changes" | "skipped"
    note?: string
  }
  if (!body.workspaceId || !body.phaseKey || !body.decision) {
    return Response.json(
      { error: "workspaceId, phaseKey, and decision are required" },
      { status: 400 }
    )
  }
  try {
    await recordPhaseGate(body.workspaceId, body.phaseKey, body.decision, body.note)
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    )
  }
}
