import { db } from "@/lib/db"
import { agents, channels, messages, teams } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { DEFAULT_TRAITS } from "@/lib/personality-presets"
import { PERSONALITY_PRESETS } from "@/lib/personality-presets"
import type { PersonalityTraits } from "@/lib/personality-presets"
import { ARCHETYPES, inferArchetype, type ArchetypeId } from "@/lib/archetypes"

// ── Personality-aware intro message ───────────────────────
function buildIntroMessage(agent: {
  name: string
  role: string
  skills: string[]
  personality: PersonalityTraits
}): string {
  const { name, role, skills, personality } = agent
  const skillsSummary = skills.length > 0
    ? skills.slice(0, 3).join(", ")
    : "whatever the team needs"

  // High formality (>= 70): professional tone
  if (personality.formality >= 70) {
    return `Good to be here. I'm ${name}, joining as your ${role}. My focus areas include ${skillsSummary}.\n\nLooking forward to contributing. Boss — where would you like me to start?`
  }

  // High humor (>= 70): lighter, more casual
  if (personality.humor >= 70) {
    return `Heyyy what's up! 😄 I'm ${name}, the new ${role} around here. I'm pretty handy with ${skillsSummary} — basically I'm here to make everyone's life easier (and maybe crack a few jokes along the way).\n\nBoss — point me at something fun!`
  }

  // Default: friendly and eager
  return `Hey team! 👋 I'm ${name}, your new ${role}. I'm here to help with ${skillsSummary}.\n\nBoss — what should I focus on first?`
}

export async function POST(req: Request) {
  const body = await req.json()

  // If a preset is selected, use its avatar index; otherwise random
  const preset = body.personalityPresetId
    ? PERSONALITY_PRESETS.find((p) => p.id === body.personalityPresetId)
    : null

  // Infer archetype from role (allow explicit override from body.archetype)
  const archetypeId: ArchetypeId = (body.archetype as ArchetypeId) || inferArchetype(body.role || "")
  const archetypeDef = ARCHETYPES[archetypeId] || ARCHETYPES.operator
  const starterForm = archetypeDef.forms[0]

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
    // Identity system per engagement spec
    nickname: body.name,
    archetype: archetypeId,
    tier: starterForm.tier,
    currentForm: starterForm.name,
    identityStats: archetypeDef.defaultStats,
  }).returning()

  // Post welcome message from team lead + agent intro in the team channel
  if (newAgent.teamId) {
    const [teamChannel, teamLead, team] = await Promise.all([
      db.select().from(channels).where(eq(channels.teamId, newAgent.teamId)).limit(1).then((r) => r[0]),
      db.select().from(agents).where(eq(agents.teamId, newAgent.teamId)).limit(10)
        .then((all) => all.find((a) => a.isTeamLead && a.id !== newAgent.id)),
      db.select().from(teams).where(eq(teams.id, newAgent.teamId)).limit(1).then((r) => r[0]),
    ])

    if (teamChannel) {
      // 1. Team lead welcome (if one exists)
      if (teamLead) {
        await db.insert(messages).values({
          channelId: teamChannel.id,
          senderAgentId: teamLead.id,
          senderName: teamLead.name,
          senderAvatar: teamLead.avatar,
          content: `Welcome to the team, ${newAgent.name}! 👋 You're joining us as ${newAgent.role}. Glad to have you — let's get you up to speed.`,
          messageType: "text",
        })
      }

      // 2. Agent's own intro message (personality-aware)
      const introContent = buildIntroMessage({
        name: newAgent.name,
        role: newAgent.role,
        skills: (newAgent.skills as string[]) || [],
        personality: newAgent.personality as PersonalityTraits,
      })

      await db.insert(messages).values({
        channelId: teamChannel.id,
        senderAgentId: newAgent.id,
        senderName: newAgent.name,
        senderAvatar: newAgent.avatar,
        content: introContent,
        messageType: "text",
      })
    }

    // 3. System message in #wins channel
    const winsChannel = await db.select().from(channels).where(eq(channels.name, "wins")).limit(1).then((r) => r[0])

    if (winsChannel) {
      const teamName = team?.name || "the team"
      await db.insert(messages).values({
        channelId: winsChannel.id,
        senderAgentId: null,
        senderName: "System",
        senderAvatar: "🎉",
        content: `🎉 Welcome ${newAgent.name}! New ${newAgent.role} just joined ${teamName}.`,
        messageType: "system",
      })
    }
  }

  return Response.json(newAgent)
}
