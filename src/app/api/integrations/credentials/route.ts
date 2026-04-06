import {
  saveCredentials,
  listIntegrations,
  disconnectIntegration,
} from "@/lib/integrations/credentials"

// POST /api/integrations/credentials
// Body: { workspaceId, providerKey, credentials: { [field]: value } }
// Encrypts and stores credentials. Response never includes the plaintext.
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      workspaceId?: string
      providerKey?: string
      credentials?: Record<string, string>
    }
    if (!body.workspaceId || !body.providerKey || !body.credentials) {
      return Response.json(
        { error: "workspaceId, providerKey, and credentials are required" },
        { status: 400 },
      )
    }
    const stored = await saveCredentials({
      workspaceId: body.workspaceId,
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

// GET /api/integrations/credentials?workspaceId=XXX
// Lists connected integrations for a workspace. Never returns credentials.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId")
  if (!workspaceId) {
    return Response.json({ error: "workspaceId required" }, { status: 400 })
  }
  const list = await listIntegrations(workspaceId)
  return Response.json({ integrations: list })
}

// DELETE /api/integrations/credentials
// Body: { workspaceId, providerKey }
export async function DELETE(req: Request) {
  const body = await req.json() as { workspaceId?: string; providerKey?: string }
  if (!body.workspaceId || !body.providerKey) {
    return Response.json(
      { error: "workspaceId and providerKey are required" },
      { status: 400 },
    )
  }
  await disconnectIntegration(body.workspaceId, body.providerKey)
  return Response.json({ ok: true })
}
