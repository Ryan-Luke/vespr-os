import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { workspaceMembers } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { createSessionCookie, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth/session"

export async function POST(req: Request) {
  const auth = await withAuth()
  const { workspaceId } = await req.json()

  if (!workspaceId) {
    return Response.json({ error: "workspaceId required" }, { status: 400 })
  }

  // Verify the user is a member of the target workspace
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, auth.user.id),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    )
    .limit(1)

  if (!membership) {
    return Response.json({ error: "Not a member of this workspace" }, { status: 403 })
  }

  // Create new session cookie for the target workspace
  const cookie = await createSessionCookie(auth.user.id, workspaceId, membership.role)
  const jar = await cookies()
  jar.set(SESSION_COOKIE_NAME, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })

  return Response.json({ ok: true, workspaceId, role: membership.role })
}
