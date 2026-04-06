import { upsertPhaseOutput, type PhaseKey } from "@/lib/workflow-engine"

// POST /api/workflow/outputs
// Body: { workspaceId, phaseKey, outputKey, status, value?, sourceId?, sourceType? }
// Upserts a single required output for a phase. Used by agents (or UI) as they
// satisfy each required output — e.g. "target_customer provided, stored as
// company_memory:abc-123".
export async function POST(req: Request) {
  const body = await req.json() as {
    workspaceId?: string
    phaseKey?: PhaseKey
    outputKey?: string
    status?: "provided" | "confirmed"
    value?: string
    sourceId?: string
    sourceType?: "company_memory" | "knowledge_entry" | "text"
  }
  if (!body.workspaceId || !body.phaseKey || !body.outputKey || !body.status) {
    return Response.json(
      { error: "workspaceId, phaseKey, outputKey, and status are required" },
      { status: 400 }
    )
  }
  try {
    await upsertPhaseOutput(body.workspaceId, body.phaseKey, body.outputKey, {
      status: body.status,
      value: body.value,
      sourceId: body.sourceId,
      sourceType: body.sourceType,
    })
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    )
  }
}
