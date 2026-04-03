import { db } from "@/lib/db"
import { decisionLog } from "@/lib/db/schema"
import { desc, eq, sql } from "drizzle-orm"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")
  const limit = Number(url.searchParams.get("limit") ?? 50)
  const offset = Number(url.searchParams.get("offset") ?? 0)

  const entries = agentId
    ? await db.select().from(decisionLog).where(eq(decisionLog.agentId, agentId)).orderBy(desc(decisionLog.createdAt)).limit(limit).offset(offset)
    : await db.select().from(decisionLog).orderBy(desc(decisionLog.createdAt)).limit(limit).offset(offset)
  return Response.json(entries)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [entry] = await db.insert(decisionLog).values({
    agentId: body.agentId || null,
    agentName: body.agentName,
    actionType: body.actionType,
    title: body.title,
    description: body.description,
    reasoning: body.reasoning || null,
    outcome: body.outcome || null,
    metadata: body.metadata || {},
  }).returning()

  return Response.json(entry)
}
