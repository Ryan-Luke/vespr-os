import { db } from "@/lib/db"
import { agentBonds, agents } from "@/lib/db/schema"
import { eq, or, desc } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")

  if (!agentId) {
    const all = await db.select().from(agentBonds).where(eq(agentBonds.workspaceId, auth.workspace.id)).orderBy(desc(agentBonds.outcomeLift))
    return Response.json(all)
  }

  // Get bonds where this agent is either side
  const bonds = await db.select().from(agentBonds)
    .where(or(eq(agentBonds.agentAId, agentId), eq(agentBonds.agentBId, agentId)))
    .orderBy(desc(agentBonds.outcomeLift))

  // Enrich with the "other" agent's name
  const allAgents = await db.select().from(agents).where(eq(agents.workspaceId, auth.workspace.id))
  const enriched = bonds.map((b) => {
    const otherId = b.agentAId === agentId ? b.agentBId : b.agentAId
    const other = allAgents.find((a) => a.id === otherId)
    return {
      ...b,
      otherAgent: other ? { id: other.id, name: other.name, nickname: other.nickname, pixelAvatarIndex: other.pixelAvatarIndex } : null,
    }
  })

  return Response.json(enriched)
}
