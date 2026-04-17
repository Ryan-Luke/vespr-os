import { db } from "@/lib/db"
import { users, workspaceMembers } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

// GET /api/team - List all team members in the current workspace (no passwords, no secrets)
export async function GET() {
  const auth = await withAuth()

  // Get members of this workspace via workspace_members join
  const members = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: workspaceMembers.role,
      avatarEmoji: users.avatarEmoji,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, auth.workspace.id))
    .orderBy(desc(users.createdAt))

  return Response.json({ members })
}
