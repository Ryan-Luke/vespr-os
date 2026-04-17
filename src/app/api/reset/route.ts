import { wipeBusinessData } from "@/lib/db/wipe"
import { cookies } from "next/headers"
import { withAuth } from "@/lib/auth/with-auth"
import { guardMinRole } from "@/lib/auth/rbac"

/**
 * Demo reset — wipes business data and clears workspace cookies.
 * Pair with the client page at /reset which also clears localStorage
 * and redirects to /onboarding.
 *
 * Requires an authenticated user with role "owner". User accounts
 * themselves are preserved (wipeBusinessData does not touch the users table).
 */
export async function POST() {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "owner")
  if (forbidden) return forbidden

  await wipeBusinessData()

  const jar = await cookies()
  jar.delete("vespr-active-workspace")
  jar.delete("vespr-entry-channel")

  return Response.json({ success: true })
}
