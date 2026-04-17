import { skipPhase, type PhaseKey } from "@/lib/workflow-engine"
import { withAuth } from "@/lib/auth/with-auth"

// POST /api/workflow/skip
// Body: { phaseKey, skipContext }
// Marks a phase as skipped. Requires a skipContext brain-dump (min 20 chars)
// so downstream agents inherit the info they would have gathered in this phase.
// If the skipped phase is the currently active one, advances to the next phase.
export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json() as {
    phaseKey?: PhaseKey
    skipContext?: string
  }
  if (!body.phaseKey || !body.skipContext) {
    return Response.json(
      { error: "phaseKey and skipContext are required" },
      { status: 400 }
    )
  }
  try {
    const state = await skipPhase(auth.workspace.id, body.phaseKey, body.skipContext)
    return Response.json({ state })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    )
  }
}
