// Approval executor. Runs the action encoded in an approval request's
// `actionPayload` when the user approves it. Per PVD, this is the path
// every customer-facing write action takes: agent drafts, system creates
// an approval request with the full payload, user clicks approve in the
// queue UI, executor fires the real action.
//
// Action types are a discriminated union. Adding a new action is a 3-step
// change: define the payload shape, add a dispatch branch here, and build
// the tool that creates the approval request with the right payload.

import { getMessagingClient } from "@/lib/integrations/capabilities/messaging"

// ── Action types ─────────────────────────────────────────────────────

export interface SendMessageAction {
  type: "messaging_send_message"
  workspaceId: string
  conversationId?: string
  contactId?: string
  channel: "sms" | "email" | "ig_dm" | "fb_messenger" | "whatsapp" | "web_chat"
  body: string
  subject?: string // for email only
}

export type ApprovalAction = SendMessageAction

// ── Result ───────────────────────────────────────────────────────────

export interface ExecutorResult {
  ok: boolean
  provider?: string
  data?: Record<string, unknown>
  error?: string
}

// ── Dispatch ─────────────────────────────────────────────────────────

export function isApprovalAction(payload: unknown): payload is ApprovalAction {
  if (!payload || typeof payload !== "object") return false
  const p = payload as { type?: string }
  return p.type === "messaging_send_message"
}

/**
 * Execute an approval action. Never throws. Returns a structured result
 * that the PATCH handler persists in the approval request's `response`
 * column.
 */
export async function executeApprovalAction(payload: ApprovalAction): Promise<ExecutorResult> {
  try {
    // Discriminated dispatch. When a new action type is added to the
    // ApprovalAction union, add a matching branch here and the isApprovalAction
    // type guard above will prevent unknown types from reaching the executor.
    if (payload.type === "messaging_send_message") {
      const client = await getMessagingClient(payload.workspaceId)
      if (!client) {
        return { ok: false, error: "No messaging tool is connected for this workspace." }
      }
      if (!client.sendMessage) {
        return { ok: false, error: `Provider ${client.providerKey} does not support sending messages yet.` }
      }
      const result = await client.sendMessage(payload.workspaceId, {
        conversationId: payload.conversationId,
        contactId: payload.contactId,
        channel: payload.channel,
        body: payload.body,
        subject: payload.subject,
      })
      return { ok: true, provider: client.providerKey, data: result as unknown as Record<string, unknown> }
    }
    return { ok: false, error: "Unknown action type" }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Executor error" }
  }
}
