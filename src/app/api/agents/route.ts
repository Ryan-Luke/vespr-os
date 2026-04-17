import { db } from "@/lib/db"
import { agents } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { guardMinRole } from "@/lib/auth/rbac"

export async function GET() {
  const auth = await withAuth()
  // Explicit column selection: excludes systemPrompt, personalityConfig, and
  // config which are internal-only and can contain raw newlines / tabs that
  // trip strict JSON parsers on some clients.
  const allAgents = await db.select({
    id: agents.id,
    name: agents.name,
    role: agents.role,
    avatar: agents.avatar,
    pixelAvatarIndex: agents.pixelAvatarIndex,
    provider: agents.provider,
    model: agents.model,
    status: agents.status,
    teamId: agents.teamId,
    workspaceId: agents.workspaceId,
    currentTask: agents.currentTask,
    skills: agents.skills,
    personality: agents.personality,
    personalityPresetId: agents.personalityPresetId,
    autonomyLevel: agents.autonomyLevel,
    isTeamLead: agents.isTeamLead,
    xp: agents.xp,
    level: agents.level,
    tasksCompleted: agents.tasksCompleted,
    costThisMonth: agents.costThisMonth,
    nickname: agents.nickname,
    archetype: agents.archetype,
    tier: agents.tier,
    identityStats: agents.identityStats,
    outcomeStats: agents.outcomeStats,
    currentForm: agents.currentForm,
    createdAt: agents.createdAt,
  }).from(agents).where(eq(agents.workspaceId, auth.workspace.id))
  return Response.json(allAgents)
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const forbidden = guardMinRole(auth, "admin")
  if (forbidden) return forbidden
  const body = await req.json()
  const [newAgent] = await db.insert(agents).values({ ...body, workspaceId: auth.workspace.id }).returning()
  return Response.json(newAgent)
}
