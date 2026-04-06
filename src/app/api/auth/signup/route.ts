import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { hashPassword } from "@/lib/auth/password"
import { createSessionCookie, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth/session"

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string
    password?: string
    name?: string
  }
  const email = body.email?.trim().toLowerCase()
  const password = body.password
  const name = body.name?.trim()

  if (!email || !password || !name) {
    return Response.json({ error: "Name, email, and password are required" }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Invalid email address" }, { status: 400 })
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) {
    return Response.json({ error: "An account with that email already exists" }, { status: 409 })
  }

  // First user on a fresh deploy becomes the owner. After that, signups are disabled
  // until an invite flow exists — the owner has to invite teammates explicitly.
  // This keeps a fresh deploy safe from random drive-by signups.
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

  const cookie = await createSessionCookie(user.id, user.role)
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
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
}
