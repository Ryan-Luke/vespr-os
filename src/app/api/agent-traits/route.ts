import { db } from "@/lib/db"
import { agentTraits } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")

  if (agentId) {
    const traits = await db.select().from(agentTraits)
      .where(eq(agentTraits.agentId, agentId))
      .orderBy(desc(agentTraits.updatedAt))
    return Response.json(traits)
  }

  const all = await db.select().from(agentTraits)
    .where(eq(agentTraits.workspaceId, auth.workspace.id))
    .orderBy(desc(agentTraits.updatedAt))
  return Response.json(all)
}
