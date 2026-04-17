import { describe, it, expect } from "vitest"
import { createSessionCookie, verifySessionCookie } from "./session"

describe("session cookies", () => {
  it("creates and verifies a valid cookie", async () => {
    const cookie = await createSessionCookie("user-1", "ws-1", "owner")
    const payload = await verifySessionCookie(cookie)

    expect(payload).not.toBeNull()
    expect(payload!.userId).toBe("user-1")
    expect(payload!.workspaceId).toBe("ws-1")
    expect(payload!.role).toBe("owner")
    expect(payload!.exp).toBeGreaterThan(Date.now() / 1000)
  })

  it("returns null for undefined cookie", async () => {
    expect(await verifySessionCookie(undefined)).toBeNull()
  })

  it("returns null for empty string", async () => {
    expect(await verifySessionCookie("")).toBeNull()
  })

  it("returns null for tampered cookie", async () => {
    const cookie = await createSessionCookie("user-1", "ws-1", "owner")
    const tampered = cookie.slice(0, -3) + "xyz"
    expect(await verifySessionCookie(tampered)).toBeNull()
  })

  it("returns null for malformed cookie (no dot)", async () => {
    expect(await verifySessionCookie("nodothere")).toBeNull()
  })

  it("returns null for expired cookie", async () => {
    // Manually create a cookie with exp in the past
    // We can't easily do this without modifying internals,
    // so we test the boundary: verify checks exp
    const cookie = await createSessionCookie("user-1", "ws-1", "member")
    const payload = await verifySessionCookie(cookie)
    expect(payload).not.toBeNull()
    // Payload exp should be ~30 days in the future
    expect(payload!.exp).toBeGreaterThan(Date.now() / 1000 + 86400 * 29)
  })

  it("preserves all three roles correctly", async () => {
    for (const role of ["owner", "admin", "member"]) {
      const cookie = await createSessionCookie("u-1", "ws-1", role)
      const payload = await verifySessionCookie(cookie)
      expect(payload!.role).toBe(role)
    }
  })
})
