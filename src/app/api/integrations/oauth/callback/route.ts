// GET /api/integrations/oauth/callback?code=xxx&state=yyy
//
// OAuth redirect handler. Exchanges the code for tokens using the
// stored PKCE verifier, encrypts the tokens, and saves them to the
// integrations table.

import { cookies } from "next/headers"
import { exchangeCode, encryptTokens, getOAuthConfig } from "@/lib/integrations/oauth"
import { saveCredentials } from "@/lib/integrations/credentials"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    const desc = url.searchParams.get("error_description") ?? error
    return new Response(
      renderCallbackHTML("error", `OAuth error: ${desc}`),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  if (!code || !state) {
    return new Response(
      renderCallbackHTML("error", "Missing code or state parameter"),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  // Retrieve and validate the OAuth state cookie
  const cookieStore = await cookies()
  const oauthStateCookie = cookieStore.get("oauth_state")?.value
  if (!oauthStateCookie) {
    return new Response(
      renderCallbackHTML("error", "OAuth session expired. Please try connecting again."),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  let oauthContext: {
    state: string
    codeVerifier: string
    providerKey: string
    workspaceId: string
  }
  try {
    oauthContext = JSON.parse(oauthStateCookie)
  } catch {
    return new Response(
      renderCallbackHTML("error", "Invalid OAuth session."),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  if (oauthContext.state !== state) {
    return new Response(
      renderCallbackHTML("error", "State mismatch. Possible CSRF attack. Please try again."),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  try {
    const config = getOAuthConfig(oauthContext.providerKey)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`
    const redirectUri = `${baseUrl}/api/integrations/oauth/callback`

    const tokens = await exchangeCode({
      config,
      code,
      codeVerifier: oauthContext.codeVerifier,
      redirectUri,
    })

    // Store encrypted tokens as credentials
    await saveCredentials({
      workspaceId: oauthContext.workspaceId,
      providerKey: oauthContext.providerKey,
      credentials: {
        oauth_tokens: encryptTokens(tokens),
        auth_type: "oauth",
      },
    })

    // Clean up the cookie
    cookieStore.delete("oauth_state")

    return new Response(
      renderCallbackHTML("success", `${oauthContext.providerKey} connected successfully!`),
      { headers: { "Content-Type": "text/html" } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange failed"
    return new Response(
      renderCallbackHTML("error", msg),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }
}

/**
 * Render a simple HTML page that communicates the result back to the
 * opener window. The integration picker UI listens for the postMessage.
 */
function renderCallbackHTML(status: "success" | "error", message: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Integration Connected</title></head>
<body>
  <h2>${status === "success" ? "Connected!" : "Connection Failed"}</h2>
  <p>${message}</p>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: "oauth_callback",
        status: "${status}",
        message: ${JSON.stringify(message)},
      }, window.location.origin);
      setTimeout(() => window.close(), 2000);
    }
  </script>
</body>
</html>`
}
