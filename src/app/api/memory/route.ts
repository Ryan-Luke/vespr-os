import { db } from "@/lib/db"
import { agentMemories } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

// Get memories for an agent (most important first)
export async function GET(req: Request) {
  const auth = await withAuth()
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
  const auth = await withAuth()
  const body = await req.json()
  const [memory] = await db.insert(agentMemories).values({
    workspaceId: auth.workspace.id,
    agentId: body.agentId,
    memoryType: body.memoryType || "observation",
    content: body.content,
    importance: body.importance ?? 0.5,
    source: body.source || "system",
    relatedAgentId: body.relatedAgentId || null,
  }).returning()
  return Response.json(memory)
}

// Update memory importance or content
export async function PATCH(req: Request) {
  const auth = await withAuth()
  const { id, ...updates } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  const values: Record<string, unknown> = {}
  if (updates.content !== undefined) values.content = updates.content
  if (updates.importance !== undefined) values.importance = updates.importance
  if (updates.memoryType !== undefined) values.memoryType = updates.memoryType
  const [updated] = await db.update(agentMemories).set(values)
    .where(and(eq(agentMemories.id, id), eq(agentMemories.workspaceId, auth.workspace.id)))
    .returning()
  if (!updated) return Response.json({ error: "not found" }, { status: 404 })
  return Response.json(updated)
}

// Delete a memory
export async function DELETE(req: Request) {
  const auth = await withAuth()
  const { id } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  await db.delete(agentMemories).where(and(eq(agentMemories.id, id), eq(agentMemories.workspaceId, auth.workspace.id)))
  return Response.json({ ok: true })
}
