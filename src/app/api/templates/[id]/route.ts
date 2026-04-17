import { withAuth } from "@/lib/auth/with-auth"
import { getTemplatePreview } from "@/lib/templates/engine"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await withAuth()
  const { id } = await params
  const preview = getTemplatePreview(id)

  if (!preview) {
    return Response.json({ error: "Template not found" }, { status: 404 })
  }

  return Response.json(preview)
}
