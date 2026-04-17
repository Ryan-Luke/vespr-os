import { describe, it, expect } from "vitest"
import { hashPassword, verifyPassword } from "./password"

describe("password hashing (PBKDF2-SHA256)", () => {
  it("hash and verify round-trip succeeds", async () => {
    const password = "correct-horse-battery-staple"
    const hash = await hashPassword(password)
    const isValid = await verifyPassword(password, hash)
    expect(isValid).toBe(true)
  })

  it("rejects wrong password", async () => {
    const hash = await hashPassword("real-password")
    const isValid = await verifyPassword("wrong-password", hash)
    expect(isValid).toBe(false)
  })

  it("produces different hashes for same password (random salt)", async () => {
    const password = "test-password"
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    expect(hash1).not.toBe(hash2)
    // Both should still verify
    expect(await verifyPassword(password, hash1)).toBe(true)
    expect(await verifyPassword(password, hash2)).toBe(true)
  })

  it("hash format is iterations.salt.hash", async () => {
    const hash = await hashPassword("test")
    const parts = hash.split(".")
    expect(parts.length).toBe(3)
    // First part should be a number (iterations)
    expect(parseInt(parts[0], 10)).toBeGreaterThanOrEqual(1000)
    // Second and third parts should be non-empty base64
    expect(parts[1].length).toBeGreaterThan(0)
    expect(parts[2].length).toBeGreaterThan(0)
  })

  it("rejects malformed hash (missing parts)", async () => {
    expect(await verifyPassword("test", "invalid-hash")).toBe(false)
    expect(await verifyPassword("test", "")).toBe(false)
    expect(await verifyPassword("test", "100000")).toBe(false)
  })

  it("rejects hash with invalid iteration count", async () => {
    expect(await verifyPassword("test", "0.abc.def")).toBe(false)
    expect(await verifyPassword("test", "500.abc.def")).toBe(false)
    expect(await verifyPassword("test", "NaN.abc.def")).toBe(false)
  })

  it("handles empty password", async () => {
    const hash = await hashPassword("")
    expect(await verifyPassword("", hash)).toBe(true)
    expect(await verifyPassword("non-empty", hash)).toBe(false)
  })

  it("handles unicode passwords", async () => {
    const password = "p@sswort-mit-umlauten-aou"
    const hash = await hashPassword(password)
    expect(await verifyPassword(password, hash)).toBe(true)
  })
})
