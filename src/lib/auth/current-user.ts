import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { verifySessionCookie, SESSION_COOKIE_NAME } from "./session"

export type CurrentUser = {
  id: string
  email: string
  name: string
  role: "owner" | "admin" | "member" | string
  avatarEmoji: string | null
}

/**
 * Returns the currently logged-in user for the active request,
 * or null if the session is missing/invalid/expired.
 *
 * Safe to call from server components, route handlers, and server actions.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies()
  const cookie = jar.get(SESSION_COOKIE_NAME)?.value
  const session = await verifySessionCookie(cookie)
  if (!session) return null

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      avatarEmoji: users.avatarEmoji,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  return user ?? null
}

export async function requireOwner(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new Response("Unauthorized", { status: 401 })
  if (user.role !== "owner") throw new Response("Forbidden", { status: 403 })
  return user
}
