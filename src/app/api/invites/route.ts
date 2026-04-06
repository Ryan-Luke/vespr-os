import { db } from "@/lib/db"
import { invites, users } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { randomBytes } from "node:crypto"
import { getCurrentUser } from "@/lib/auth/current-user"

// GET /api/invites - List all invites (owner/admin only)
export async function GET() {
  const allInvites = await db.select().from(invites).orderBy(desc(invites.createdAt))
  return Response.json({ invites: allInvites })
}

// POST /api/invites - Create a new invite
// Body: { email, role? }
// Returns the invite with a signup link the owner can share.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || (user.role !== "owner" && user.role !== "admin")) {
    return Response.json({ error: "Only owners and admins can invite team members" }, { status: 403 })
  }

  const { email, role } = await req.json() as { email?: string; role?: string }
  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email required" }, { status: 400 })
  }

  // Check if email already has an account
  const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (existing) {
    return Response.json({ error: "This email already has an account" }, { status: 409 })
  }

  // Check for existing pending invite
  const [pendingInvite] = await db.select().from(invites)
    .where(eq(invites.email, email.toLowerCase()))
    .limit(1)
  if (pendingInvite && pendingInvite.status === "pending") {
    return Response.json({ error: "An invite is already pending for this email" }, { status: 409 })
  }

  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const [invite] = await db.insert(invites).values({
    email: email.toLowerCase(),
    role: role === "admin" ? "admin" : "member",
    token,
    invitedBy: user.id,
    expiresAt,
  }).returning()

  // Build the invite URL. Works in any environment.
  const host = req.headers.get("host") ?? "localhost:3000"
  const protocol = host.includes("localhost") ? "http" : "https"
  const inviteUrl = `${protocol}://${host}/invite/${token}`

  // TODO: Send email via Resend when RESEND_API_KEY is configured.
  // For now, the owner copies the link manually.

  return Response.json({
    invite,
    inviteUrl,
    message: "Invite created. Share the link with your team member.",
  })
}

// DELETE /api/invites - Revoke an invite
export async function DELETE(req: Request) {
  const { id } = await req.json() as { id?: string }
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  await db.delete(invites).where(eq(invites.id, id))
  return Response.json({ ok: true })
}
