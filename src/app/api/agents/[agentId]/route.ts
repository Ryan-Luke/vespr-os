import { db } from "@/lib/db"
import { agents, channels, messages } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const body = await req.json()

  // Get current agent state before update
  const [current] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
  if (!current) return Response.json({ error: "Agent not found" }, { status: 404 })

  const updates: Record<string, unknown> = {}

  if (body.status !== undefined) updates.status = body.status
  if (body.currentTask !== undefined) updates.currentTask = body.currentTask
  if (body.systemPrompt !== undefined) updates.systemPrompt = body.systemPrompt
  if (body.isTeamLead !== undefined) updates.isTeamLead = body.isTeamLead
  if (body.autonomyLevel !== undefined) updates.autonomyLevel = body.autonomyLevel

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 })
  }

  updates.updatedAt = new Date()

  const [updated] = await db
    .update(agents)
    .set(updates)
    .where(eq(agents.id, agentId))
    .returning()

  // Post status change message in team channel
  if (body.status && body.status !== current.status && current.teamId) {
    const teamChannel = await db.select().from(channels).where(eq(channels.teamId, current.teamId)).limit(1)
    if (teamChannel[0]) {
      const statusMessages: Record<string, string> = {
        paused: `${current.name} has been paused. They won't participate in conversations until resumed.`,
        idle: `${current.name} is back and ready to work.`,
        working: `${current.name} is now actively working.`,
      }
      const msg = statusMessages[body.status]
      if (msg) {
        await db.insert(messages).values({
          channelId: teamChannel[0].id,
          senderName: "System",
          senderAvatar: "⚙️",
          content: msg,
          messageType: "status",
        })
      }
    }
  }

  return Response.json(updated)
}
