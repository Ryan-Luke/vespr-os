// OAuth2 PKCE flow helpers for integration providers that require OAuth
// instead of simple API key auth.
//
// Flow:
// 1. User clicks "Connect" for an OAuth provider
// 2. Frontend calls GET /api/integrations/oauth/start?provider=xxx
// 3. Server generates PKCE verifier + challenge, stores verifier in session,
//    returns redirect URL to provider's authorize endpoint
// 4. User authorizes in provider's UI
// 5. Provider redirects to /api/integrations/oauth/callback?code=xxx&state=yyy
// 6. Server exchanges code for tokens using the stored PKCE verifier
// 7. Tokens are encrypted and stored in the integrations table
// 8. Automatic token refresh when access_token expires

import { randomBytes, createHash } from "node:crypto"
import { encryptJson, decryptJson } from "./crypto"

export interface OAuthProviderConfig {
  providerKey: string
  authorizeUrl: string
  tokenUrl: string
  clientId: string
  clientSecret?: string    // Some PKCE flows don't need a secret
  scopes: string[]
  extraAuthParams?: Record<string, string>
}

export interface OAuthTokens {
  access_token: string
  refresh_token?: string
  expires_at?: number       // Unix timestamp in seconds
  token_type: string
  scope?: string
}

// ── PKCE Helpers ─────────────────────────────────────────

/**
 * Generate a random code verifier for PKCE (43-128 characters, URL-safe).
 */
export function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9\-._~]/g, "")
    .slice(0, 64)
}

/**
 * Compute the S256 code challenge from a verifier.
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

/**
 * Generate a random state parameter to prevent CSRF.
 */
export function generateState(): string {
  return randomBytes(16).toString("hex")
}

// ── Auth URL ─────────────────────────────────────────────

export interface StartOAuthInput {
  config: OAuthProviderConfig
  redirectUri: string
  workspaceId: string
}

export interface StartOAuthResult {
  authorizationUrl: string
  state: string
  codeVerifier: string     // Must be stored server-side (session/cookie)
}

export function generateAuthUrl(input: StartOAuthInput): StartOAuthResult {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = generateState()

  const params = new URLSearchParams({
    client_id: input.config.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: input.config.scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    ...input.config.extraAuthParams,
  })

  const authorizationUrl = `${input.config.authorizeUrl}?${params.toString()}`

  return {
    authorizationUrl,
    state,
    codeVerifier,
  }
}

// ── Token Exchange ───────────────────────────────────────

export interface ExchangeCodeInput {
  config: OAuthProviderConfig
  code: string
  codeVerifier: string
  redirectUri: string
}

export async function exchangeCode(input: ExchangeCodeInput): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.config.clientId,
    code_verifier: input.codeVerifier,
  })

  if (input.config.clientSecret) {
    body.set("client_secret", input.config.clientSecret)
  }

  const res = await fetch(input.config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  const payload = await res.json()
  if (!res.ok) {
    const msg = (payload as { error_description?: string; error?: string })?.error_description ??
      (payload as { error?: string })?.error ?? `OAuth token exchange failed (${res.status})`
    throw new Error(msg)
  }

  const tokens = payload as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type: string
    scope?: string
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_in
      ? Math.floor(Date.now() / 1000) + tokens.expires_in
      : undefined,
    token_type: tokens.token_type ?? "Bearer",
    scope: tokens.scope,
  }
}

// ── Token Refresh ────────────────────────────────────────

export interface RefreshTokenInput {
  config: OAuthProviderConfig
  refreshToken: string
}

export async function refreshToken(input: RefreshTokenInput): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    client_id: input.config.clientId,
  })

  if (input.config.clientSecret) {
    body.set("client_secret", input.config.clientSecret)
  }

  const res = await fetch(input.config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  const payload = await res.json()
  if (!res.ok) {
    const msg = (payload as { error_description?: string })?.error_description ??
      `OAuth token refresh failed (${res.status})`
    throw new Error(msg)
  }

  const tokens = payload as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type: string
    scope?: string
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? input.refreshToken, // Keep old refresh token if not returned
    expires_at: tokens.expires_in
      ? Math.floor(Date.now() / 1000) + tokens.expires_in
      : undefined,
    token_type: tokens.token_type ?? "Bearer",
    scope: tokens.scope,
  }
}

// ── Token Storage ────────────────────────────────────────

export function encryptTokens(tokens: OAuthTokens): string {
  return encryptJson(tokens)
}

export function decryptTokens(encrypted: string): OAuthTokens {
  return decryptJson<OAuthTokens>(encrypted)
}

/**
 * Check if an access token is expired (or expires within 5 minutes).
 */
export function isTokenExpired(tokens: OAuthTokens): boolean {
  if (!tokens.expires_at) return false // No expiry info, assume valid
  const bufferSeconds = 5 * 60 // Refresh 5 minutes before expiry
  return Math.floor(Date.now() / 1000) >= tokens.expires_at - bufferSeconds
}

// ── Provider Configs ─────────────────────────────────────

export const OAUTH_CONFIGS: Record<string, Omit<OAuthProviderConfig, "clientId" | "clientSecret"> & {
  clientIdEnv: string
  clientSecretEnv?: string
}> = {
  google_docs: {
    providerKey: "google_docs",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
    ],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
}

/**
 * Build a full OAuthProviderConfig from environment variables.
 * Throws if required env vars are missing.
 */
export function getOAuthConfig(providerKey: string): OAuthProviderConfig {
  const template = OAUTH_CONFIGS[providerKey]
  if (!template) {
    throw new Error(`No OAuth config registered for provider: ${providerKey}`)
  }
  const clientId = process.env[template.clientIdEnv]
  if (!clientId) {
    throw new Error(`Missing env var ${template.clientIdEnv} for OAuth provider ${providerKey}`)
  }
  const clientSecret = template.clientSecretEnv
    ? process.env[template.clientSecretEnv]
    : undefined

  return {
    providerKey: template.providerKey,
    authorizeUrl: template.authorizeUrl,
    tokenUrl: template.tokenUrl,
    scopes: template.scopes,
    clientId,
    clientSecret,
    extraAuthParams: template.extraAuthParams,
  }
}
