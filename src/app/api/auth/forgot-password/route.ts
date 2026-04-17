import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown"
  const { allowed } = rateLimit(`forgot-password:${ip}`, 5, 60000)
  if (!allowed) {
    return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 })
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string }
  const email = body.email?.trim().toLowerCase()

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 })
  }

  // Always return success to avoid revealing if an email exists
  const successResponse = Response.json({
    ok: true,
    message: "If an account with that email exists, a password reset link has been sent.",
  })

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!user) return successResponse

    // Generate a secure random token
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const resetToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db
      .update(users)
      .set({ resetToken, resetTokenExpiry })
      .where(eq(users.id, user.id))

    // In production, send email via Resend. For now, log the reset URL.
    const resetUrl = `${req.headers.get("origin") || "http://localhost:3000"}/reset-password?token=${resetToken}`
    console.log(`[Password Reset] URL for ${email}: ${resetUrl}`)
  } catch (err) {
    console.error("[Password Reset] Error:", err)
  }

  return successResponse
}
