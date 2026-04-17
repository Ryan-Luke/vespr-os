import { db } from "@/lib/db"
import { workspaces, workspaceMembers } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { guardMinRole } from "@/lib/auth/rbac"
import { hydrateWorkspace } from "@/lib/templates/engine"
import { getTemplate, getTemplateForBusinessType } from "@/lib/templates"

export async function GET() {
  const auth = await withAuth()

  // Return only workspaces the user is a member of
  const memberRows = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, auth.user.id))

  const wsIds = memberRows.map((r) => r.workspaceId)
  if (wsIds.length === 0) {
    return Response.json([])
  }

  const all = await db.select({
    id: workspaces.id,
    name: workspaces.name,
    slug: workspaces.slug,
    icon: workspaces.icon,
    description: workspaces.description,
    businessType: workspaces.businessType,
    industry: workspaces.industry,
    website: workspaces.website,
    businessProfile: workspaces.businessProfile,
    ownerName: workspaces.ownerName,
    anthropicApiKey: workspaces.anthropicApiKey,
    currentPhaseKey: workspaces.currentPhaseKey,
    isActive: workspaces.isActive,
    isPublic: workspaces.isPublic,
    publicTagline: workspaces.publicTagline,
    createdAt: workspaces.createdAt,
  }).from(workspaces).where(inArray(workspaces.id, wsIds)).orderBy(workspaces.createdAt)

  // Strip the full API key — expose only a boolean and masked preview
  const sanitized = all.map(({ anthropicApiKey, ...rest }) => ({
    ...rest,
    hasAnthropicKey: !!anthropicApiKey,
    anthropicKeyPreview: anthropicApiKey
      ? `${anthropicApiKey.slice(0, 7)}...${anthropicApiKey.slice(-4)}`
      : null,
  }))

  return Response.json(sanitized)
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden
  const body = await req.json()

  // Handle hydration of an existing workspace (from onboarding)
  if (body._hydrateExisting) {
    const templateId = body.templateId
    const resolvedTemplateId = templateId ?? getTemplateForBusinessType("agency")?.id ?? null
    let hydrationResult = null
    if (resolvedTemplateId && getTemplate(resolvedTemplateId)) {
      hydrationResult = await hydrateWorkspace(body._hydrateExisting, resolvedTemplateId)
    }
    return Response.json({ workspace: { id: body._hydrateExisting }, hydration: hydrationResult })
  }

  const slug = (body.name || "workspace").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

  // 1. Create the workspace
  const [ws] = await db.insert(workspaces).values({
    name: body.name,
    slug,
    icon: body.icon || "\u{1F3E2}",
    description: body.description || null,
    businessType: body.businessType || "agency",
    industry: body.industry || null,
    website: body.website || null,
    businessProfile: body.businessProfile || {},
    ownerName: body.ownerName || null,
    anthropicApiKey: body.anthropicApiKey || null,
  }).returning()

  // 2. Add creator as owner of the new workspace
  await db.insert(workspaceMembers).values({
    userId: auth.user.id,
    workspaceId: ws.id,
    role: "owner",
  })

  // 3. Hydrate with template if provided
  // If templateId is given, use it directly. Otherwise, auto-match by businessType.
  let hydrationResult = null
  const templateId = body.templateId
  const resolvedTemplateId =
    templateId ??
    getTemplateForBusinessType(body.businessType || "agency")?.id ??
    null

  if (resolvedTemplateId && getTemplate(resolvedTemplateId)) {
    hydrationResult = await hydrateWorkspace(ws.id, resolvedTemplateId)
  }

  return Response.json({
    workspace: ws,
    hydration: hydrationResult,
  })
}
