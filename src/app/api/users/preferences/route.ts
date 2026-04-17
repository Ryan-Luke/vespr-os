// src/app/api/users/preferences/route.ts

import { cookies } from "next/headers"
import { verifySessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const jar = await cookies()
  const session = await verifySessionCookie(jar.get(SESSION_COOKIE_NAME)?.value)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      powerMode: users.powerMode,
      avatarEmoji: users.avatarEmoji,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 })
  }

  return Response.json(user)
}

export async function PATCH(req: Request) {
  const jar = await cookies()
  const session = await verifySessionCookie(jar.get(SESSION_COOKIE_NAME)?.value)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const updates: Partial<{ powerMode: boolean; avatarEmoji: string }> = {}

  if (typeof body.powerMode === "boolean") updates.powerMode = body.powerMode
  if (typeof body.avatarEmoji === "string") updates.avatarEmoji = body.avatarEmoji

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, session.userId))
    .returning()

  return Response.json({
    powerMode: updated.powerMode,
    avatarEmoji: updated.avatarEmoji,
  })
}
