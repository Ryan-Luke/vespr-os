import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { users, workspaces, workspaceMembers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { verifySessionCookie, SESSION_COOKIE_NAME } from "./session"

export type WorkspaceRole = "owner" | "admin" | "member"

export interface AuthContext {
  user: {
    id: string
    email: string
    name: string
    avatarEmoji: string | null
  }
  workspace: {
    id: string
    name: string
    slug: string
    anthropicApiKey: string | null
  }
  role: WorkspaceRole
}

/**
 * Authenticates the request and resolves user + workspace context.
 * Throws a Response (401/403) if session is invalid or user lacks access.
 *
 * Usage in route handlers:
 *   const auth = await withAuth()
 *   // auth.user, auth.workspace, auth.role are guaranteed valid
 */
export async function withAuth(): Promise<AuthContext> {
  const jar = await cookies()
  const cookie = jar.get(SESSION_COOKIE_NAME)?.value
  const session = await verifySessionCookie(cookie)

  if (!session) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Load user
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarEmoji: users.avatarEmoji,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  if (!user) {
    throw new Response(JSON.stringify({ error: "User not found" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Load workspace
  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      anthropicApiKey: workspaces.anthropicApiKey,
    })
    .from(workspaces)
    .where(eq(workspaces.id, session.workspaceId))
    .limit(1)

  if (!workspace) {
    throw new Response(JSON.stringify({ error: "Workspace not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Verify membership (check workspace_members first, fall back to session role for legacy data)
  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, user.id),
        eq(workspaceMembers.workspaceId, workspace.id),
      ),
    )
    .limit(1)

  const role = (membership?.role ?? session.role) as WorkspaceRole

  return { user, workspace, role }
}
