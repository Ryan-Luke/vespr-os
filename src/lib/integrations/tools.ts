// Capability-based integration tools.
//
// Agents call tools by CAPABILITY, not by provider. Example:
//   - `crm_create_contact` dispatches to whichever CRM the user connected
//     (GoHighLevel, HubSpot, Pipedrive, Attio, ...)
//   - `pm_create_task` dispatches to Linear, ClickUp, Asana, Notion, Trello
//   - `payments_list_recent` dispatches to Stripe (for now; more later)
//
// This matches the integrate-don't-rebuild principle. BOS never picks a
// favorite. Whatever tool the user already uses, they connect it, and the
// agent's tools just work.
//
// Tools only appear in the agent's toolset when a capability has at least
// one implemented provider connected. When no CRM is connected, the CRM
// tools don't show up at all.

import { tool, jsonSchema } from "ai"
import { db } from "@/lib/db"
import { agents, approvalRequests } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getCRMClient } from "@/lib/integrations/capabilities/crm"
import { getPMClient } from "@/lib/integrations/capabilities/pm"
import { getPaymentsClient } from "@/lib/integrations/capabilities/payments"
import { getMessagingClient } from "@/lib/integrations/capabilities/messaging"

export interface BuildToolsInput {
  workspaceId: string
  agentId?: string
}

// ── CRM tools ─────────────────────────────────────────────

