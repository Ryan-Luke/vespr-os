// AES-256-GCM encryption for integration credentials.
//
// Why GCM: authenticated encryption. If a row gets tampered with, decrypt
// throws instead of returning garbage. Standard choice for at-rest secrets.
//
// Key comes from INTEGRATION_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
// Boot will refuse to start if the key is missing, so production never runs
// without it.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGO = "aes-256-gcm"
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const hex = process.env.INTEGRATION_ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY is not set. Generate a 32-byte hex key (64 chars) and add it to .env.local.",
    )
  }
  if (hex.length !== 64) {
    throw new Error(
      `INTEGRATION_ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes). Got ${hex.length} chars.`,
    )
  }
  return Buffer.from(hex, "hex")
}

/**
 * Encrypt a JSON-serializable payload. Returns a base64 string combining
 * iv + authTag + ciphertext for single-column storage.
 */
export function encryptJson(payload: unknown): string {
  const key = getKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8")
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64")
}

/** Decrypt a payload produced by encryptJson. Throws on tamper. */
export function decryptJson<T = unknown>(encoded: string): T {
  const key = getKey()
  const buf = Buffer.from(encoded, "base64")
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Encrypted payload is too short to decrypt.")
  }
  const iv = buf.subarray(0, IV_LEN)
  const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(plaintext.toString("utf8")) as T
}
