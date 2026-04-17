import { db } from "@/lib/db"
import { rosterUnlocks } from "@/lib/db/schema"
import { eq, isNull, and, desc } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const onlyUnacknowledged = url.searchParams.get("unacknowledged") === "true"

  const rows = onlyUnacknowledged
    ? await db.select().from(rosterUnlocks)
        .where(and(eq(rosterUnlocks.workspaceId, auth.workspace.id), isNull(rosterUnlocks.acknowledgedAt)))
        .orderBy(desc(rosterUnlocks.unlockedAt))
    : await db.select().from(rosterUnlocks)
        .where(eq(rosterUnlocks.workspaceId, auth.workspace.id))
        .orderBy(desc(rosterUnlocks.unlockedAt))

  return Response.json(rows)
}

export async function PATCH(req: Request) {
  const auth = await withAuth()
  const { id } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  await db.update(rosterUnlocks).set({ acknowledgedAt: new Date() }).where(and(eq(rosterUnlocks.id, id), eq(rosterUnlocks.workspaceId, auth.workspace.id)))
  return Response.json({ success: true })
}