function makeCRMCreateContactTool(workspaceId: string) {
  return tool({
    description:
      "Create a contact in the user's CRM. Use this when the user asks you to log a new lead, add a customer, or save someone's contact info. The user's connected CRM will be used automatically, regardless of which CRM they chose (GoHighLevel, HubSpot, Pipedrive, etc).",
    inputSchema: jsonSchema<{
      email: string
      firstName?: string
      lastName?: string
      phone?: string
      tags?: string[]
      notes?: string
    }>({
      type: "object",
      properties: {
        email: { type: "string", minLength: 3, maxLength: 200 },
        firstName: { type: "string", maxLength: 100 },
        lastName: { type: "string", maxLength: 100 },
        phone: { type: "string", maxLength: 40 },
        tags: { type: "array", items: { type: "string" }, maxItems: 10 },
        notes: { type: "string", maxLength: 2000 },
      },
      required: ["email"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        const client = await getCRMClient(workspaceId)
        if (!client) {
          return { ok: false, error: "No CRM is connected for this workspace." }
        }
        const contact = await client.createContact(workspaceId, input)
        return {
          ok: true,
          provider: client.providerKey,
          contact: {
            id: contact.id,
            email: contact.email,
            name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null,
            url: contact.url,
          },
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown CRM error" }
      }
    },
  })
}

function makeCRMFindContactByEmailTool(workspaceId: string) {
  return tool({
    description:
      "Look up a contact in the user's CRM by email address. Returns the contact's ID, name, phone, and CRM link if found, or null if no match. Use this before tagging or updating a contact so you have the right ID.",
    inputSchema: jsonSchema<{ email: string }>({
      type: "object",
      properties: {
        email: { type: "string", minLength: 3, maxLength: 200 },
      },
      required: ["email"],
      additionalProperties: false,
    }),
    execute: async ({ email }) => {
      try {
        const client = await getCRMClient(workspaceId)
        if (!client) return { ok: false, error: "No CRM is connected for this workspace." }
        const contact = await client.findContactByEmail(workspaceId, email)
        if (!contact) return { ok: true, found: false }
        return {
          ok: true,
          found: true,
          provider: client.providerKey,
          contact: {
            id: contact.id,
            email: contact.email,
            name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null,
            phone: contact.phone,
            url: contact.url,
          },
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown CRM error" }
      }
    },
  })
}

function makeCRMAddTagTool(workspaceId: string) {
  return tool({
    description:
      "Add one or more tags to a CRM contact by contact ID. Tags in modern CRMs (especially GoHighLevel) trigger downstream workflows, email sequences, and pipeline moves. Use this to mark a contact's status, route them to an automation, or segment them. Prefer lowercase hyphenated tag names like 'hot-lead' or 'demo-booked'.",
    inputSchema: jsonSchema<{ contactId: string; tags: string[] }>({
      type: "object",
      properties: {
        contactId: { type: "string", minLength: 1, maxLength: 100 },
        tags: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 60 },
          minItems: 1,
          maxItems: 10,
        },
      },
      required: ["contactId", "tags"],
      additionalProperties: false,
    }),
    execute: async ({ contactId, tags }) => {
      try {
        const client = await getCRMClient(workspaceId)
        if (!client) return { ok: false, error: "No CRM is connected for this workspace." }
        const result = await client.addTags(workspaceId, contactId, tags)
        return { ok: true, provider: client.providerKey, tagsAdded: result.tags }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown CRM error" }
      }
    },
  })
}

function makeCRMListRecentContactsTool(workspaceId: string) {
  return tool({
    description:
      "List the most recent contacts from the user's CRM. Use this when the user asks 'who are my latest leads' or similar. Default 10, max 50.",
    inputSchema: jsonSchema<{ limit?: number }>({
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    }),
    execute: async ({ limit }) => {
      try {
        const client = await getCRMClient(workspaceId)
        if (!client) return { ok: false, error: "No CRM is connected for this workspace." }
        const contacts = await client.listRecentContacts(workspaceId, limit ?? 10)
        return {
          ok: true,
          provider: client.providerKey,
          count: contacts.length,
          contacts: contacts.map((c) => ({
            id: c.id,
            email: c.email,
            name: [c.firstName, c.lastName].filter(Boolean).join(" ") || null,
            phone: c.phone,
            createdAt: c.createdAt,
            url: c.url,
          })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown CRM error" }
      }
    },
  })
}

// ── PM tools ──────────────────────────────────────────────

function makePMCreateTaskTool(workspaceId: string) {
  return tool({
    description:
      "Create a task/issue in the user's project management tool. Use this when the user asks you to log a task, issue, bug, or piece of work. The user's connected PM tool (Linear, ClickUp, Asana, Notion, Trello) will be used automatically.",
    inputSchema: jsonSchema<{
      title: string
      description?: string
      priority?: 0 | 1 | 2 | 3 | 4
    }>({
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        description: { type: "string", maxLength: 4000 },
        priority: {
          type: "number",
          description: "0 none, 1 urgent, 2 high, 3 normal, 4 low",
          enum: [0, 1, 2, 3, 4],
        },
      },
      required: ["title"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        const client = await getPMClient(workspaceId)
        if (!client) {
          return { ok: false, error: "No project management tool is connected for this workspace." }
        }
        const task = await client.createTask(workspaceId, input)
        return {
          ok: true,
          provider: client.providerKey,
          task: { id: task.id, identifier: task.identifier, title: task.title, url: task.url },
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown PM error" }
      }
    },
  })
}

// ── Payments tools ────────────────────────────────────────

function makePaymentsListRecentTool(workspaceId: string) {
  return tool({
    description:
      "List the most recent successful payments received from customers. Use this when the user asks about recent revenue, recent customers, or 'how much money came in'. The user's connected payment processor (Stripe, etc) will be used automatically.",
    inputSchema: jsonSchema<{ limit?: number }>({
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    }),
    execute: async ({ limit }) => {
      try {
        const client = await getPaymentsClient(workspaceId)
        if (!client) return { ok: false, error: "No payment processor is connected for this workspace." }
        const payments = await client.listRecentPayments(workspaceId, limit ?? 10)
        return {
          ok: true,
          provider: client.providerKey,
          count: payments.length,
          payments: payments.map((p) => ({
            id: p.id,
            amount: p.amountFormatted,
            email: p.customerEmail,
            description: p.description,
            status: p.status,
            createdAt: p.createdAt,
          })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown payments error" }
      }
    },
  })
}

function makePaymentsGetBalanceTool(workspaceId: string) {
  return tool({
    description:
      "Get the current balance from the user's payment processor (available + pending). Use this when the user asks 'what's our current balance' or 'how much money is in our processor right now'.",
    inputSchema: jsonSchema<Record<string, never>>({
      type: "object",
      properties: {},
      additionalProperties: false,
    }),
    execute: async () => {
      try {
        const client = await getPaymentsClient(workspaceId)
        if (!client) return { ok: false, error: "No payment processor is connected for this workspace." }
        const balance = await client.getBalance(workspaceId)
        return { ok: true, provider: client.providerKey, ...balance }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown payments error" }
      }
    },
  })
}

// ── Messaging tools (read-only in this slice) ─────────────

function makeMessagingListRecentConversationsTool(workspaceId: string) {
  return tool({
    description:
      "List the most recent conversations from the user's unified inbox (SMS, email, Instagram DM, Facebook Messenger, WhatsApp, web chat). Use this when the user asks 'what's in my inbox', 'any new DMs', or wants a triage summary. Returns up to 100 recent conversations with contact info, last message preview, channel, and unread status.",
    inputSchema: jsonSchema<{ limit?: number }>({
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    }),
    execute: async ({ limit }) => {
      try {
        const client = await getMessagingClient(workspaceId)
        if (!client) return { ok: false, error: "No messaging tool is connected for this workspace." }
        const conversations = await client.listRecentConversations(workspaceId, limit ?? 20)
        return {
          ok: true,
          provider: client.providerKey,
          count: conversations.length,
          unreadCount: conversations.filter((c) => c.unread).length,
          conversations: conversations.map((c) => ({
            id: c.id,
            contactId: c.contactId,
            name: c.contactName,
            email: c.contactEmail,
            phone: c.contactPhone,
            channel: c.channel,
            unread: c.unread,
            lastMessage: c.lastMessagePreview,
            lastMessageAt: c.lastMessageAt,
          })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown messaging error" }
      }
    },
  })
}

function makeMessagingSendMessageDraftTool(workspaceId: string, agentId: string | undefined) {
  return tool({
    description:
      "Draft a message to send to a customer and submit it for the owner's approval. DOES NOT send immediately. The drafted message lands in the approval queue. When the owner clicks approve, the system sends it via the connected messaging tool. Use this whenever the owner asks you to 'reply to', 'message', 'text', 'DM', or 'email' a contact. Always include either a conversationId (to continue an existing thread) or a contactId (to start a new message). Keep the body short, human, and in the owner's voice.",
    inputSchema: jsonSchema<{
      conversationId?: string
      contactId?: string
      channel: "sms" | "email" | "ig_dm" | "fb_messenger" | "whatsapp" | "web_chat"
      body: string
      subject?: string
      reasoning?: string
    }>({
      type: "object",
      properties: {
        conversationId: { type: "string", maxLength: 100 },
        contactId: { type: "string", maxLength: 100 },
        channel: {
          type: "string",
          enum: ["sms", "email", "ig_dm", "fb_messenger", "whatsapp", "web_chat"],
        },
        body: { type: "string", minLength: 1, maxLength: 4000 },
        subject: { type: "string", maxLength: 200 },
        reasoning: {
          type: "string",
          description: "Short explanation of WHY this message makes sense right now. Shown to the owner in the approval queue.",
          maxLength: 500,
        },
      },
      required: ["channel", "body"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        if (!agentId) {
          return { ok: false, error: "Agent context required to draft a message." }
        }
        if (!input.conversationId && !input.contactId) {
          return { ok: false, error: "Either conversationId or contactId is required." }
        }
        // Preview title for the queue card. Keep it under ~80 chars.
        const preview = input.body.length > 60 ? input.body.slice(0, 57) + "..." : input.body
        const title = `Send ${input.channel.toUpperCase()} message`
        const description = `"${preview}"`

        const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)

        const [request] = await db.insert(approvalRequests).values({
          agentId,
          agentName: agent?.name ?? "Agent",
          actionType: "messaging_send_message",
          title,
          description,
          reasoning: input.reasoning ?? null,
          urgency: "normal",
          actionPayload: {
            type: "messaging_send_message",
            workspaceId,
            conversationId: input.conversationId,
            contactId: input.contactId,
            channel: input.channel,
            body: input.body,
            subject: input.subject,
          },
        }).returning()

        return {
          ok: true,
          drafted: true,
          approvalRequestId: request.id,
          message: "Drafted and submitted for approval. The owner will see it in the approval queue and can approve or reject.",
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to draft message" }
      }
    },
  })
}

function makeMessagingListThreadTool(workspaceId: string) {
  return tool({
    description:
      "Fetch the message history of a single conversation by its ID. Use this after `messaging_list_recent_conversations` when the user wants to dig into a specific thread, quote a message, or summarize the back-and-forth.",
    inputSchema: jsonSchema<{ conversationId: string; limit?: number }>({
      type: "object",
      properties: {
        conversationId: { type: "string", minLength: 1, maxLength: 100 },
        limit: { type: "number", minimum: 1, maximum: 100 },
      },
      required: ["conversationId"],
      additionalProperties: false,
    }),
    execute: async ({ conversationId, limit }) => {
      try {
        const client = await getMessagingClient(workspaceId)
        if (!client) return { ok: false, error: "No messaging tool is connected for this workspace." }
        const messages = await client.listMessagesInConversation(workspaceId, conversationId, limit ?? 30)
        return {
          ok: true,
          provider: client.providerKey,
          count: messages.length,
          messages: messages.map((m) => ({
            id: m.id,
            direction: m.direction,
            body: m.body,
            channel: m.channel,
            sentAt: m.sentAt,
          })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown messaging error" }
      }
    },
  })
}

// ── Factory ───────────────────────────────────────────────

/**
 * Returns the capability-based tools dict for a workspace. A capability's
 * tools are exposed only when that capability has an implemented provider
 * connected. Empty object when no capabilities have connected providers.
 */
export async function buildIntegrationTools({ workspaceId, agentId }: BuildToolsInput) {
  const [crmClient, pmClient, paymentsClient, messagingClient] = await Promise.all([
    getCRMClient(workspaceId),
    getPMClient(workspaceId),
    getPaymentsClient(workspaceId),
    getMessagingClient(workspaceId),
  ])

  return {
    ...(crmClient
      ? {
          crm_create_contact: makeCRMCreateContactTool(workspaceId),
          crm_list_recent_contacts: makeCRMListRecentContactsTool(workspaceId),
          crm_find_contact_by_email: makeCRMFindContactByEmailTool(workspaceId),
          crm_add_tag: makeCRMAddTagTool(workspaceId),
        }
      : {}),
    ...(pmClient ? { pm_create_task: makePMCreateTaskTool(workspaceId) } : {}),
    ...(paymentsClient
      ? {
          payments_list_recent: makePaymentsListRecentTool(workspaceId),
          payments_get_balance: makePaymentsGetBalanceTool(workspaceId),
        }
      : {}),
    ...(messagingClient
      ? {
          messaging_list_recent_conversations: makeMessagingListRecentConversationsTool(workspaceId),
          messaging_list_thread: makeMessagingListThreadTool(workspaceId),
          ...(messagingClient.sendMessage && agentId
            ? { messaging_send_message_draft: makeMessagingSendMessageDraftTool(workspaceId, agentId) }
            : {}),
        }
      : {}),
  }
}
