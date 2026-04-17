import { db } from "@/lib/db"
import { workspaces } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { guardMinRole } from "@/lib/auth/rbac"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await withAuth()
  const { workspaceId } = await params

  if (workspaceId !== auth.workspace.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const [ws] = await db.select().from(workspaces)
    .where(eq(workspaces.id, workspaceId)).limit(1)

  if (!ws) return Response.json({ error: "Not found" }, { status: 404 })

  // Strip API key from response
  const { anthropicApiKey, ...safe } = ws
  return Response.json({
    ...safe,
    hasAnthropicKey: !!anthropicApiKey,
    anthropicKeyPreview: anthropicApiKey ? anthropicApiKey.slice(0, 10) + "..." : null,
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden
  const { workspaceId } = await params

  // Ensure the user is modifying their own workspace
  if (workspaceId !== auth.workspace.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) {
    updates.name = body.name
    updates.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  }
  if (body.icon !== undefined) updates.icon = body.icon
  if (body.description !== undefined) updates.description = body.description
  if (body.businessType !== undefined) updates.businessType = body.businessType
  if (body.industry !== undefined) updates.industry = body.industry
  if (body.website !== undefined) updates.website = body.website
  if (body.businessProfile !== undefined) updates.businessProfile = body.businessProfile
  if (body.isPublic !== undefined) updates.isPublic = body.isPublic
  if (body.publicTagline !== undefined) updates.publicTagline = body.publicTagline
  if (body.anthropicApiKey !== undefined) updates.anthropicApiKey = body.anthropicApiKey
  if (body.ownerName !== undefined) updates.ownerName = body.ownerName

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 })
  }

  const [updated] = await db.update(workspaces).set(updates).where(eq(workspaces.id, workspaceId)).returning()

  // Strip the full API key from the response
  const { anthropicApiKey, ...sanitized } = updated
  return Response.json({
    ...sanitized,
    hasAnthropicKey: !!anthropicApiKey,
    anthropicKeyPreview: anthropicApiKey
      ? `${anthropicApiKey.slice(0, 7)}...${anthropicApiKey.slice(-4)}`
      : null,
  })
}
