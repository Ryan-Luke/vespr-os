import { wipeBusinessData } from "@/lib/db/wipe"
import { cookies } from "next/headers"
import { getCurrentUser } from "@/lib/auth/current-user"

/**
 * Demo reset — wipes business data and clears workspace cookies.
 * Pair with the client page at /reset which also clears localStorage
 * and redirects to /onboarding.
 *
 * Requires an authenticated user with role "owner". User accounts
 * themselves are preserved (wipeBusinessData does not touch the users table).
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "owner") return Response.json({ error: "Forbidden" }, { status: 403 })

  await wipeBusinessData()

  const jar = await cookies()
  jar.delete("vespr-active-workspace")
  jar.delete("vespr-entry-channel")

  return Response.json({ success: true })
}
