import {
  PHASES,
  ensureWorkflowInitialized,
  getPhaseLeads,
  getWorkflowState,
  type PhaseKey,
} from "@/lib/workflow-engine"

// GET /api/workflow?workspaceId=XXX&init=1
// Returns the full workflow state for a workspace: all 7 phases with progress,
// the current phase key, and the resolved lead agents for the current phase.
// Pass init=1 to auto-initialize phase state if it hasn't been set up yet
// (creates the first phase run row and sets workspaces.currentPhaseKey).
export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId")
  const init = url.searchParams.get("init") === "1"

  if (!workspaceId) {
    return Response.json({ error: "workspaceId required" }, { status: 400 })
  }

  try {
    const state = init
      ? await ensureWorkflowInitialized(workspaceId)
      : await getWorkflowState(workspaceId)

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
