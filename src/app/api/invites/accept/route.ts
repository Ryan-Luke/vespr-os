import { db } from "@/lib/db"
import { invites, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { hashPassword } from "@/lib/auth/password"

// GET /api/invites/accept?token=XXX
// Validate an invite token and return the invite details.
// Used by the invite page to show the signup form.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  if (!token) {
    return Response.json({ error: "Missing invite token" }, { status: 400 })
  }

  const [invite] = await db.select().from(invites)
    .where(eq(invites.token, token))
    .limit(1)

  if (!invite) {
    return Response.json({ error: "This invite link is not valid" }, { status: 404 })
  }

  if (invite.status !== "pending") {
    return Response.json({ error: "This invite has already been used" }, { status: 410 })
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return Response.json({ error: "This invite has expired. Ask the owner to send a new one." }, { status: 410 })
  }

  return Response.json({
    invite: {
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    },
  })
}

// POST /api/invites/accept
// Accept an invite: create the user account and mark the invite as accepted.
// Body: { token, name, password }
export async function POST(req: Request) {
  const { token, name, password } = await req.json() as {
    token?: string
    name?: string
    password?: string
  }

  if (!token || !name || !password) {
    return Response.json({ error: "Token, name, and password are required" }, { status: 400 })
  }

  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  }

  const [invite] = await db.select().from(invites)
    .where(eq(invites.token, token))
    .limit(1)

  if (!invite) {
    return Response.json({ error: "Invalid invite token" }, { status: 404 })
  }

  if (invite.status !== "pending") {
    return Response.json({ error: "This invite has already been used" }, { status: 410 })
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return Response.json({ error: "This invite has expired" }, { status: 410 })
  }

  // Check if email already has an account
  const [existing] = await db.select().from(users)
    .where(eq(users.email, invite.email))
    .limit(1)
  if (existing) {
    return Response.json({ error: "An account with this email already exists. Try logging in." }, { status: 409 })
  }

  // Create the user account
  const passwordHash = await hashPassword(password)
  const [user] = await db.insert(users).values({
    email: invite.email,
    name: name.trim(),
    passwordHash,
    role: invite.role,
  }).returning()

  // Mark invite as accepted
  await db.update(invites).set({
    status: "accepted",
    acceptedAt: new Date(),
  }).where(eq(invites.id, invite.id))

  return Response.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    message: "Account created. You can now sign in.",
  })
}
