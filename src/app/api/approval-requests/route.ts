import { db } from "@/lib/db"
import { approvalRequests } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || "pending"

  const requests = status === "all"
    ? await db.select().from(approvalRequests).orderBy(desc(approvalRequests.createdAt)).limit(50)
    : await db.select().from(approvalRequests).where(eq(approvalRequests.status, status)).orderBy(desc(approvalRequests.createdAt)).limit(50)

  return Response.json(requests)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [request] = await db.insert(approvalRequests).values({
    agentId: body.agentId,
    agentName: body.agentName,
    actionType: body.actionType,
    title: body.title,
    description: body.description,
    reasoning: body.reasoning || null,
    options: body.options || null,
    urgency: body.urgency || "normal",
    channelId: body.channelId || null,
  }).returning()

  return Response.json(request)
}

// Resolve an approval request
export async function PATCH(req: Request) {
  const { id, status, response } = await req.json() as {
    id: string
    status: "approved" | "rejected" | "modified"
    response?: string
  }

  const [updated] = await db.update(approvalRequests)
    .set({ status, response: response || null, resolvedAt: new Date() })
    .where(eq(approvalRequests.id, id))
    .returning()

  return Response.json(updated)
}
