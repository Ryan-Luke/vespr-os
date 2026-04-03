import { db } from "@/lib/db"
import { agents, channels } from "@/lib/db/schema"

export async function GET() {
  const [allAgents, allChannels] = await Promise.all([
    db.select().from(agents),
    db.select().from(channels),
  ])
  return Response.json({ agents: allAgents, channels: allChannels })
}
