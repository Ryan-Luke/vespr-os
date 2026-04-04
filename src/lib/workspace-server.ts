import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { workspaces } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const STORAGE_KEY = "verspr-active-workspace"

/** Get the active workspace ID from cookies (server-side) */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(STORAGE_KEY)?.value ?? null
}

/** Get the active workspace, falling back to first workspace if cookie is not set */
export async function getActiveWorkspace() {
  const id = await getActiveWorkspaceId()
  if (id) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
    if (ws) return ws
  }
  // Fallback: first workspace
  const [first] = await db.select().from(workspaces).limit(1)
  return first ?? null
}
