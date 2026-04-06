import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { verifyPassword } from "@/lib/auth/password"
import { createSessionCookie, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth/session"

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string }
  const email = body.email?.trim().toLowerCase()
  const password = body.password

  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 })
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 })
  }

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 })
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

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
