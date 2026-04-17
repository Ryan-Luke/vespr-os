import { db } from "@/lib/db"
import { tasks } from "@/lib/db/schema"
import { or, eq, and } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET() {
  const auth = await withAuth()
  const result = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, auth.workspace.id), or(eq(tasks.status, "todo"), eq(tasks.status, "review"))))

  return Response.json({ pending: result[0]?.pending ?? 0 })
}
