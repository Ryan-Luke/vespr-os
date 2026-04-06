import { PROVIDERS } from "@/lib/integrations/registry"

// GET /api/integrations/registry
// Returns the public registry metadata (provider list + required fields).
// No secrets. Used by the picker UI to render credential forms.
export async function GET() {
  return Response.json({ providers: PROVIDERS })
}
