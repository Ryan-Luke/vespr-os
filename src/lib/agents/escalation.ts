// Escalation System. Routes stuck, blocked, or critical situations to
// the right handler: low/medium goes to Nova (Chief of Staff) via an
// agent thread; high/critical also creates a notification for the human
// workspace owner.
//
// Every escalation is logged as a collaboration event for audit.

import { db } from "@/lib/db"
import {
  agents, collaborationEvents, approvalRequests,
  notifications, agentThreads,
} from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { startAgentThread } from "./consultation"

// ── Types ────────────────────────────────────────────────────────────

export type EscalationSeverity = "low" | "medium" | "high" | "critical"

export interface EscalationResult {
  escalationId: string
  handledBy: string
  threadId?: string
  notificationId?: string
}

// ── Constants ────────────────────────────────────────────────────────

const NOVA_AGENT_NAME = "Nova"

// ── Public API ───────────────────────────────────────────────────────

/**
 * Escalate a stuck or blocked situation.
 *
 * Routing:
 *   low/medium    -> Nova thread only
 *   high/critical -> Nova thread + human notification
 *                    + approval request if decision is needed
 */
export async function escalate(params: {
  workspaceId: string
  escalatingAgentId: string
  reason: string
  context: string
  linkedTaskId?: string
  linkedThreadId?: string
  severity: EscalationSeverity
}): Promise<EscalationResult> {
  const {
    workspaceId, escalatingAgentId, reason, context,
    linkedTaskId, linkedThreadId, severity,
  } = params

  // Load escalating agent
  const [agent] = await db.select({
    id: agents.id,
    name: agents.name,
    role: agents.role,
  }).from(agents).where(eq(agents.id, escalatingAgentId)).limit(1)

  const agentName = agent?.name ?? "Unknown Agent"

  // Build escalation message for Nova
  const escalationMessage = `**Escalation from ${agentName}** (severity: ${severity})

**Reason:** ${reason}

**Context:**
${context}

${linkedTaskId ? `Linked task: ${linkedTaskId}` : ""}
${linkedThreadId ? `Linked thread: ${linkedThreadId}` : ""}

Please assess the situation and recommend next steps. If this requires human input, say "NEEDS_HUMAN_INPUT:" followed by what the human needs to decide.`

  // Create thread with Nova
  let threadId: string | undefined
  let novaHandled = false

  try {
    const threadResult = await startAgentThread({
      workspaceId,
      initiatorAgentId: escalatingAgentId,
      targetAgentName: NOVA_AGENT_NAME,
      subject: `Escalation: ${reason.slice(0, 80)}`,
      initialMessage: escalationMessage,
      type: "escalation",
      linkedTaskId,
    })
    threadId = threadResult.threadId
    novaHandled = true
  } catch {
    // Nova might not exist — we'll still create a notification for high/critical
  }

  // Log collaboration event
  const [event] = await db.insert(collaborationEvents).values({
    workspaceId,
    eventType: "escalated",
    sourceAgentId: escalatingAgentId,
    threadId: threadId ?? undefined,
    taskId: linkedTaskId ?? undefined,
    summary: `${agentName} escalated (${severity}): ${reason.slice(0, 200)}`,
    metadata: { severity, linkedThreadId },
  }).returning()

  const escalationId = event.id
  let notificationId: string | undefined
  let handledBy = novaHandled ? NOVA_AGENT_NAME : "system"

  // For high/critical: create human notification + optional approval request
  if (severity === "high" || severity === "critical") {
    const [notif] = await db.insert(notifications).values({
      workspaceId,
      type: severity === "critical" ? "escalation_critical" : "escalation_high",
      title: `${severity === "critical" ? "CRITICAL" : "High"} escalation from ${agentName}`,
      description: reason.slice(0, 500),
      actionUrl: threadId ? `/collaboration/threads/${threadId}` : "/feed",
      read: false,
    }).returning()
    notificationId = notif.id

    // If severity is critical, also create an approval request so the
    // human is forced to make a decision
    if (severity === "critical") {
      await db.insert(approvalRequests).values({
        workspaceId,
        agentId: escalatingAgentId,
        agentName,
        actionType: "escalation_decision",
        title: `Critical escalation: ${reason.slice(0, 100)}`,
        description: `${agentName} has escalated a critical issue that requires your decision.\n\nReason: ${reason}\n\nContext: ${context.slice(0, 1000)}`,
        reasoning: reason,
        urgency: "urgent",
        status: "pending",
        options: [
          { label: "Resolve & Proceed", value: "proceed" },
          { label: "Investigate", value: "investigate" },
          { label: "Pause All Work", value: "pause" },
        ],
      }).catch(() => {}) // best-effort

      handledBy = `${NOVA_AGENT_NAME} + human owner`
    } else {
      handledBy = `${novaHandled ? NOVA_AGENT_NAME + " + " : ""}human owner`
    }
  }

  return { escalationId, handledBy, threadId, notificationId }
}

/**
 * Check if a task is stuck and escalate if needed.
 * A task is "stuck" if it's been in "running" or "in_progress" status
 * for longer than the threshold (default 30 minutes).
 *
 * Called by the cron job to auto-detect stuck work.
 */
export async function escalateIfStuck(params: {
  workspaceId: string
  taskId: string
  taskTitle: string
  assignedAgentId: string
  stuckSinceMinutes: number
}): Promise<EscalationResult | null> {
  const { workspaceId, taskId, taskTitle, assignedAgentId, stuckSinceMinutes } = params

  // Don't escalate until at least 30 minutes
  if (stuckSinceMinutes < 30) return null

  // Determine severity based on how long it's been stuck
  let severity: EscalationSeverity = "low"
  if (stuckSinceMinutes >= 120) severity = "high"
  else if (stuckSinceMinutes >= 60) severity = "medium"

  return escalate({
    workspaceId,
    escalatingAgentId: assignedAgentId,
    reason: `Task "${taskTitle}" has been stuck for ${stuckSinceMinutes} minutes`,
    context: `Task ID: ${taskId}. The agent has not made progress or completed the task within the expected timeframe. This may indicate a blocker, an API timeout, or the agent is waiting on external input.`,
    linkedTaskId: taskId,
    severity,
  })
}
