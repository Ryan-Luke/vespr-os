import { withAuth } from "@/lib/auth/with-auth"
import { routeTask, executePlan } from "@/lib/agents/orchestrator"

// POST /api/orchestrate — Submit a complex request for multi-agent routing
// Body: { prompt, urgency? }
// Returns: { plan, taskIds, status }
export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json()
  const { prompt, urgency } = body

  if (!prompt || typeof prompt !== "string") {
    return Response.json({ error: "prompt is required" }, { status: 400 })
  }

  try {
    // Step 1: Decompose the request into a plan
    const { plan } = await routeTask({
      workspaceId: auth.workspace.id,
      prompt,
      requestingUserId: auth.user.id,
      urgency: urgency ?? "normal",
    })

    if (plan.tasks.length === 0) {
      return Response.json({ plan, taskIds: [], status: "no_agents_available" })
    }

    // Step 2: Execute the plan (create tasks, set up deps, trigger ready ones)
    const { taskIds, status } = await executePlan({
      workspaceId: auth.workspace.id,
      plan,
    })

    return Response.json({ plan, taskIds, status })
  } catch (err) {
    return Response.json({
      error: err instanceof Error ? err.message : "Orchestration failed",
    }, { status: 500 })
  }
}
