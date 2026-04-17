// Agent Authority System. Controls what each agent can do autonomously
// vs what needs human review or is outright blocked. Uses role-based
// defaults with progressive autonomy via the autoApprovals table.
//
// Authority levels:
//   "autonomous"    — agent can execute without asking
//   "needs_review"  — agent must create an approval request first
//   "blocked"       — action is not permitted for this agent

import { db } from "@/lib/db"
import { agents, autoApprovals } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

// ── Types ────────────────────────────────────────────────────────────

export type ActionType =
  | "send_email"
  | "publish_content"
  | "approve_spend"
  | "create_document"
  | "modify_document"
  | "delete_data"
  | "contact_external"
  | "make_commitment"
  | "change_pricing"
  | "hire_agent"
  | "modify_workflow"
  | "access_financial_data"

export type AuthorityLevel = "autonomous" | "needs_review" | "blocked"

export interface AuthorityProfile {
  agentId: string
  agentName: string
  role: string
  archetype: string | null
  rules: Record<ActionType, AuthorityLevel>
  overrides: { actionType: string; level: AuthorityLevel; source: string }[]
}

// ── Default Authority Rules ──────────────────────────────────────────
// Base rules applied to all agents. Role-specific overrides below.

const DEFAULT_RULES: Record<ActionType, AuthorityLevel> = {
  create_document: "autonomous",
  modify_document: "autonomous",
  send_email: "needs_review",
  publish_content: "needs_review",
  contact_external: "needs_review",
  make_commitment: "needs_review",
  approve_spend: "needs_review",
  access_financial_data: "needs_review",
  modify_workflow: "needs_review",
  delete_data: "blocked",
  change_pricing: "blocked",
  hire_agent: "blocked",
}

// Role-based overrides. Keys are checked as substrings of the agent's
// role (lowercase). First match wins.
interface RoleOverride {
  rolePattern: string
  overrides: Partial<Record<ActionType, AuthorityLevel>>
}

const ROLE_OVERRIDES: RoleOverride[] = [
  {
    rolePattern: "finance",
    overrides: {
      access_financial_data: "autonomous",
      approve_spend: "needs_review", // always review, but finance can request
    },
  },
  {
    rolePattern: "bookkeeper",
    overrides: {
      access_financial_data: "autonomous",
    },
  },
  {
    rolePattern: "sales",
    overrides: {
      contact_external: "needs_review",
      make_commitment: "needs_review",
    },
  },
  {
    rolePattern: "chief of staff",
    overrides: {
      modify_workflow: "autonomous",
    },
  },
  {
    rolePattern: "marketing",
    overrides: {
      publish_content: "needs_review",
    },
  },
]

// Spend thresholds for sales agents
const SALES_SPEND_THRESHOLD = 500

// Progressive autonomy threshold: after N approved requests of the same
// type, the agent earns autonomous authority for that action.
const AUTO_APPROVAL_THRESHOLD = 5

// ── Helpers ──────────────────────────────────────────────────────────

function getRoleOverrides(role: string): Partial<Record<ActionType, AuthorityLevel>> {
  const normalizedRole = role.toLowerCase()
  for (const override of ROLE_OVERRIDES) {
    if (normalizedRole.includes(override.rolePattern)) {
      return override.overrides
    }
  }
  return {}
}

