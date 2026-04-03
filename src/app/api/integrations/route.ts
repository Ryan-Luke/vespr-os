import { db } from "@/lib/db"
import { integrations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const all = await db.select().from(integrations)
  return Response.json(all)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [integration] = await db.insert(integrations).values({
    name: body.name,
    provider: body.provider,
    category: body.category,
    status: body.status || "connected",
    connectedAt: new Date(),
  }).returning()
  return Response.json(integration)
}

export async function PATCH(req: Request) {
  const { id, status } = await req.json()
  const [updated] = await db.update(integrations)
    .set({ status, connectedAt: status === "connected" ? new Date() : null })
    .where(eq(integrations.id, id))
    .returning()
  return Response.json(updated)
}
