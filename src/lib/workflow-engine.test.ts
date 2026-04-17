import { describe, it, expect, vi } from "vitest"

// Mock the DB module to avoid needing a real database connection
vi.mock("@/lib/db", () => ({
  db: {},
}))

// Import after mocking
import { PHASES, getPhase, type PhaseRunState } from "./workflow-engine"

/**
 * Pure function that mirrors the completion check logic in checkPhaseCompletion.
 * Returns true if ALL required outputs for a phase are "provided" or "confirmed".
 */
function isPhaseComplete(
  phaseKey: string,
  outputs: PhaseRunState["outputs"],
): boolean {
  const phase = getPhase(phaseKey as any)
  return phase.requiredOutputs.every((spec) => {
    const out = outputs[spec.key]
    return out && (out.status === "provided" || out.status === "confirmed")
  })
}

describe("checkPhaseCompletion logic", () => {
  it("returns false when no outputs exist", () => {
    expect(isPhaseComplete("product", {})).toBe(false)
  })

  it("returns false when only some outputs are provided", () => {
    const outputs: PhaseRunState["outputs"] = {
      target_customer: { status: "provided", value: "SMBs" },
      problem_solved: { status: "provided", value: "Manual billing" },
      // offer_sketch and price_range missing
    }
    expect(isPhaseComplete("product", outputs)).toBe(false)
  })

  it("returns false when an output is 'empty'", () => {
    const outputs: PhaseRunState["outputs"] = {
      target_customer: { status: "provided", value: "SMBs" },
      problem_solved: { status: "provided", value: "Manual billing" },
      offer_sketch: { status: "empty" },
      price_range: { status: "provided", value: "$5k" },
    }
    expect(isPhaseComplete("product", outputs)).toBe(false)
  })

  it("returns true when ALL outputs are 'provided'", () => {
    const outputs: PhaseRunState["outputs"] = {
      target_customer: { status: "provided", value: "SMBs" },
      problem_solved: { status: "provided", value: "Manual billing" },
      offer_sketch: { status: "provided", value: "Automated invoicing tool" },
      price_range: { status: "provided", value: "$5k-$10k" },
    }
    expect(isPhaseComplete("product", outputs)).toBe(true)
  })

  it("returns true when ALL outputs are 'confirmed'", () => {
    const outputs: PhaseRunState["outputs"] = {
      target_customer: { status: "confirmed", value: "SMBs" },
      problem_solved: { status: "confirmed", value: "Manual billing" },
      offer_sketch: { status: "confirmed", value: "Automated invoicing tool" },
      price_range: { status: "confirmed", value: "$5k-$10k" },
    }
    expect(isPhaseComplete("product", outputs)).toBe(true)
  })

  it("returns true with a mix of 'provided' and 'confirmed'", () => {
    const outputs: PhaseRunState["outputs"] = {
      target_customer: { status: "confirmed", value: "SMBs" },
      problem_solved: { status: "provided", value: "Manual billing" },
      offer_sketch: { status: "confirmed", value: "Automated invoicing tool" },
      price_range: { status: "provided", value: "$5k-$10k" },
    }
    expect(isPhaseComplete("product", outputs)).toBe(true)
  })

  it("returns false for research phase with missing outputs", () => {
    const outputs: PhaseRunState["outputs"] = {
      demand_evidence: { status: "provided", value: "Search volume data" },
      competitor_analysis: { status: "provided", value: "5 competitors mapped" },
      // pricing_benchmark missing
    }
    expect(isPhaseComplete("research", outputs)).toBe(false)
  })

  it("returns true for research phase when all 3 outputs provided", () => {
    const outputs: PhaseRunState["outputs"] = {
      demand_evidence: { status: "provided", value: "Search volume data" },
      competitor_analysis: { status: "provided", value: "5 competitors mapped" },
      pricing_benchmark: { status: "provided", value: "$300-800/mo typical" },
    }
    expect(isPhaseComplete("research", outputs)).toBe(true)
  })

  it("all 7 phases exist in the PHASES array", () => {
    expect(PHASES).toHaveLength(7)
    const keys = PHASES.map((p) => p.key)
    expect(keys).toContain("product")
    expect(keys).toContain("research")
    expect(keys).toContain("offer")
    expect(keys).toContain("marketing")
    expect(keys).toContain("monetization")
    expect(keys).toContain("delivery")
    expect(keys).toContain("operations")
  })

  it("getPhase throws for unknown phase", () => {
    expect(() => getPhase("nonexistent" as any)).toThrow("Unknown phase")
  })
})
