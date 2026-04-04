import { db } from "@/lib/db"
import { agentSops } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")

  if (!agentId) return Response.json({ error: "agentId required" }, { status: 400 })

  const sops = await db.select().from(agentSops)
    .where(eq(agentSops.agentId, agentId))
    .orderBy(agentSops.sortOrder)

  return Response.json(sops)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [newSop] = await db.insert(agentSops).values({
    agentId: body.agentId,
    title: body.title,
    content: body.content,
    category: body.category || "general",
    sortOrder: body.sortOrder || 0,
  }).returning()
  return Response.json(newSop)
}

export async function PATCH(req: Request) {
  const { id, feedback, ...updates } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })

  // Handle feedback increment (SOP compounding)
  if (feedback === "positive" || feedback === "negative") {
    const col = feedback === "positive" ? agentSops.positiveFeedback : agentSops.negativeFeedback
    const [updated] = await db.update(agentSops)
      .set({ [feedback === "positive" ? "positiveFeedback" : "negativeFeedback"]: sql`${col} + 1` })
      .where(eq(agentSops.id, id))
      .returning()
    return Response.json(updated)
  }

  const [updated] = await db.update(agentSops)
    .set({ ...updates, updatedAt: new Date(), version: updates.version })
    .where(eq(agentSops.id, id))
    .returning()

  return Response.json(updated)
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  await db.delete(agentSops).where(eq(agentSops.id, id))
  return Response.json({ ok: true })
}
