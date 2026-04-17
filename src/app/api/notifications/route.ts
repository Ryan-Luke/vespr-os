import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

// GET — fetch unread notifications for the workspace
export async function GET() {
  const auth = await withAuth()

  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, auth.workspace.id),
        eq(notifications.read, false),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(50)

  return Response.json(rows)
}

// PATCH — mark notifications as read
export async function PATCH(req: Request) {
  const auth = await withAuth()
  const body = await req.json()
  const { ids } = body as { ids?: string[] }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "ids array required" }, { status: 400 })
  }

  // Mark each notification as read (only if it belongs to this workspace)
  for (const id of ids) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.workspaceId, auth.workspace.id),
        ),
      )
  }

  return Response.json({ ok: true, marked: ids.length })
}
