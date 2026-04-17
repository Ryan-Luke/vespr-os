/**
 * HMAC-signed stateless session cookies using Web Crypto (Node + Edge).
 *
 * Cookie format: `${payloadB64url}.${signatureB64url}`
 * Payload JSON: { userId, role, exp } where exp is a unix seconds timestamp.
 *
 * Verification recomputes the HMAC and checks expiry. No DB round-trip.
 * Server-forced logout would require a session table — not done yet, acceptable
 * for the current single-company deployment model.
 */

const COOKIE_NAME = "bos_session"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

export interface SessionPayload {
  userId: string
  workspaceId: string
  role: string // workspace-specific role from workspace_members
  exp: number // unix seconds
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    // Dev fallback. Surface a warning but don't crash in dev.
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET env var is required in production (min 16 chars)")
    }
    return "dev-only-insecure-secret-please-set-AUTH_SECRET"
  }
  return secret
}

function b64urlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

async function sign(payloadB64: string): Promise<string> {
  const key = await importHmacKey()
  const enc = new TextEncoder()
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64))
  return b64urlEncode(new Uint8Array(sig))
}

export async function createSessionCookie(userId: string, workspaceId: string, role: string): Promise<string> {
  const payload: SessionPayload = {
    userId,
    workspaceId,
    role,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  }
  const enc = new TextEncoder()
  const payloadB64 = b64urlEncode(enc.encode(JSON.stringify(payload)))
  const signature = await sign(payloadB64)
  return `${payloadB64}.${signature}`
}

export async function verifySessionCookie(cookie: string | undefined): Promise<SessionPayload | null> {
  if (!cookie) return null
  const parts = cookie.split(".")
  if (parts.length !== 2) return null
  const [payloadB64, signature] = parts

  const expected = await sign(payloadB64)
  // Constant-time string compare (lengths already match for same-secret HMAC output)
  if (expected.length !== signature.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  if (diff !== 0) return null

  try {
    const json = new TextDecoder().decode(b64urlDecode(payloadB64))
    const payload = JSON.parse(json) as SessionPayload
    if (typeof payload.userId !== "string" || typeof payload.workspaceId !== "string" || typeof payload.role !== "string") return null
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME
export const SESSION_MAX_AGE = MAX_AGE_SECONDS
