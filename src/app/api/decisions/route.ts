import { db } from "@/lib/db"
import { decisionLog } from "@/lib/db/schema"
import { desc, eq, and } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")
  const limit = Number(url.searchParams.get("limit") ?? 50)
  const offset = Number(url.searchParams.get("offset") ?? 0)

  const entries = agentId
    ? await db.select().from(decisionLog).where(and(eq(decisionLog.agentId, agentId), eq(decisionLog.workspaceId, auth.workspace.id))).orderBy(desc(decisionLog.createdAt)).limit(limit).offset(offset)
    : await db.select().from(decisionLog).where(eq(decisionLog.workspaceId, auth.workspace.id)).orderBy(desc(decisionLog.createdAt)).limit(limit).offset(offset)
  return Response.json(entries)
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json()

  // Input validation
  if (!body.agentName || !body.actionType || !body.title || !body.description) {
    return Response.json(
      { error: "agentName, actionType, title, and description are required" },
      { status: 400 },
    )
  }

  const [entry] = await db.insert(decisionLog).values({
    workspaceId: auth.workspace.id,
    agentId: body.agentId || null,
    agentName: body.agentName,
    actionType: body.actionType,
    title: body.title,
    description: body.description,
    reasoning: body.reasoning || null,
    outcome: body.outcome || null,
    metadata: body.metadata || {},
  }).returning()

  return Response.json(entry)
}
