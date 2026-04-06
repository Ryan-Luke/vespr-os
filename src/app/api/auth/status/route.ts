import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { sql } from "drizzle-orm"

/**
 * Public endpoint — returns whether any users exist yet.
 * Used by /login to decide between "Sign in" and first-run "Create owner account".
 */
export async function GET() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
  return Response.json({ hasUsers: count > 0 })
}
