import { db } from "@/lib/db"
import { integrations } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { guardMinRole } from "@/lib/auth/rbac"

export async function GET() {
  const auth = await withAuth()
  const all = await db.select().from(integrations).where(eq(integrations.workspaceId, auth.workspace.id))
  return Response.json(all)
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden
  const body = await req.json()
  const [integration] = await db.insert(integrations).values({
    workspaceId: auth.workspace.id,
    name: body.name,
    provider: body.provider,
    category: body.category,
    status: body.status || "connected",
    connectedAt: new Date(),
  }).returning()
  return Response.json(integration)
}

export async function PATCH(req: Request) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden
  const { id, status } = await req.json()
  const [updated] = await db.update(integrations)
    .set({ status, connectedAt: status === "connected" ? new Date() : null })
    .where(and(eq(integrations.id, id), eq(integrations.workspaceId, auth.workspace.id)))
    .returning()
  return Response.json(updated)
}
