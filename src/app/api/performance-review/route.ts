import { withAuth } from "@/lib/auth/with-auth"
import { runPerformanceReview } from "@/lib/performance-review-core"

export const maxDuration = 30

export async function POST(req: Request) {
  const auth = await withAuth()
  const { agentId } = await req.json() as { agentId: string }

  const apiKey = auth.workspace.anthropicApiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "Anthropic API key not configured. Set one in workspace settings or ANTHROPIC_API_KEY env var." },
      { status: 400 },
    )
  }

  const result = await runPerformanceReview({
    agentId,
    workspaceId: auth.workspace.id,
    apiKey,
  })

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 })
  }

  return Response.json({ review: result.review, agent: result.agentName })
}
