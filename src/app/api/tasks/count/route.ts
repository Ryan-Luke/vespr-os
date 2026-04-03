import { db } from "@/lib/db"
import { tasks } from "@/lib/db/schema"
import { or, eq } from "drizzle-orm"
import { sql } from "drizzle-orm"

export async function GET() {
  const result = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(tasks)
    .where(or(eq(tasks.status, "todo"), eq(tasks.status, "review")))

  return Response.json({ pending: result[0]?.pending ?? 0 })
}
