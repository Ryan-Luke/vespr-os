import { db } from "@/lib/db"
import { messages } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  await withAuth()
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return Response.json({ error: "id required" }, { status: 400 })

  const [msg] = await db.select().from(messages).where(eq(messages.id, id)).limit(1)
  if (!msg) return Response.json({ error: "Message not found" }, { status: 404 })

  return Response.json(msg)
}
