import { db } from "@/lib/db"
import { agentSops } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  await withAuth()
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")

  if (!agentId) return Response.json({ error: "agentId required" }, { status: 400 })

  const sops = await db.select().from(agentSops)
    .where(eq(agentSops.agentId, agentId))
    .orderBy(agentSops.sortOrder)

  return Response.json(sops)
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json()
  const [newSop] = await db.insert(agentSops).values({
    workspaceId: auth.workspace.id,
    agentId: body.agentId,
    title: body.title,
    content: body.content,
    category: body.category || "general",
    sortOrder: body.sortOrder || 0,
  }).returning()
  return Response.json(newSop)
}

export async function PATCH(req: Request) {
  const auth = await withAuth()
  const { id, feedback, ...updates } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })

  // Handle feedback increment (SOP compounding)
  if (feedback === "positive" || feedback === "negative") {
    const col = feedback === "positive" ? agentSops.positiveFeedback : agentSops.negativeFeedback
    const [updated] = await db.update(agentSops)
      .set({ [feedback === "positive" ? "positiveFeedback" : "negativeFeedback"]: sql`${col} + 1` })
      .where(and(eq(agentSops.id, id), eq(agentSops.workspaceId, auth.workspace.id)))
      .returning()
    return Response.json(updated)
  }

  // Auto-increment version when content changes and no explicit version provided
  if (updates.content && !updates.version) {
    const [current] = await db.select({ version: agentSops.version }).from(agentSops).where(and(eq(agentSops.id, id), eq(agentSops.workspaceId, auth.workspace.id))).limit(1)
    if (current) updates.version = (current.version ?? 1) + 1
  }

  const [updated] = await db.update(agentSops)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(agentSops.id, id), eq(agentSops.workspaceId, auth.workspace.id)))
    .returning()

  return Response.json(updated)
}

export async function DELETE(req: Request) {
  const auth = await withAuth()
  const { id } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  await db.delete(agentSops).where(and(eq(agentSops.id, id), eq(agentSops.workspaceId, auth.workspace.id)))
  return Response.json({ ok: true })
}
