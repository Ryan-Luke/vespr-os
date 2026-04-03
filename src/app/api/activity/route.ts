import { db } from "@/lib/db"
import { activityLog } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

export async function GET() {
  const entries = await db
    .select()
    .from(activityLog)
    .orderBy(desc(activityLog.createdAt))
    .limit(50)
  return Response.json(entries)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [entry] = await db.insert(activityLog).values(body).returning()
  return Response.json(entry)
}
