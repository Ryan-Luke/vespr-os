import { db } from "@/lib/db"
import { approvalRequests, notifications } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { executeApprovalAction, isApprovalAction } from "@/lib/approvals/executor"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || "pending"

  const requests = status === "all"
    ? await db.select().from(approvalRequests).where(eq(approvalRequests.workspaceId, auth.workspace.id)).orderBy(desc(approvalRequests.createdAt)).limit(50)
    : await db.select().from(approvalRequests).where(and(eq(approvalRequests.workspaceId, auth.workspace.id), eq(approvalRequests.status, status))).orderBy(desc(approvalRequests.createdAt)).limit(50)

  return Response.json(requests)
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json()
  const [request] = await db.insert(approvalRequests).values({
    workspaceId: auth.workspace.id,
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

  // Create notification for the new approval request
  await db.insert(notifications).values({
    workspaceId: auth.workspace.id,
    type: "approval_request",
    title: `New approval: ${body.title}`,
    description: body.description || `${body.agentName || "An agent"} is requesting approval.`,
    actionUrl: "/decisions",
    read: false,
  }).catch(() => {}) // best-effort

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
  const auth = await withAuth()
  const { id, status, response, actionPayloadOverrides } = await req.json() as {
    id: string
    status: "approved" | "rejected" | "modified"
    response?: string
    actionPayloadOverrides?: Record<string, unknown>
  }

  // Load first so we can see if there's an action payload to execute — scoped to workspace
  const [existing] = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, id), eq(approvalRequests.workspaceId, auth.workspace.id))).limit(1)
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
    .where(and(eq(approvalRequests.id, id), eq(approvalRequests.workspaceId, auth.workspace.id)))
    .returning()

  return Response.json(updated)
}
