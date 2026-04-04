import { db } from "@/lib/db"
import { companyMemories } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const category = url.searchParams.get("category")
  const limit = Number(url.searchParams.get("limit") ?? 50)

  const memories = category
    ? await db.select().from(companyMemories)
        .where(eq(companyMemories.category, category))
        .orderBy(desc(companyMemories.importance))
        .limit(limit)
    : await db.select().from(companyMemories)
        .orderBy(desc(companyMemories.importance))
        .limit(limit)

  return Response.json(memories)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [memory] = await db.insert(companyMemories).values({
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

export async function DELETE(req: Request) {
  const { id } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  await db.delete(companyMemories).where(eq(companyMemories.id, id))
  return Response.json({ ok: true })
}
