import { describe, it, expect } from "vitest"
import { encryptJson, decryptJson } from "./crypto"

describe("crypto (AES-256-GCM)", () => {
  it("encrypts and decrypts a string round-trip", () => {
    const original = "hello world"
    const encrypted = encryptJson(original)
    const decrypted = decryptJson<string>(encrypted)
    expect(decrypted).toBe(original)
  })

  it("encrypts and decrypts an object round-trip", () => {
    const original = { apiKey: "sk-test-123", secret: "my-secret" }
    const encrypted = encryptJson(original)
    const decrypted = decryptJson<typeof original>(encrypted)
    expect(decrypted).toEqual(original)
  })

  it("encrypts and decrypts nested objects", () => {
    const original = {
      credentials: {
        token: "abc",
        refresh: "xyz",
        nested: { deep: true },
      },
      meta: [1, 2, 3],
    }
    const encrypted = encryptJson(original)
    const decrypted = decryptJson(encrypted)
    expect(decrypted).toEqual(original)
  })

  it("encrypts and decrypts null and boolean values", () => {
    expect(decryptJson(encryptJson(null))).toBeNull()
    expect(decryptJson(encryptJson(true))).toBe(true)
    expect(decryptJson(encryptJson(false))).toBe(false)
  })

  it("produces different ciphertext for same input (random IV)", () => {
    const payload = { key: "same-data" }
    const a = encryptJson(payload)
    const b = encryptJson(payload)
    expect(a).not.toBe(b) // different IVs → different output
    // But both decrypt to the same thing
    expect(decryptJson(a)).toEqual(payload)
    expect(decryptJson(b)).toEqual(payload)
  })

  it("returns a base64 string", () => {
    const encrypted = encryptJson("test")
    // Base64 regex: alphanumeric, +, /, and optional = padding
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptJson("sensitive data")
    // Flip a byte in the ciphertext portion
    const buf = Buffer.from(encrypted, "base64")
    buf[buf.length - 1] ^= 0xff
    const tampered = buf.toString("base64")
    expect(() => decryptJson(tampered)).toThrow()
  })

  it("throws on truncated payload", () => {
    const encrypted = encryptJson("test")
    // Truncate to just a few bytes — too short to contain IV + tag
    const truncated = Buffer.from(encrypted, "base64").subarray(0, 10).toString("base64")
    expect(() => decryptJson(truncated)).toThrow()
  })

  it("handles empty string payload", () => {
    const encrypted = encryptJson("")
    const decrypted = decryptJson<string>(encrypted)
    expect(decrypted).toBe("")
  })

  it("handles large payloads", () => {
    const large = { data: "x".repeat(10000) }
    const encrypted = encryptJson(large)
    const decrypted = decryptJson<typeof large>(encrypted)
    expect(decrypted.data.length).toBe(10000)
  })
})
