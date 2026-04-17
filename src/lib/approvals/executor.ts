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
import { getEmailClient } from "@/lib/integrations/capabilities/email"
import { getCalendarClient } from "@/lib/integrations/capabilities/calendar"
import { getSocialClient } from "@/lib/integrations/capabilities/social"

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

export interface SendEmailAction {
  type: "email_send"
  workspaceId: string
  to: string
  subject: string
  body: string
  htmlBody?: string
  replyTo?: string
  cc?: string[]
  bcc?: string[]
}

export interface BookMeetingAction {
  type: "calendar_book_meeting"
  workspaceId: string
  eventTypeId: number
  start: string
  name: string
  email: string
  notes?: string
  timeZone?: string
}

export interface SocialCreatePostAction {
  type: "social_create_post"
  workspaceId: string
  text: string
  profileIds?: string[]
  mediaUrls?: string[]
}

export interface SocialSchedulePostAction {
  type: "social_schedule_post"
  workspaceId: string
  text: string
  scheduledAt: string
  profileIds?: string[]
  mediaUrls?: string[]
}

export type ApprovalAction =
  | SendMessageAction
  | SendEmailAction
  | BookMeetingAction
  | SocialCreatePostAction
  | SocialSchedulePostAction

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
  return [
    "messaging_send_message",
    "email_send",
    "calendar_book_meeting",
    "social_create_post",
    "social_schedule_post",
  ].includes(p.type ?? "")
}

/**
 * Execute an approval action. Never throws. Returns a structured result
 * that the PATCH handler persists in the approval request's `response`
 * column.
 */
export async function executeApprovalAction(payload: ApprovalAction): Promise<ExecutorResult> {
  try {
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

    if (payload.type === "email_send") {
      const client = await getEmailClient(payload.workspaceId)
      if (!client) {
        return { ok: false, error: "No email provider is connected for this workspace." }
      }
      const result = await client.sendEmail(payload.workspaceId, {
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
        htmlBody: payload.htmlBody,
        replyTo: payload.replyTo,
        cc: payload.cc,
        bcc: payload.bcc,
      })
      return { ok: true, provider: client.providerKey, data: result as unknown as Record<string, unknown> }
    }

    if (payload.type === "calendar_book_meeting") {
      const client = await getCalendarClient(payload.workspaceId)
      if (!client) {
        return { ok: false, error: "No calendar tool is connected for this workspace." }
      }
      const booking = await client.createBooking(payload.workspaceId, {
        eventTypeId: payload.eventTypeId,
        start: payload.start,
        name: payload.name,
        email: payload.email,
        notes: payload.notes,
        timeZone: payload.timeZone,
      })
      return { ok: true, provider: client.providerKey, data: booking as unknown as Record<string, unknown> }
    }

    if (payload.type === "social_create_post") {
      const client = await getSocialClient(payload.workspaceId)
      if (!client) return { ok: false, error: "No social media tool is connected." }
      const posts = await client.createPost(payload.workspaceId, {
        text: payload.text,
        profileIds: payload.profileIds,
        mediaUrls: payload.mediaUrls,
      })
      return { ok: true, provider: client.providerKey, data: { posts } as unknown as Record<string, unknown> }
    }

    if (payload.type === "social_schedule_post") {
      const client = await getSocialClient(payload.workspaceId)
      if (!client) return { ok: false, error: "No social media tool is connected." }
      const posts = await client.schedulePost(payload.workspaceId, {
        text: payload.text,
        scheduledAt: payload.scheduledAt,
        profileIds: payload.profileIds,
        mediaUrls: payload.mediaUrls,
      })
      return { ok: true, provider: client.providerKey, data: { posts } as unknown as Record<string, unknown> }
    }

    return { ok: false, error: "Unknown action type" }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Executor error" }
  }
}
