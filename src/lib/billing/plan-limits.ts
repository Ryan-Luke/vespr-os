// src/lib/billing/plan-limits.ts

import { db } from "@/lib/db"
import { subscriptions, agents, integrations, users } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { getPlan, getPlanLimit, type PlanId, type PlanDefinition } from "./plans"

// ── Types ────────────────────────────────────────────────────

export type LimitAction =
  | "create_agent"
  | "connect_integration"
  | "invite_member"
  | "create_workspace"
  | "use_advanced_analytics"
  | "use_audit_log"
  | "use_api_access"
  | "use_cron_priority"

export interface LimitCheckResult {
  allowed: boolean
  reason?: string
  currentCount?: number
  limit?: number
  planId: PlanId
  upgradeRequired?: PlanId // lowest plan that would allow this action
}

// ── Get Workspace Plan ───────────────────────────────────────

export async function getPlanForWorkspace(workspaceId: string): Promise<{
  planId: PlanId
  plan: PlanDefinition
  subscription: typeof subscriptions.$inferSelect | null
}> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1)

  const planId = (sub?.plan as PlanId) ?? "free"
  const plan = getPlan(planId)

  return { planId, plan, subscription: sub ?? null }
}

// ── Count Helpers ────────────────────────────────────────────

async function countAgents(workspaceId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agents)
    .where(eq(agents.workspaceId, workspaceId))
  return result?.count ?? 0
}

async function countIntegrations(workspaceId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(integrations)
    .where(
      and(
        eq(integrations.workspaceId, workspaceId),
        eq(integrations.status, "connected")
      )
    )
  return result?.count ?? 0
}

async function countTeamMembers(): Promise<number> {
  // In current single-tenant model, count all users
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
  return result?.count ?? 0
}

// ── Main Limit Check ─────────────────────────────────────────

export async function checkLimit(
  workspaceId: string,
  action: LimitAction
): Promise<LimitCheckResult> {
  const { planId, plan } = await getPlanForWorkspace(workspaceId)

  switch (action) {
    case "create_agent": {
      const count = await countAgents(workspaceId)
      const limit = plan.limits.maxAgents
      const allowed = count < limit
      return {
        allowed,
        reason: allowed ? undefined : `Your ${plan.name} plan allows ${limit} agents. You have ${count}. Upgrade to add more.`,
        currentCount: count,
        limit: limit === Infinity ? undefined : limit,
        planId,
        upgradeRequired: allowed ? undefined : suggestUpgrade(planId, "maxAgents", count + 1),
      }
    }

    case "connect_integration": {
      const count = await countIntegrations(workspaceId)
      const limit = plan.limits.maxIntegrations
      const allowed = count < limit
      return {
        allowed,
        reason: allowed ? undefined : `Your ${plan.name} plan allows ${limit} integrations. You have ${count}. Upgrade to connect more.`,
        currentCount: count,
        limit: limit === Infinity ? undefined : limit,
        planId,
        upgradeRequired: allowed ? undefined : suggestUpgrade(planId, "maxIntegrations", count + 1),
      }
    }

    case "invite_member": {
      const count = await countTeamMembers()
      const limit = plan.limits.maxTeamMembers
      const allowed = count < limit
      return {
        allowed,
        reason: allowed ? undefined : `Your ${plan.name} plan allows ${limit} team members. You have ${count}. Upgrade to invite more.`,
        currentCount: count,
        limit: limit === Infinity ? undefined : limit,
        planId,
        upgradeRequired: allowed ? undefined : suggestUpgrade(planId, "maxTeamMembers", count + 1),
      }
    }

    case "use_advanced_analytics": {
      const allowed = plan.limits.advancedAnalytics
      return {
        allowed,
        reason: allowed ? undefined : "Advanced analytics require a Pro plan or higher.",
        planId,
        upgradeRequired: allowed ? undefined : "pro",
      }
    }

    case "use_audit_log": {
      const allowed = plan.limits.auditLog
      return {
        allowed,
        reason: allowed ? undefined : "Audit log access requires a Pro plan or higher.",
        planId,
        upgradeRequired: allowed ? undefined : "pro",
      }
    }

    case "use_api_access": {
      const allowed = plan.limits.apiAccess
      return {
        allowed,
        reason: allowed ? undefined : "API access requires a Pro plan or higher.",
        planId,
        upgradeRequired: allowed ? undefined : "pro",
      }
    }

    case "use_cron_priority": {
      const allowed = plan.limits.cronPriority
      return {
        allowed,
        reason: allowed ? undefined : "Priority scheduling requires a Pro plan or higher.",
        planId,
        upgradeRequired: allowed ? undefined : "pro",
      }
    }

    default:
      return { allowed: true, planId }
  }
}

// ── Upgrade Suggestion ───────────────────────────────────────

function suggestUpgrade(
  currentPlan: PlanId,
  feature: keyof PlanDefinition["limits"],
  requiredValue: number
): PlanId {
  const planOrder: PlanId[] = ["free", "pro", "team"]
  const currentIndex = planOrder.indexOf(currentPlan)

  for (let i = currentIndex + 1; i < planOrder.length; i++) {
    const plan = getPlan(planOrder[i])
    const limit = plan.limits[feature]
    if (typeof limit === "number" && limit >= requiredValue) return planOrder[i]
    if (typeof limit === "number" && limit === Infinity) return planOrder[i]
    if (typeof limit === "boolean" && limit) return planOrder[i]
  }

  return "team" // highest plan
}
