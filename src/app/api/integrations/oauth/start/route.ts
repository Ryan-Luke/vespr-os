// GET /api/integrations/oauth/start?provider=xxx&workspaceId=yyy
//
// Generates PKCE challenge, builds the authorization URL, and returns
// it along with a temporary state cookie so the callback can verify it.

import { cookies } from "next/headers"
import { generateAuthUrl, getOAuthConfig } from "@/lib/integrations/oauth"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const providerKey = url.searchParams.get("provider")
  const workspaceId = url.searchParams.get("workspaceId")

  if (!providerKey || !workspaceId) {
    return Response.json(
      { error: "provider and workspaceId are required" },
      { status: 400 },
    )
  }

  try {
    const config = getOAuthConfig(providerKey)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`
    const redirectUri = `${baseUrl}/api/integrations/oauth/callback`

    const result = generateAuthUrl({
      config,
      redirectUri,
      workspaceId,
    })

    // Store PKCE verifier and context in an encrypted HTTP-only cookie.
    // The cookie survives the redirect to the OAuth provider and back.
    const cookieStore = await cookies()
    const oauthState = JSON.stringify({
      state: result.state,
      codeVerifier: result.codeVerifier,
      providerKey,
      workspaceId,
    })

    cookieStore.set("oauth_state", oauthState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    })

    return Response.json({
      authorizationUrl: result.authorizationUrl,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to start OAuth flow" },
      { status: 400 },
    )
  }
}
