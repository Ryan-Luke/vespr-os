// src/lib/billing/plans.ts

export type PlanId = "free" | "pro" | "team"

export interface PlanDefinition {
  id: PlanId
  name: string
  description: string
  price: number // monthly price in cents (0 for free)
  limits: {
    maxWorkspaces: number       // how many workspaces the owner can create
    maxAgents: number           // max agents per workspace
    maxIntegrations: number     // max connected integrations per workspace
    maxTeamMembers: number      // max human users (not agents) per workspace
    cronPriority: boolean       // priority cron scheduling (shorter intervals)
    advancedAnalytics: boolean  // agent health dashboard, cost tracking
    auditLog: boolean           // full decision log access
    customBranding: boolean     // custom workspace icon/name on public profile
    apiAccess: boolean          // programmatic API access to workspace
    ssoEnabled: boolean         // SSO / SAML (future)
  }
  stripePriceId: string | null  // null for free tier
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    description: "Get started with a small team. Perfect for exploring.",
    price: 0,
    limits: {
      maxWorkspaces: 1,
      maxAgents: 3,
      maxIntegrations: 2,
      maxTeamMembers: 1,
      cronPriority: false,
      advancedAnalytics: false,
      auditLog: false,
      customBranding: false,
      apiAccess: false,
      ssoEnabled: false,
    },
    stripePriceId: null,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Unlimited agents, all integrations, advanced analytics. For serious builders.",
    price: 4900, // $49/mo
    limits: {
      maxWorkspaces: 3,
      maxAgents: Infinity,
      maxIntegrations: Infinity,
      maxTeamMembers: 1,
      cronPriority: true,
      advancedAnalytics: true,
      auditLog: true,
      customBranding: true,
      apiAccess: true,
      ssoEnabled: false,
    },
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
  },
  team: {
    id: "team",
    name: "Team",
    description: "Multi-user workspace with RBAC, audit trails, and priority support.",
    price: 9900, // $99/mo
    limits: {
      maxWorkspaces: 10,
      maxAgents: Infinity,
      maxIntegrations: Infinity,
      maxTeamMembers: 10,
      cronPriority: true,
      advancedAnalytics: true,
      auditLog: true,
      customBranding: true,
      apiAccess: true,
      ssoEnabled: true,
    },
    stripePriceId: process.env.STRIPE_TEAM_PRICE_ID || null,
  },
}

/**
 * Get the plan definition for a given plan ID.
 * Returns the free plan if the ID is unrecognized.
 */
export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId as PlanId] ?? PLANS.free
}

/**
 * Check if a plan has access to a specific feature.
 */
export function planHasFeature(planId: string, feature: keyof PlanDefinition["limits"]): boolean {
  const plan = getPlan(planId)
  const value = plan.limits[feature]
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value > 0
  return false
}

/**
 * Get numeric limit for a plan feature. Returns Infinity if unlimited.
 */
export function getPlanLimit(planId: string, feature: keyof PlanDefinition["limits"]): number {
  const plan = getPlan(planId)
  const value = plan.limits[feature]
  if (typeof value === "number") return value
  if (typeof value === "boolean") return value ? Infinity : 0
  return 0
}
