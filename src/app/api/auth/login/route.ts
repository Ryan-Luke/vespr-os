import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { users, workspaceMembers, workspaces, agents } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { verifyPassword } from "@/lib/auth/password"
import { createSessionCookie, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth/session"
import { rateLimit } from "@/lib/rate-limit"
import { loginSchema } from "@/lib/validation"

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown"
  const { allowed } = rateLimit(`login:${ip}`, 10, 60000)
  if (!allowed) {
    return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 })
  }

  const rawBody = await req.json().catch(() => ({}))
  const parsed = loginSchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json({ error: "Email and password are required" }, { status: 400 })
  }
  const email = parsed.data.email.trim().toLowerCase()
  const password = parsed.data.password

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 })
  }

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 })
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

  // Resolve workspace: use requested workspaceId, or fall back to first membership
  let membership: { workspaceId: string; role: string } | undefined

  if (parsed.data.workspaceId) {
    const [m] = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.userId, user.id), eq(workspaceMembers.workspaceId, parsed.data.workspaceId)))
      .limit(1)
    membership = m ? { workspaceId: m.workspaceId, role: m.role } : undefined
  }

  if (!membership) {
    // Fall back to the most active workspace (one with agents), or first membership
    const allMemberships = await db.select().from(workspaceMembers)
      .where(eq(workspaceMembers.userId, user.id))

    if (allMemberships.length > 0) {
      // Prefer workspace with agents
      let best = allMemberships[0]
      for (const m of allMemberships) {
        const agentCount = await db.select({ id: agents.id }).from(agents)
          .where(eq(agents.workspaceId, m.workspaceId)).limit(1)
        if (agentCount.length > 0) { best = m; break }
      }
      membership = { workspaceId: best.workspaceId, role: best.role }
    }
  }

  if (!membership) {
    // Legacy: user has no workspace_members entries yet (pre-migration).
    // Fall back to global role + first workspace in DB.
    const [ws] = await db.select().from(workspaces).limit(1)
    if (ws) {
      membership = { workspaceId: ws.id, role: user.role }
    } else {
      return Response.json({ error: "No workspaces available" }, { status: 400 })
    }
  }

  const cookie = await createSessionCookie(user.id, membership.workspaceId, membership.role)
  const jar = await cookies()
  jar.set(SESSION_COOKIE_NAME, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })

  return Response.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: membership.role },
    workspaceId: membership.workspaceId,
  })
}
