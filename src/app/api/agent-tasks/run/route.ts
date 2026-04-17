import { db } from "@/lib/db"
import { agents, channels } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { runAgentTask } from "@/lib/agents/autonomous"
import { withAuth } from "@/lib/auth/with-auth"

export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json() as {
    agentId?: string
    channelId?: string
    prompt?: string
  }

  if (!body.agentId || !body.prompt) {
    return Response.json(
      { error: "agentId and prompt are required" },
      { status: 400 },
    )
  }

  // Auto-resolve channelId if not provided
  let channelId = body.channelId
  if (!channelId) {
    const [agent] = await db.select().from(agents)
      .where(and(eq(agents.id, body.agentId), eq(agents.workspaceId, auth.workspace.id)))
      .limit(1)

    if (agent?.teamId) {
      // Find the team's channel
      const [teamChannel] = await db.select().from(channels)
        .where(and(eq(channels.teamId, agent.teamId), eq(channels.workspaceId, auth.workspace.id)))
        .limit(1)
      channelId = teamChannel?.id
    }

    // Fall back to general channel
    if (!channelId) {
      const [general] = await db.select().from(channels)
        .where(and(eq(channels.name, "general"), eq(channels.workspaceId, auth.workspace.id)))
        .limit(1)
      channelId = general?.id
    }
  }

  if (!channelId) {
    return Response.json({ error: "Could not resolve a channel for this agent" }, { status: 400 })
  }

  const result = await runAgentTask({
    agentId: body.agentId,
    channelId,
    workspaceId: auth.workspace.id,
    prompt: body.prompt,
  })

  return Response.json(result)
}
