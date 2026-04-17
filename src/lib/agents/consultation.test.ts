import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/db", () => {
  // Build a chainable mock that resolves to an empty array at any terminal point
  const emptyArr: never[] = []
  const chain: any = {
    then: (fn: any) => Promise.resolve(emptyArr).then(fn),
    [Symbol.toStringTag]: "Promise",
  }
  const methods = ["select", "from", "where", "set", "values", "returning", "limit", "orderBy", "insert", "update", "delete"]
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return { db: chain }
})

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "Mock response from agent" }),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue("mock-model"),
}))

vi.mock("@/lib/personality-presets", () => ({
  traitsToPromptStyle: vi.fn().mockReturnValue("Be cool and casual."),
}))

import { consultAgent } from "./consultation"

describe("consultAgent depth limiting", () => {
  it("refuses consultation when depth >= 1", async () => {
    const result = await consultAgent({
      fromAgentId: "agent-1",
      targetAgentName: "Nova",
      question: "What's the budget?",
      workspaceId: "ws-1",
      _consultationDepth: 1,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain("depth limit reached")
  })

  it("refuses consultation at depth 2", async () => {
    const result = await consultAgent({
      fromAgentId: "agent-1",
      targetAgentName: "Nova",
      question: "What's the budget?",
      workspaceId: "ws-1",
      _consultationDepth: 2,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain("depth limit reached")
  })

  it("allows consultation at depth 0 (returns agent-not-found, not depth error)", async () => {
    const result = await consultAgent({
      fromAgentId: "agent-1",
      targetAgentName: "Nova",
      question: "What's the budget?",
      workspaceId: "ws-1",
      _consultationDepth: 0,
    })

    // Depth check should pass — error should be about agent not found
    expect(result.ok).toBe(false)
    expect(result.error).toContain("not found")
    expect(result.error).not.toContain("depth limit")
  })

  it("defaults to depth 0 when not specified", async () => {
    const result = await consultAgent({
      fromAgentId: "agent-1",
      targetAgentName: "Nova",
      question: "What's the budget?",
      workspaceId: "ws-1",
    })

    // Should not fail with depth limit
    expect(result.ok).toBe(false)
    expect(result.error).not.toContain("depth limit")
  })
})
