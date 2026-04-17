import { db } from "@/lib/db"
import { agents, channels, messages, tasks, agentFeedback, agentSops, agentMemories, activityLog, knowledgeEntries, agentSchedules, approvalRequests, approvalLog, autoApprovals, decisionLog, automations, milestones, companyMemories } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { guardMinRole } from "@/lib/auth/rbac"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden
  const { agentId } = await params
  const body = await req.json()

  // Get current agent state before update — scoped to workspace
  const [current] = await db.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.workspaceId, auth.workspace.id))).limit(1)
  if (!current) return Response.json({ error: "Agent not found" }, { status: 404 })

  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) updates.name = body.name
  if (body.role !== undefined) updates.role = body.role
  if (body.avatar !== undefined) updates.avatar = body.avatar
  if (body.pixelAvatarIndex !== undefined) updates.pixelAvatarIndex = body.pixelAvatarIndex
  if (body.provider !== undefined) updates.provider = body.provider
  if (body.model !== undefined) updates.model = body.model
  if (body.teamId !== undefined) updates.teamId = body.teamId || null
  if (body.status !== undefined) updates.status = body.status
  if (body.currentTask !== undefined) updates.currentTask = body.currentTask
  if (body.systemPrompt !== undefined) updates.systemPrompt = body.systemPrompt
  if (body.isTeamLead !== undefined) updates.isTeamLead = body.isTeamLead
  if (body.autonomyLevel !== undefined) updates.autonomyLevel = body.autonomyLevel
  if (body.skills !== undefined) updates.skills = body.skills
  if (body.personality !== undefined) updates.personality = body.personality
  if (body.personalityPresetId !== undefined) updates.personalityPresetId = body.personalityPresetId
  if (body.personalityConfig !== undefined) updates.personalityConfig = body.personalityConfig

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
          workspaceId: auth.workspace.id,
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden
  const { agentId } = await params

  const [current] = await db.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.workspaceId, auth.workspace.id))).limit(1)
  if (!current) return Response.json({ error: "Agent not found" }, { status: 404 })

  // Delete related records first (FK constraints)
  await db.delete(agentFeedback).where(eq(agentFeedback.agentId, agentId))
  await db.delete(agentSops).where(eq(agentSops.agentId, agentId))
  await db.delete(agentMemories).where(eq(agentMemories.agentId, agentId))
  await db.delete(activityLog).where(eq(activityLog.agentId, agentId))
  await db.delete(knowledgeEntries).where(eq(knowledgeEntries.createdByAgentId, agentId))
  await db.delete(agentSchedules).where(eq(agentSchedules.agentId, agentId))
  await db.delete(approvalRequests).where(eq(approvalRequests.agentId, agentId))
  await db.delete(approvalLog).where(eq(approvalLog.agentId, agentId))
  await db.delete(autoApprovals).where(eq(autoApprovals.agentId, agentId))
  await db.delete(decisionLog).where(eq(decisionLog.agentId, agentId))
  await db.delete(milestones).where(eq(milestones.agentId, agentId))
  await db.update(automations).set({ managedByAgentId: null }).where(eq(automations.managedByAgentId, agentId))
  await db.update(companyMemories).set({ sourceAgentId: null }).where(eq(companyMemories.sourceAgentId, agentId))
  await db.update(messages).set({ senderAgentId: null }).where(eq(messages.senderAgentId, agentId))

  // Unassign tasks (don't delete them)
  await db.update(tasks).set({ assignedAgentId: null }).where(eq(tasks.assignedAgentId, agentId))

  // Post departure message in team channel
  if (current.teamId) {
    const teamChannel = await db.select().from(channels).where(eq(channels.teamId, current.teamId)).limit(1)
    if (teamChannel[0]) {
      await db.insert(messages).values({
        workspaceId: auth.workspace.id,
        channelId: teamChannel[0].id,
        senderName: "System",
        senderAvatar: "⚙️",
        content: `${current.name} (${current.role}) has been removed from the team.`,
        messageType: "status",
      })
    }
  }

  // Delete the agent
  await db.delete(agents).where(eq(agents.id, agentId))

  return Response.json({ success: true, name: current.name })
}
