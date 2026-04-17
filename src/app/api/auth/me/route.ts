import { withAuth } from "@/lib/auth/with-auth"

export async function GET() {
  const auth = await withAuth()
  return Response.json({
    user: auth.user,
    workspace: { id: auth.workspace.id, name: auth.workspace.name, slug: auth.workspace.slug },
    role: auth.role,
  })
}
