// src/lib/billing/__tests__/billing.test.ts

import { describe, it, expect } from "vitest"
import { getPlan, planHasFeature, getPlanLimit, PLANS, type PlanId } from "../plans"

// ── Plan Definitions ─────────────────────────────────────────

describe("Plan Definitions", () => {
  it("should have free, pro, and team plans", () => {
    expect(PLANS.free).toBeDefined()
    expect(PLANS.pro).toBeDefined()
    expect(PLANS.team).toBeDefined()
  })

  it("should have free plan at $0", () => {
    expect(PLANS.free.price).toBe(0)
  })

  it("should have pro plan priced higher than free", () => {
    expect(PLANS.pro.price).toBeGreaterThan(PLANS.free.price)
  })

  it("should have team plan priced higher than pro", () => {
    expect(PLANS.team.price).toBeGreaterThan(PLANS.pro.price)
  })

  it("should return free plan for unknown plan ID", () => {
    const plan = getPlan("nonexistent")
    expect(plan.id).toBe("free")
  })
})

// ── Plan Limits ──────────────────────────────────────────────

describe("Plan Limits", () => {
  it("free plan should limit agents to 3", () => {
    expect(getPlanLimit("free", "maxAgents")).toBe(3)
  })

  it("pro plan should have unlimited agents", () => {
    expect(getPlanLimit("pro", "maxAgents")).toBe(Infinity)
  })

  it("free plan should limit integrations to 2", () => {
    expect(getPlanLimit("free", "maxIntegrations")).toBe(2)
  })

  it("pro plan should have unlimited integrations", () => {
    expect(getPlanLimit("pro", "maxIntegrations")).toBe(Infinity)
  })

  it("free plan should limit team members to 1", () => {
    expect(getPlanLimit("free", "maxTeamMembers")).toBe(1)
  })

  it("team plan should allow 10 team members", () => {
    expect(getPlanLimit("team", "maxTeamMembers")).toBe(10)
  })
})

// ── Feature Access ───────────────────────────────────────────

describe("Feature Access", () => {
  it("free plan should not have advanced analytics", () => {
    expect(planHasFeature("free", "advancedAnalytics")).toBe(false)
  })

  it("pro plan should have advanced analytics", () => {
    expect(planHasFeature("pro", "advancedAnalytics")).toBe(true)
  })

  it("free plan should not have audit log", () => {
    expect(planHasFeature("free", "auditLog")).toBe(false)
  })

  it("pro plan should have audit log", () => {
    expect(planHasFeature("pro", "auditLog")).toBe(true)
  })

  it("free plan should not have cron priority", () => {
    expect(planHasFeature("free", "cronPriority")).toBe(false)
  })

  it("pro plan should have cron priority", () => {
    expect(planHasFeature("pro", "cronPriority")).toBe(true)
  })

  it("free plan should not have SSO", () => {
    expect(planHasFeature("free", "ssoEnabled")).toBe(false)
  })

  it("team plan should have SSO", () => {
    expect(planHasFeature("team", "ssoEnabled")).toBe(true)
  })

  it("free plan should not have API access", () => {
    expect(planHasFeature("free", "apiAccess")).toBe(false)
  })

  it("pro plan should have API access", () => {
    expect(planHasFeature("pro", "apiAccess")).toBe(true)
  })
})

// ── Plan Hierarchy ───────────────────────────────────────────

describe("Plan Hierarchy", () => {
  const numericFeatures: (keyof typeof PLANS.free.limits)[] = [
    "maxWorkspaces", "maxAgents", "maxIntegrations", "maxTeamMembers"
  ]

  const booleanFeatures: (keyof typeof PLANS.free.limits)[] = [
    "cronPriority", "advancedAnalytics", "auditLog", "customBranding", "apiAccess"
  ]

  it("pro limits should be >= free limits for all numeric features", () => {
    for (const feature of numericFeatures) {
      const freeLimit = getPlanLimit("free", feature)
      const proLimit = getPlanLimit("pro", feature)
      expect(proLimit).toBeGreaterThanOrEqual(freeLimit)
    }
  })

  it("team limits should be >= pro limits for all numeric features", () => {
    for (const feature of numericFeatures) {
      const proLimit = getPlanLimit("pro", feature)
      const teamLimit = getPlanLimit("team", feature)
      expect(teamLimit).toBeGreaterThanOrEqual(proLimit)
    }
  })

  it("pro should have all boolean features that free has", () => {
    for (const feature of booleanFeatures) {
      if (planHasFeature("free", feature)) {
        expect(planHasFeature("pro", feature)).toBe(true)
      }
    }
  })

  it("team should have all boolean features that pro has", () => {
    for (const feature of booleanFeatures) {
      if (planHasFeature("pro", feature)) {
        expect(planHasFeature("team", feature)).toBe(true)
      }
    }
  })
})

// ── Stripe Price IDs ─────────────────────────────────────────

describe("Stripe Configuration", () => {
  it("free plan should have no Stripe price ID", () => {
    expect(PLANS.free.stripePriceId).toBeNull()
  })

  // Pro and team price IDs come from env vars -- can't test exact values
  // but we can test the structure
  it("all plans should have an id matching their key", () => {
    for (const [key, plan] of Object.entries(PLANS)) {
      expect(plan.id).toBe(key)
    }
  })
})
