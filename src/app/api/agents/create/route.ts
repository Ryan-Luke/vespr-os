import { db } from "@/lib/db"
import { agents, channels, messages } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { DEFAULT_TRAITS } from "@/lib/personality-presets"
import { PERSONALITY_PRESETS } from "@/lib/personality-presets"

export async function POST(req: Request) {
  const body = await req.json()

  // If a preset is selected, use its avatar index; otherwise random
  const preset = body.personalityPresetId
    ? PERSONALITY_PRESETS.find((p) => p.id === body.personalityPresetId)
    : null

  const [newAgent] = await db.insert(agents).values({
    name: body.name,
    role: body.role,
    avatar: body.name.slice(0, 2).toUpperCase(),
    pixelAvatarIndex: preset?.pixelAvatarIndex ?? Math.floor(Math.random() * 6),
    provider: body.provider || "anthropic",
    model: body.model || "Claude Haiku",
    systemPrompt: body.systemPrompt || body.description || null,
    status: "idle",
    teamId: body.teamId || null,
    skills: body.skills || [],
    personalityPresetId: body.personalityPresetId || null,
    personalityConfig: body.personalityConfig || null,
    personality: body.personality || DEFAULT_TRAITS,
    autonomyLevel: body.autonomyLevel || "supervised",
    config: {},
    tasksCompleted: 0,
    costThisMonth: 0,
  }).returning()

  // Post welcome message from team lead in the team channel
  if (newAgent.teamId) {
    const teamChannel = await db.select().from(channels).where(eq(channels.teamId, newAgent.teamId)).limit(1)
    const teamLead = await db.select().from(agents).where(eq(agents.teamId, newAgent.teamId)).limit(10)
      .then((all) => all.find((a) => a.isTeamLead && a.id !== newAgent.id))

    if (teamChannel[0] && teamLead) {
      await db.insert(messages).values({
        channelId: teamChannel[0].id,
        senderAgentId: teamLead.id,
        senderName: teamLead.name,
        senderAvatar: teamLead.avatar,
        content: `Welcome to the team, ${newAgent.name}! 👋 You're joining us as ${newAgent.role}. Glad to have you — let's get you up to speed.`,
        messageType: "text",
      })
    }
  }

  return Response.json(newAgent)
}
