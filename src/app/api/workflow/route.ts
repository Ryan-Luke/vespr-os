import {
  PHASES,
  ensureWorkflowInitialized,
  getPhaseLeads,
  getWorkflowState,
  type PhaseKey,
} from "@/lib/workflow-engine"
import { withAuth } from "@/lib/auth/with-auth"

// GET /api/workflow?init=1
// Returns the full workflow state for the authenticated workspace: all 7 phases
// with progress, the current phase key, and the resolved lead agents for the
// current phase. Pass init=1 to auto-initialize phase state if it hasn't been
// set up yet (creates the first phase run row and sets workspaces.currentPhaseKey).
export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const init = url.searchParams.get("init") === "1"

  try {
    const state = init
      ? await ensureWorkflowInitialized(auth.workspace.id)
      : await getWorkflowState(auth.workspace.id)

    const leads = state.currentPhaseKey
      ? await getPhaseLeads(state.currentPhaseKey as PhaseKey)
      : null

    return Response.json({
      state,
      phaseDefinitions: PHASES,
      currentLeads: leads,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
