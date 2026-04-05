import { db } from "@/lib/db"
import { agents, decisionLog, trophyEvents } from "@/lib/db/schema"
import { and, eq, isNull } from "drizzle-orm"

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

  // Get active agents to review (exclude Aria herself + paused agents)
  const allAgents = await db.select().from(agents)
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
      const res = await fetch(new URL("/api/performance-review", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      })
      if (res.ok) {
        const { review } = await res.json()
        results.push({ agentName: agent.name, status: "reviewed", rating: review?.rating })

        // Log in decision log with reasoning
        await db.insert(decisionLog).values({
          agentId: aria.id,
          agentName: aria.name,
          actionType: "decision_made",
          title: `Weekly review: ${agent.name}`,
          description: `Completed performance review. Rating: ${review?.rating}/5.`,
          reasoning: review?.summary || "Weekly review cadence per QA & People Ops mandate.",
          outcome: `Review posted in #team-leaders with strengths, improvements, and recommendations.`,
        })

        // Top performers get a trophy event
        if (review?.rating >= 4) {
          await db.insert(trophyEvents).values({
            agentId: agent.id,
            agentName: agent.name,
            type: "milestone",
            title: `${agent.name} passed weekly review with ${review.rating}/5`,
            description: review.summary,
            icon: "⭐",
          })
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
