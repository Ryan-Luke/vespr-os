import { db } from "@/lib/db"
import { activityLog } from "@/lib/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
  const offset = parseInt(url.searchParams.get("offset") || "0")

  const entries = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.workspaceId, auth.workspace.id))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLog)
    .where(eq(activityLog.workspaceId, auth.workspace.id))

  return Response.json({ entries, total: count, limit, offset })
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json()
  const [entry] = await db.insert(activityLog).values({ ...body, workspaceId: auth.workspace.id }).returning()
  return Response.json(entry)
}
