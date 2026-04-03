import { db } from "@/lib/db"
import { messages } from "@/lib/db/schema"
import { gte } from "drizzle-orm"
import { sql } from "drizzle-orm"

export async function GET() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(gte(messages.createdAt, oneHourAgo))

  return Response.json({ count: result[0]?.count ?? 0 })
}
