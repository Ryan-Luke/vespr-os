import { db } from "@/lib/db"
import { agents, channels, teams } from "@/lib/db/schema"
import { eq, inArray, or, isNull } from "drizzle-orm"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId")

  if (!workspaceId) {
    // No workspace filter — return everything (backwards compat)
    const [allAgents, allChannels] = await Promise.all([
      db.select().from(agents),
      db.select().from(channels),
    ])
    return Response.json({ agents: allAgents, channels: allChannels })
  }

  // Get teams in this workspace
  const wsTeams = await db.select().from(teams).where(eq(teams.workspaceId, workspaceId))
  const teamIds = wsTeams.map((t) => t.id)

  if (teamIds.length === 0) {
    return Response.json({ agents: [], channels: [] })
  }

  // Filter agents to those in workspace teams (+ unassigned like Nova/Aria — they belong to workspace system agents)
  // Filter channels to workspace teams + system channels (wins, watercooler, team-leaders)
  const [allAgents, allChannels] = await Promise.all([
    db.select().from(agents).where(or(inArray(agents.teamId, teamIds), isNull(agents.teamId))),
    db.select().from(channels).where(or(inArray(channels.teamId, teamIds), eq(channels.type, "system"))),
  ])
  return Response.json({ agents: allAgents, channels: allChannels })
}
