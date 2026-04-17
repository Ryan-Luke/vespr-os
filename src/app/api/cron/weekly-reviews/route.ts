import { db } from "@/lib/db"
import { agents, decisionLog, trophyEvents, workspaces } from "@/lib/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { deriveAgentTraits } from "@/lib/gamification-runtime"
import { runPerformanceReview } from "@/lib/performance-review-core"

export const maxDuration = 120

function verifyCron(req: Request): boolean {
  const authHeader = req.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  if (process.env.NODE_ENV === "development") return true
  return false
}

// Aria's weekly performance review sweep — runs reviews on active agents
// Per PVD v2: QA/HR agent for performance reviews
export async function GET(req: Request) {
  if (!verifyCron(req)) return Response.json({ error: "Unauthorized" }, { status: 401 })

  // Get Aria (QA & People Ops)
  const [aria] = await db.select().from(agents).where(eq(agents.role, "QA & People Ops")).limit(1)
  if (!aria) return Response.json({ error: "Aria not found — weekly reviews require QA & People Ops agent" }, { status: 404 })
  if (!aria.workspaceId) return Response.json({ error: "Aria has no workspace" }, { status: 400 })

  // Get workspace API key for BYOK
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, aria.workspaceId)).limit(1)
  const apiKey = ws?.anthropicApiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: "No Anthropic API key configured" }, { status: 400 })

  // Get active agents to review (exclude Aria herself + paused agents), scoped to workspace
  const allAgents = await db.select().from(agents).where(eq(agents.workspaceId, aria.workspaceId))
  const reviewable = allAgents.filter((a) =>
    a.id !== aria.id &&
    a.status !== "paused" &&
    (a.tasksCompleted ?? 0) > 0 // only review agents who've done work
  )

  // Cap at 3 agents per run to stay within function duration
  const batch = reviewable.slice(0, 3)

  const results: Array<{ agentName: string; status: string; rating?: number }> = []

  for (const agent of batch) {
    try {
      const result = await runPerformanceReview({
        agentId: agent.id,
        workspaceId: aria.workspaceId,
        apiKey,
      })

      if (result.ok && result.review) {
        results.push({ agentName: agent.name, status: "reviewed", rating: result.review.rating })

        // Log in decision log with reasoning
        await db.insert(decisionLog).values({
          workspaceId: aria.workspaceId,
          agentId: aria.id,
          agentName: aria.name,
          actionType: "decision_made",
          title: `Weekly review: ${agent.name}`,
          description: `Completed performance review. Rating: ${result.review.rating}/5.`,
          reasoning: result.review.summary || "Weekly review cadence per QA & People Ops mandate.",
          outcome: `Review posted in #team-leaders with strengths, improvements, and recommendations.`,
        })

        // Top performers get a trophy event
        if (result.review.rating >= 4) {
          await db.insert(trophyEvents).values({
            agentId: agent.id,
            workspaceId: agent.workspaceId,
            agentName: agent.name,
            type: "milestone",
            title: `${agent.name} passed weekly review with ${result.review.rating}/5`,
            description: result.review.summary,
            icon: "⭐",
          })
        }

        // Derive emergent traits from performance data after review
        if (agent.workspaceId) {
          try {
            await deriveAgentTraits(agent.id, agent.workspaceId)
          } catch (e) {
            console.error(`Trait derivation failed for ${agent.name}:`, e)
          }
        }
      } else {
        results.push({ agentName: agent.name, status: "failed" })
      }
    } catch (e) {
      results.push({ agentName: agent.name, status: "error" })
    }

    // Small delay between reviews
    await new Promise((r) => setTimeout(r, 500))
  }

  return Response.json({
    ok: true,
    reviewer: aria.name,
    reviewed: results.length,
    results,
  })
}
