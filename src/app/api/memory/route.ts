import { db } from "@/lib/db"
import { agentMemories } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"

// Get memories for an agent (most important first)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")
  const type = url.searchParams.get("type")
  const limit = Number(url.searchParams.get("limit") ?? 20)

  if (!agentId) return Response.json({ error: "agentId required" }, { status: 400 })

  const memories = type
    ? await db.select().from(agentMemories)
        .where(and(eq(agentMemories.agentId, agentId), eq(agentMemories.memoryType, type)))
        .orderBy(desc(agentMemories.importance))
        .limit(limit)
    : await db.select().from(agentMemories)
        .where(eq(agentMemories.agentId, agentId))
        .orderBy(desc(agentMemories.importance))
        .limit(limit)

  return Response.json(memories)
}

// Store a new memory
export async function POST(req: Request) {
  const body = await req.json()
  const [memory] = await db.insert(agentMemories).values({
    agentId: body.agentId,
    memoryType: body.memoryType || "observation",
    content: body.content,
    importance: body.importance ?? 0.5,
    source: body.source || "system",
    relatedAgentId: body.relatedAgentId || null,
  }).returning()
  return Response.json(memory)
}
