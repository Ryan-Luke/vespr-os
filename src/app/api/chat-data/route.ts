import { db } from "@/lib/db"
import { agents, channels, teams } from "@/lib/db/schema"
import { and, eq, inArray, or, isNull } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET() {
  const auth = await withAuth()

  // Get teams in this workspace
  const wsTeams = await db.select().from(teams).where(eq(teams.workspaceId, auth.workspace.id))
  const teamIds = wsTeams.map((t) => t.id)

  if (teamIds.length === 0) {
    return Response.json({ agents: [], channels: [] })
  }

  // Filter agents to those in workspace teams (+ unassigned like Nova/Aria — they belong to workspace system agents)
  // Filter channels to workspace teams + system channels (wins, watercooler, team-leaders)
  const [allAgents, allChannels] = await Promise.all([
    db.select().from(agents).where(or(inArray(agents.teamId, teamIds), eq(agents.workspaceId, auth.workspace.id))),
    db.select().from(channels).where(or(inArray(channels.teamId, teamIds), and(eq(channels.type, "system"), eq(channels.workspaceId, auth.workspace.id)))),
  ])
  return Response.json({ agents: allAgents, channels: allChannels })
}
