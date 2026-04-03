import { db } from "@/lib/db"
import { teams, agents, channels } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const allTeams = await db.select().from(teams)
  const allAgents = await db.select().from(agents)
  const teamsWithAgents = allTeams.map((team) => ({
    ...team,
    agents: allAgents.filter((a) => a.teamId === team.id),
    lead: allAgents.find((a) => a.id === team.leadAgentId) || null,
  }))
  return Response.json(teamsWithAgents)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [newTeam] = await db.insert(teams).values({
    name: body.name,
    description: body.description || "",
    icon: body.icon || "⚙️",
  }).returning()

  // Auto-create a channel for the new team
  await db.insert(channels).values({
    name: body.name.toLowerCase().replace(/\s+/g, "-"),
    type: "team",
    teamId: newTeam.id,
  })

  return Response.json(newTeam)
}

export async function PATCH(req: Request) {
  const { id, ...updates } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })
  const [updated] = await db.update(teams).set(updates).where(eq(teams.id, id)).returning()
  return Response.json(updated)
}
