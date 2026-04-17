import { db } from "@/lib/db"
import { channels } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET() {
  const auth = await withAuth()
  const allChannels = await db.select().from(channels).where(eq(channels.workspaceId, auth.workspace.id))
  return Response.json(allChannels)
}
