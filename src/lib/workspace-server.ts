import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { workspaces } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { verifySessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session"

const STORAGE_KEY = "vespr-active-workspace"

/** Get the active workspace ID from the session cookie (auth-aware) */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies()

  // Primary: use session cookie (auth-aware)
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const session = await verifySessionCookie(sessionCookie)
  if (session?.workspaceId) return session.workspaceId

  // Fallback: legacy storage cookie
  return cookieStore.get(STORAGE_KEY)?.value ?? null
}

/** Get the active workspace, resolved from session */
export async function getActiveWorkspace() {
  const id = await getActiveWorkspaceId()
  if (id) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
    if (ws) return ws
  }
  // Fallback: first workspace (legacy single-tenant behavior)
  const [first] = await db.select().from(workspaces).limit(1)
  return first ?? null
}
