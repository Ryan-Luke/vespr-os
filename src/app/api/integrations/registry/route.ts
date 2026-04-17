import { PROVIDERS } from "@/lib/integrations/registry"
import { withAuth } from "@/lib/auth/with-auth"

// GET /api/integrations/registry
// Returns the public registry metadata (provider list + required fields).
// No secrets. Used by the picker UI to render credential forms.
export async function GET() {
  await withAuth()
  return Response.json({ providers: PROVIDERS })
}
