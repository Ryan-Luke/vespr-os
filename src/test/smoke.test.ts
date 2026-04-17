import { describe, it, expect } from "vitest"

describe("Vitest setup", () => {
  it("runs a basic test", () => {
    expect(1 + 1).toBe(2)
  })

  it("has AUTH_SECRET env var set", () => {
    expect(process.env.AUTH_SECRET).toBeDefined()
    expect(process.env.AUTH_SECRET!.length).toBeGreaterThanOrEqual(16)
  })

  it("resolves @ path alias", async () => {
    const { fakeUser } = await import("@/test/helpers")
    const user = fakeUser({ name: "Smoke Test" })
    expect(user.name).toBe("Smoke Test")
  })
})
