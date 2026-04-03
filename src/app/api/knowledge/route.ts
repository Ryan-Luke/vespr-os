import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { knowledgeEntries } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const entries = await db
    .select()
    .from(knowledgeEntries)
    .orderBy(knowledgeEntries.updatedAt)
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const [entry] = await db
    .insert(knowledgeEntries)
    .values({
      title: body.title,
      content: body.content,
      category: body.category || "business",
      tags: body.tags || [],
      linkedEntries: body.linkedEntries || [],
      createdByAgentId: body.createdByAgentId || null,
      createdByName: body.createdByName || "You",
    })
    .returning()
  return NextResponse.json(entry, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.title !== undefined) values.title = updates.title
  if (updates.content !== undefined) values.content = updates.content
  if (updates.category !== undefined) values.category = updates.category
  if (updates.tags !== undefined) values.tags = updates.tags
  if (updates.linkedEntries !== undefined) values.linkedEntries = updates.linkedEntries
  if (updates.createdByName !== undefined) values.createdByName = updates.createdByName
  if (updates.createdByAgentId !== undefined) values.createdByAgentId = updates.createdByAgentId

  const [entry] = await db
    .update(knowledgeEntries)
    .set(values)
    .where(eq(knowledgeEntries.id, id))
    .returning()
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(entry)
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const id = body.id
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  await db.delete(knowledgeEntries).where(eq(knowledgeEntries.id, id))
  return NextResponse.json({ ok: true })
}
