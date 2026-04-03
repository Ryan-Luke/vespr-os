import { db } from "@/lib/db"
import { agentFeedback } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export async function POST(req: Request) {
  const { agentId, messageId, rating, correction } = await req.json() as {
    agentId: string
    messageId?: string
    rating: "positive" | "negative"
    correction?: string
  }

  const [entry] = await db.insert(agentFeedback).values({
    agentId,
    messageId: messageId || null,
    rating,
    correction: correction || null,
  }).returning()

  return Response.json(entry)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")
  if (!agentId) return Response.json({ error: "agentId required" }, { status: 400 })

  const stats = await db
    .select({
      rating: agentFeedback.rating,
      count: sql<number>`count(*)`,
    })
    .from(agentFeedback)
    .where(eq(agentFeedback.agentId, agentId))
    .groupBy(agentFeedback.rating)

  const positive = Number(stats.find((s) => s.rating === "positive")?.count ?? 0)
  const negative = Number(stats.find((s) => s.rating === "negative")?.count ?? 0)

  return Response.json({ positive, negative, total: positive + negative })
}
