import type { WorkspaceRole, AuthContext } from "./with-auth"

/**
 * Role hierarchy: owner (30) > admin (20) > member (10)
 */
const ROLE_LEVEL: Record<WorkspaceRole, number> = {
  owner: 30,
  admin: 20,
  member: 10,
}

/**
 * Throws 403 if the user's role is below the minimum required.
 */
export function requireRole(auth: AuthContext, ...allowedRoles: WorkspaceRole[]): void {
  if (!allowedRoles.includes(auth.role)) {
    throw new Response(
      JSON.stringify({ error: "Forbidden: insufficient permissions" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )
  }
}

/**
 * Throws 403 if the user's role level is below the given minimum.
 */
export function requireMinRole(auth: AuthContext, minRole: WorkspaceRole): void {
  if (ROLE_LEVEL[auth.role] < ROLE_LEVEL[minRole]) {
    throw new Response(
      JSON.stringify({ error: "Forbidden: insufficient permissions" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )
  }
}

/**
 * Non-throwing role guard. Returns a 403 Response if the user's role
 * is not in the allowed list, or null if the check passes.
 * Use in route handlers: `const err = guardRole(auth, "owner"); if (err) return err;`
 */
export function guardRole(auth: AuthContext, ...allowedRoles: WorkspaceRole[]): Response | null {
  if (!allowedRoles.includes(auth.role)) {
    return Response.json(
      { error: "Forbidden: insufficient permissions" },
      { status: 403 },
    )
  }
  return null
}

/**
 * Non-throwing minimum-role guard. Returns a 403 Response if the user's
 * role level is below the given minimum, or null if the check passes.
 * Use in route handlers: `const err = guardMinRole(auth, "admin"); if (err) return err;`
 */
export function guardMinRole(auth: AuthContext, minRole: WorkspaceRole): Response | null {
  if (ROLE_LEVEL[auth.role] < ROLE_LEVEL[minRole]) {
    return Response.json(
      { error: "Forbidden: insufficient permissions" },
      { status: 403 },
    )
  }
  return null
}

// ── Fine-grained permission checks ──────────────────────────

export const canManageAgents = (role: WorkspaceRole) => ROLE_LEVEL[role] >= ROLE_LEVEL.admin
export const canManageIntegrations = (role: WorkspaceRole) => ROLE_LEVEL[role] >= ROLE_LEVEL.admin
export const canManageWorkspace = (role: WorkspaceRole) => ROLE_LEVEL[role] >= ROLE_LEVEL.admin
export const canInviteUsers = (role: WorkspaceRole) => ROLE_LEVEL[role] >= ROLE_LEVEL.admin
export const canRemoveUsers = (role: WorkspaceRole) => ROLE_LEVEL[role] >= ROLE_LEVEL.admin
export const canDeleteWorkspace = (role: WorkspaceRole) => role === "owner"
export const canManageBilling = (role: WorkspaceRole) => role === "owner"
export const canApproveActions = (_role: WorkspaceRole) => true // all roles
export const canChat = (_role: WorkspaceRole) => true // all roles
export const canManageTasks = (_role: WorkspaceRole) => true // all roles
export const canViewDecisions = (_role: WorkspaceRole) => true // all roles
export const canManageSOPs = (role: WorkspaceRole) => ROLE_LEVEL[role] >= ROLE_LEVEL.admin
export const canManageSchedules = (role: WorkspaceRole) => ROLE_LEVEL[role] >= ROLE_LEVEL.admin
