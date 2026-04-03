import { db } from "@/lib/db"
import { agents } from "@/lib/db/schema"
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

  return Response.json(newAgent)
}
