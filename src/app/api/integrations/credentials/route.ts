import {
  saveCredentials,
  listIntegrations,
  disconnectIntegration,
} from "@/lib/integrations/credentials"
import { withAuth } from "@/lib/auth/with-auth"
import { guardMinRole } from "@/lib/auth/rbac"
import { checkLimit } from "@/lib/billing/plan-limits"

// POST /api/integrations/credentials
// Body: { providerKey, credentials: { [field]: value } }
// Encrypts and stores credentials. Response never includes the plaintext.
export async function POST(req: Request) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden

  // Check plan limits before connecting integration
  const limitCheck = await checkLimit(auth.workspace.id, "connect_integration")
  if (!limitCheck.allowed) {
    return Response.json({
      error: limitCheck.reason,
      upgradeRequired: limitCheck.upgradeRequired,
      currentCount: limitCheck.currentCount,
      limit: limitCheck.limit,
    }, { status: 403 })
  }

  try {
    const body = await req.json() as {
      providerKey?: string
      credentials?: Record<string, string>
    }
    if (!body.providerKey || !body.credentials) {
      return Response.json(
        { error: "providerKey and credentials are required" },
        { status: 400 },
      )
    }
    const stored = await saveCredentials({
      workspaceId: auth.workspace.id,
      providerKey: body.providerKey,
      credentials: body.credentials,
    })
    return Response.json({ integration: stored })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 },
    )
  }
}

// GET /api/integrations/credentials
// Lists connected integrations for the workspace. Never returns credentials.
export async function GET() {
  const auth = await withAuth()
  const list = await listIntegrations(auth.workspace.id)
  return Response.json({ integrations: list })
}

// DELETE /api/integrations/credentials
// Body: { providerKey }
export async function DELETE(req: Request) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden
  const body = await req.json() as { providerKey?: string }
  if (!body.providerKey) {
    return Response.json(
      { error: "providerKey is required" },
      { status: 400 },
    )
  }
  await disconnectIntegration(auth.workspace.id, body.providerKey)
  return Response.json({ ok: true })
}
