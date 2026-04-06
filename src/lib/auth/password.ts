/**
 * Password hashing using PBKDF2-SHA256 via Web Crypto.
 * Works in both Node and Edge runtimes.
 *
 * Stored format: `${iterations}.${saltB64}.${hashB64}`
 */

const ITERATIONS = 100_000
const KEY_LENGTH_BITS = 256
const SALT_BYTES = 16

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveHash(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await deriveHash(password, salt, ITERATIONS)
  return `${ITERATIONS}.${toBase64(salt)}.${toBase64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(".")
  if (parts.length !== 3) return false
  const iterations = parseInt(parts[0], 10)
  if (!Number.isFinite(iterations) || iterations < 1000) return false
  const salt = fromBase64(parts[1])
  const expected = fromBase64(parts[2])
  const actual = await deriveHash(password, salt, iterations)
  if (actual.length !== expected.length) return false
  // Constant-time comparison
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}
