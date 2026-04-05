import { db } from "@/lib/db"
import { workspaces } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.icon !== undefined) updates.icon = body.icon
  if (body.description !== undefined) updates.description = body.description
  if (body.businessType !== undefined) updates.businessType = body.businessType
  if (body.industry !== undefined) updates.industry = body.industry
  if (body.website !== undefined) updates.website = body.website
  if (body.businessProfile !== undefined) updates.businessProfile = body.businessProfile
  if (body.isPublic !== undefined) updates.isPublic = body.isPublic
  if (body.publicTagline !== undefined) updates.publicTagline = body.publicTagline

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 })
  }

  const [updated] = await db.update(workspaces).set(updates).where(eq(workspaces.id, workspaceId)).returning()
  return Response.json(updated)
}
