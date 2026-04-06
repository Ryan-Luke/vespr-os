import { skipPhase, type PhaseKey } from "@/lib/workflow-engine"

// POST /api/workflow/skip
// Body: { workspaceId, phaseKey, skipContext }
// Marks a phase as skipped. Requires a skipContext brain-dump (min 20 chars)
// so downstream agents inherit the info they would have gathered in this phase.
// If the skipped phase is the currently active one, advances to the next phase.
export async function POST(req: Request) {
  const body = await req.json() as {
    workspaceId?: string
    phaseKey?: PhaseKey
    skipContext?: string
  }
  if (!body.workspaceId || !body.phaseKey || !body.skipContext) {
    return Response.json(
      { error: "workspaceId, phaseKey, and skipContext are required" },
      { status: 400 }
    )
  }
  try {
    const state = await skipPhase(body.workspaceId, body.phaseKey, body.skipContext)
    return Response.json({ state })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    )
  }
}
