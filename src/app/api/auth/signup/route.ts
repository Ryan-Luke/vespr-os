import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { users, workspaces, workspaceMembers } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { hashPassword } from "@/lib/auth/password"
import { createSessionCookie, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth/session"
import { rateLimit } from "@/lib/rate-limit"
import { signupSchema } from "@/lib/validation"

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown"
  const { allowed } = rateLimit(`signup:${ip}`, 5, 60000)
  if (!allowed) {
    return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 })
  }

  const rawBody = await req.json().catch(() => ({}))
  const parsed = signupSchema.safeParse(rawBody)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    const msg = firstError?.path.includes("email") ? "Invalid email address"
      : firstError?.path.includes("password") ? "Password must be at least 8 characters"
      : "Name, email, and password are required"
    return Response.json({ error: msg }, { status: 400 })
  }
  const email = parsed.data.email.trim().toLowerCase()
  const password = parsed.data.password
  const name = parsed.data.name.trim()

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) {
    return Response.json({ error: "An account with that email already exists" }, { status: 409 })
  }

  // First user on a fresh deploy becomes the owner. After that, signups are disabled
  // until an invite flow exists — the owner has to invite teammates explicitly.
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
  if (count > 0) {
    return Response.json(
      { error: "Signups are closed. Ask your workspace owner to invite you." },
      { status: 403 },
    )
  }
  const role = "owner"

  const passwordHash = await hashPassword(password)

  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash, role })
    .returning()

  // Create a placeholder workspace — onboarding will update it with the real name and template
  const wsName = parsed.data.workspaceName?.trim() || "My Workspace"
  const slug = wsName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: wsName,
      slug,
      ownerName: name,
    })
    .returning()

  // Create workspace membership for the owner
  await db.insert(workspaceMembers).values({
    userId: user.id,
    workspaceId: workspace.id,
    role: "owner",
  })

  const cookie = await createSessionCookie(user.id, workspace.id, role)
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
    user: { id: user.id, email: user.email, name: user.name, role },
    workspaceId: workspace.id,
  })
}
