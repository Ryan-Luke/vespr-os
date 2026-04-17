import { db } from "@/lib/db"
import { companyMemories } from "@/lib/db/schema"
import { desc, eq, and } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const category = url.searchParams.get("category")
  const limit = Number(url.searchParams.get("limit") ?? 50)

  const memories = category
    ? await db.select().from(companyMemories)
        .where(and(eq(companyMemories.workspaceId, auth.workspace.id), eq(companyMemories.category, category)))
        .orderBy(desc(companyMemories.importance))
        .limit(limit)
    : await db.select().from(companyMemories)
        .where(eq(companyMemories.workspaceId, auth.workspace.id))
        .orderBy(desc(companyMemories.importance))
        .limit(limit)

  return Response.json(memories)
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json()
  const [memory] = await db.insert(companyMemories).values({
    workspaceId: auth.workspace.id,
    category: body.category || "fact",
    title: body.title,
    content: body.content,
    importance: body.importance ?? 0.5,
    source: body.source || "user",
    sourceAgentId: body.sourceAgentId || null,
    tags: body.tags || [],
  }).returning()
  return Response.json(memory)
}

export async function PATCH(req: Request) {
  const auth = await withAuth()
  const { id, ...updates } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.title !== undefined) values.title = updates.title
  if (updates.content !== undefined) values.content = updates.content
  if (updates.category !== undefined) values.category = updates.category
  if (updates.importance !== undefined) values.importance = updates.importance
  if (updates.tags !== undefined) values.tags = updates.tags
  const [updated] = await db.update(companyMemories).set(values)
    .where(and(eq(companyMemories.id, id), eq(companyMemories.workspaceId, auth.workspace.id)))
    .returning()
  if (!updated) return Response.json({ error: "not found" }, { status: 404 })
  return Response.json(updated)
}

export async function DELETE(req: Request) {
  const auth = await withAuth()
  const { id } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  await db.delete(companyMemories).where(and(eq(companyMemories.id, id), eq(companyMemories.workspaceId, auth.workspace.id)))
  return Response.json({ ok: true })
}
