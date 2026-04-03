import { db } from "@/lib/db"
import { agents } from "@/lib/db/schema"

export async function POST(req: Request) {
  const body = await req.json()

  const [newAgent] = await db.insert(agents).values({
    name: body.name,
    role: body.role,
    avatar: body.name.slice(0, 2).toUpperCase(),
    pixelAvatarIndex: Math.floor(Math.random() * 6),
    provider: body.provider || "anthropic",
    model: body.model || "Claude Haiku",
    systemPrompt: body.systemPrompt || body.description || null,
    status: "idle",
    teamId: body.teamId || null,
    skills: body.skills || [],
    config: {},
    tasksCompleted: 0,
    costThisMonth: 0,
  }).returning()

  return Response.json(newAgent)
}