function buildRules(role: string): Record<ActionType, AuthorityLevel> {
  const base = { ...DEFAULT_RULES }
  const overrides = getRoleOverrides(role)
  for (const [action, level] of Object.entries(overrides)) {
    base[action as ActionType] = level
  }
  return base
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Check if an agent can perform a given action autonomously.
 * Resolves authority through three layers:
 *   1. Default rules (all agents)
 *   2. Role-based overrides
 *   3. Progressive autonomy (autoApprovals table)
 *   4. Spend-amount thresholds for financial actions
 */
export async function checkAuthority(params: {
  agentId: string
  workspaceId: string
  action: ActionType
  amount?: number
}): Promise<{ allowed: boolean; level: AuthorityLevel; reason?: string }> {
  const { agentId, workspaceId, action, amount } = params

  // Load agent to get role
  const [agent] = await db.select({
    id: agents.id,
    name: agents.name,
    role: agents.role,
    archetype: agents.archetype,
  }).from(agents).where(eq(agents.id, agentId)).limit(1)

  if (!agent) {
    return { allowed: false, level: "blocked", reason: "Agent not found" }
  }

  // Build rules for this agent's role
  const rules = buildRules(agent.role)
  let level = rules[action]

  // Special handling for approve_spend with amount thresholds
  if (action === "approve_spend" && amount !== undefined) {
    const isSales = agent.role.toLowerCase().includes("sales")
    if (isSales) {
      if (amount > SALES_SPEND_THRESHOLD) {
        return {
          allowed: false,
          level: "blocked",
          reason: `Spend of $${amount} exceeds the $${SALES_SPEND_THRESHOLD} threshold for sales agents`,
        }
      }
      // Under threshold: needs_review (default for sales)
      level = "needs_review"
    }
  }

  // Check progressive autonomy: if the agent has been approved enough
  // times for this action type, upgrade from "needs_review" to "autonomous"
  if (level === "needs_review") {
    try {
      const [autoApproval] = await db.select().from(autoApprovals)
        .where(and(
          eq(autoApprovals.agentId, agentId),
          eq(autoApprovals.actionType, action),
          eq(autoApprovals.enabled, true),
        ))
        .limit(1)

      if (autoApproval && autoApproval.approvalCount >= AUTO_APPROVAL_THRESHOLD) {
        return {
          allowed: true,
          level: "autonomous",
          reason: `Progressive autonomy: ${autoApproval.approvalCount} prior approvals for "${action}"`,
        }
      }
    } catch {
      // autoApprovals check is best-effort
    }
  }

  if (level === "autonomous") {
    return { allowed: true, level }
  }

  if (level === "blocked") {
    return {
      allowed: false,
      level,
      reason: `Action "${action}" is blocked for ${agent.role} agents`,
    }
  }

  // needs_review
  return {
    allowed: false,
    level: "needs_review",
    reason: `Action "${action}" requires human approval for ${agent.role} agents`,
  }
}

/**
 * Get the full authority profile for an agent, showing all action
 * types and their resolved authority levels.
 */
export async function getAgentAuthority(
  agentId: string,
  workspaceId: string,
): Promise<AuthorityProfile> {
  const [agent] = await db.select({
    id: agents.id,
    name: agents.name,
    role: agents.role,
    archetype: agents.archetype,
  }).from(agents).where(eq(agents.id, agentId)).limit(1)

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`)
  }

  const rules = buildRules(agent.role)

  // Check progressive autonomy overrides
  const overrides: AuthorityProfile["overrides"] = []
  try {
    const agentAutoApprovals = await db.select().from(autoApprovals)
      .where(and(
        eq(autoApprovals.agentId, agentId),
        eq(autoApprovals.enabled, true),
      ))

    for (const aa of agentAutoApprovals) {
      if (
        aa.approvalCount >= AUTO_APPROVAL_THRESHOLD &&
        rules[aa.actionType as ActionType] === "needs_review"
      ) {
        rules[aa.actionType as ActionType] = "autonomous"
        overrides.push({
          actionType: aa.actionType,
          level: "autonomous",
          source: `progressive_autonomy (${aa.approvalCount} approvals)`,
        })
      }
    }
  } catch {
    // best-effort
  }

  return {
    agentId: agent.id,
    agentName: agent.name,
    role: agent.role,
    archetype: agent.archetype,
    rules,
    overrides,
  }
}

// Re-export for consumers that need the constants
export { DEFAULT_RULES, ROLE_OVERRIDES, AUTO_APPROVAL_THRESHOLD }
