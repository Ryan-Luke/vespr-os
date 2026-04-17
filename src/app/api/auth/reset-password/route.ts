import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, and, gt } from "drizzle-orm"
import { hashPassword } from "@/lib/auth/password"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown"
  const { allowed } = rateLimit(`reset-password:${ip}`, 10, 60000)
  if (!allowed) {
    return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 })
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string; newPassword?: string }
  const { token, newPassword } = body

  if (!token || !newPassword) {
    return Response.json({ error: "Token and new password are required" }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  // Find user with valid, non-expired token
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.resetToken, token), gt(users.resetTokenExpiry, new Date())))
    .limit(1)

  if (!user) {
    return Response.json({ error: "Invalid or expired reset token" }, { status: 400 })
  }

  const passwordHash = await hashPassword(newPassword)

  await db
    .update(users)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(users.id, user.id))

  return Response.json({ ok: true, message: "Password has been reset. You can now sign in." })
}
