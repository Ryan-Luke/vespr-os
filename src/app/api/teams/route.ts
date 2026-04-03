import { db } from "@/lib/db"
import { teams, agents } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const allTeams = await db.select().from(teams)
  const allAgents = await db.select().from(agents)
  const teamsWithAgents = allTeams.map((team) => ({
    ...team,
    agents: allAgents.filter((a) => a.teamId === team.id),
  }))
  return Response.json(teamsWithAgents)
}
