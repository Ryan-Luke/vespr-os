import { db } from "@/lib/db"
import { tasks } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const allTasks = await db.select().from(tasks).orderBy(tasks.createdAt)
  return Response.json(allTasks)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [newTask] = await db.insert(tasks).values(body).returning()
  return Response.json(newTask)
}

export async function PATCH(req: Request) {
  const { id, ...updates } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning()

  return Response.json(updated)
}
