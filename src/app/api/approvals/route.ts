import { db } from "@/lib/db"
import { approvalLog, autoApprovals } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

const AUTO_APPROVE_THRESHOLD = 5

// Log an approval decision and check if we should offer auto-approval
export async function POST(req: Request) {
  const auth = await withAuth()
  const { agentId, actionType, description, decision, reasoning } = await req.json() as {
    agentId: string
    actionType: string
    description: string
    decision: "approved" | "rejected" | "modified"
    reasoning?: string
  }

  // Log the approval
  await db.insert(approvalLog).values({
    workspaceId: auth.workspace.id,
    agentId, actionType, description, decision, reasoning: reasoning || null,
  })

  // Check if this action type has been approved enough times to suggest auto-approval
  let suggestAutoApproval = false
  if (decision === "approved") {
    // Count consecutive approvals for this action type
    const approvals = await db
      .select({ count: sql<number>`count(*)` })
      .from(approvalLog)
      .where(and(
        eq(approvalLog.agentId, agentId),
        eq(approvalLog.actionType, actionType),
        eq(approvalLog.decision, "approved"),
      ))

    const count = Number(approvals[0]?.count ?? 0)

    // Check if auto-approval already exists
    const existing = await db.select().from(autoApprovals)
      .where(and(eq(autoApprovals.agentId, agentId), eq(autoApprovals.actionType, actionType)))

    if (count >= AUTO_APPROVE_THRESHOLD && existing.length === 0) {
      suggestAutoApproval = true
    }
  }

  return Response.json({
    logged: true,
    suggestAutoApproval,
    message: suggestAutoApproval
      ? `You've approved "${actionType}" from this agent ${AUTO_APPROVE_THRESHOLD} times. Want to let them handle this automatically?`
      : null,
  })
}

// Enable auto-approval for an action type
export async function PUT(req: Request) {
  const auth = await withAuth()
  const { agentId, actionType, enable } = await req.json() as {
    agentId: string
    actionType: string
    enable: boolean
  }

  if (enable) {
    // Count how many times it was approved
    const approvals = await db
      .select({ count: sql<number>`count(*)` })
      .from(approvalLog)
      .where(and(
        eq(approvalLog.agentId, agentId),
        eq(approvalLog.actionType, actionType),
        eq(approvalLog.decision, "approved"),
      ))

    await db.insert(autoApprovals).values({
      workspaceId: auth.workspace.id,
      agentId,
      actionType,
      approvalCount: Number(approvals[0]?.count ?? 0),
      enabled: true,
    })
  } else {
    await db.delete(autoApprovals)
      .where(and(eq(autoApprovals.agentId, agentId), eq(autoApprovals.actionType, actionType)))
  }

  return Response.json({ success: true })
}

// Get auto-approvals for an agent
export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const agentId = url.searchParams.get("agentId")

  if (agentId) {
    const autos = await db.select().from(autoApprovals)
      .where(and(eq(autoApprovals.agentId, agentId), eq(autoApprovals.workspaceId, auth.workspace.id)))
    return Response.json(autos)
  }

  // All auto-approvals for this workspace
  const autos = await db.select().from(autoApprovals).where(eq(autoApprovals.workspaceId, auth.workspace.id))
  return Response.json(autos)
}
