import { db } from "@/lib/db"
import { rosterUnlocks } from "@/lib/db/schema"
import { eq, isNull, and, desc } from "drizzle-orm"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId")
  const onlyUnacknowledged = url.searchParams.get("unacknowledged") === "true"

  let rows
  if (workspaceId && onlyUnacknowledged) {
    rows = await db.select().from(rosterUnlocks)
      .where(and(eq(rosterUnlocks.workspaceId, workspaceId), isNull(rosterUnlocks.acknowledgedAt)))
      .orderBy(desc(rosterUnlocks.unlockedAt))
  } else if (workspaceId) {
    rows = await db.select().from(rosterUnlocks)
      .where(eq(rosterUnlocks.workspaceId, workspaceId))
      .orderBy(desc(rosterUnlocks.unlockedAt))
  } else if (onlyUnacknowledged) {
    rows = await db.select().from(rosterUnlocks)
      .where(isNull(rosterUnlocks.acknowledgedAt))
      .orderBy(desc(rosterUnlocks.unlockedAt))
  } else {
    rows = await db.select().from(rosterUnlocks).orderBy(desc(rosterUnlocks.unlockedAt))
  }

  return Response.json(rows)
}

export async function PATCH(req: Request) {
  const { id } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  await db.update(rosterUnlocks).set({ acknowledgedAt: new Date() }).where(eq(rosterUnlocks.id, id))
  return Response.json({ success: true })
}
