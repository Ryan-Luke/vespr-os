import { advancePhase } from "@/lib/workflow-engine"

// POST /api/workflow/advance
// Body: { workspaceId }
// Marks the current phase completed and starts the next one. Requires the
// current phase to already have an approved gate decision (use /gate first).
export async function POST(req: Request) {
  const body = await req.json() as { workspaceId?: string }
  if (!body.workspaceId) {
    return Response.json({ error: "workspaceId required" }, { status: 400 })
  }
  try {
    const state = await advancePhase(body.workspaceId)
    return Response.json({ state })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    )
  }
}
