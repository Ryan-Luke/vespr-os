import { db } from "@/lib/db"
import { approvalRequests } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { executeApprovalAction, isApprovalAction } from "@/lib/approvals/executor"

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
    actionPayload: body.actionPayload || null,
    urgency: body.urgency || "normal",
    channelId: body.channelId || null,
  }).returning()

  return Response.json(request)
}

// Resolve an approval request. When the decision is "approved" AND the
// request carries an actionPayload, the executor runs the action and the
// result is persisted back to the `response` column. If execution fails,
// the status still moves to "approved" (the user DID approve) but the
// error is stored so the UI can surface it.
//
// `actionPayloadOverrides` lets the owner edit the draft before approving.
// Example: tweaking the message body before sending. Overrides are shallow-
// merged into the stored actionPayload, persisted back to the DB so the
// audit trail reflects what was actually executed, then passed to the
// executor.
export async function PATCH(req: Request) {
  const { id, status, response, actionPayloadOverrides } = await req.json() as {
    id: string
    status: "approved" | "rejected" | "modified"
    response?: string
    actionPayloadOverrides?: Record<string, unknown>
  }

  // Load first so we can see if there's an action payload to execute
  const [existing] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id)).limit(1)
  if (!existing) {
    return Response.json({ error: "Approval request not found" }, { status: 404 })
  }

  let finalResponse = response || null
  let executedAt: Date | null = null
  let mergedPayload: Record<string, unknown> | null = existing.actionPayload ?? null

  if (
    status === "approved" &&
    existing.actionPayload &&
    isApprovalAction(existing.actionPayload)
  ) {
    // Shallow-merge overrides into the stored payload
    mergedPayload = actionPayloadOverrides
      ? { ...existing.actionPayload, ...actionPayloadOverrides }
      : existing.actionPayload
    if (isApprovalAction(mergedPayload)) {
      const result = await executeApprovalAction(mergedPayload)
      finalResponse = JSON.stringify(result)
      executedAt = new Date()
    } else {
      finalResponse = JSON.stringify({ ok: false, error: "Overrides produced an invalid action payload." })
      executedAt = new Date()
    }
  }

  const [updated] = await db.update(approvalRequests)
    .set({
      status,
      response: finalResponse,
      resolvedAt: new Date(),
      executedAt,
      actionPayload: mergedPayload,
    })
    .where(eq(approvalRequests.id, id))
    .returning()

  return Response.json(updated)
}
