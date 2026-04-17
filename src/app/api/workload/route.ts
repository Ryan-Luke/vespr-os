import { withAuth } from "@/lib/auth/with-auth"
import { getWorkspaceWorkload, suggestRedistribution } from "@/lib/agents/workload"

// GET /api/workload — Returns workload metrics for all agents in the workspace
// Optional: ?redistribute=true to include redistribution suggestions
export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const includeRedistribution = url.searchParams.get("redistribute") === "true"

  const workloads = await getWorkspaceWorkload(auth.workspace.id)

  const summary = {
    totalAgents: workloads.length,
    available: workloads.filter(w => w.estimatedCapacity === "available").length,
    busy: workloads.filter(w => w.estimatedCapacity === "busy").length,
    overloaded: workloads.filter(w => w.estimatedCapacity === "overloaded").length,
    totalActiveTasks: workloads.reduce((sum, w) => sum + w.activeTaskCount, 0),
    totalCompletedToday: workloads.reduce((sum, w) => sum + w.completedToday, 0),
  }

  let redistributionSuggestions = undefined
  if (includeRedistribution) {
    redistributionSuggestions = await suggestRedistribution(auth.workspace.id)
  }

  return Response.json({
    workloads,
    summary,
    ...(redistributionSuggestions !== undefined && { redistributionSuggestions }),
  })
}
