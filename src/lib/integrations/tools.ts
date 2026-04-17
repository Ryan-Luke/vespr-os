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
import { getEmailClient } from "@/lib/integrations/capabilities/email"
import { getCalendarClient } from "@/lib/integrations/capabilities/calendar"
import { getSocialClient } from "@/lib/integrations/capabilities/social"
import { getDocsClient } from "@/lib/integrations/capabilities/docs"
import { getAnalyticsClient } from "@/lib/integrations/capabilities/analytics"

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

function makeCRMUpdateContactTool(workspaceId: string) {
  return tool({
    description:
      "Update an existing contact in the user's CRM. Use this when the user asks you to change a contact's name, phone, email, or other details. You need the contact's ID (use crm_find_contact_by_email first if you only have an email).",
    inputSchema: jsonSchema<{
      contactId: string
      firstName?: string
      lastName?: string
      phone?: string
      email?: string
      tags?: string[]
      notes?: string
    }>({
      type: "object",
      properties: {
        contactId: { type: "string", minLength: 1, maxLength: 100 },
        firstName: { type: "string", maxLength: 100 },
        lastName: { type: "string", maxLength: 100 },
        phone: { type: "string", maxLength: 40 },
        email: { type: "string", maxLength: 200 },
        tags: { type: "array", items: { type: "string" }, maxItems: 10 },
        notes: { type: "string", maxLength: 2000 },
      },
      required: ["contactId"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        const client = await getCRMClient(workspaceId)
        if (!client) return { ok: false, error: "No CRM is connected for this workspace." }
        const { contactId, ...updateFields } = input
        const contact = await client.updateContact(workspaceId, contactId, updateFields)
        return {
          ok: true,
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

function makeCRMCreateDealTool(workspaceId: string) {
  return tool({
    description:
      "Create a deal/opportunity in the user's CRM pipeline. Use this when the user asks you to 'create a deal', 'add an opportunity', or 'start a pipeline entry'. Requires a contactId (use crm_find_contact_by_email first). If no pipeline or stage is specified, uses the default.",
    inputSchema: jsonSchema<{
      title: string
      contactId: string
      pipelineId?: string
      stageId?: string
      value?: number
      currency?: string
      notes?: string
    }>({
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        contactId: { type: "string", minLength: 1, maxLength: 100 },
        pipelineId: { type: "string", maxLength: 100 },
        stageId: { type: "string", maxLength: 100 },
        value: { type: "number", description: "Deal value in cents (e.g. 50000 = $500.00)" },
        currency: { type: "string", maxLength: 5, description: "ISO currency code, defaults to USD" },
        notes: { type: "string", maxLength: 2000 },
      },
      required: ["title", "contactId"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        const client = await getCRMClient(workspaceId)
        if (!client) return { ok: false, error: "No CRM is connected for this workspace." }
        const deal = await client.createDeal(workspaceId, input)
        return {
          ok: true,
          provider: client.providerKey,
          deal: {
            id: deal.id,
            title: deal.title,
            stage: deal.stageName,
            value: deal.valueFormatted,
            url: deal.url,
          },
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown CRM error" }
      }
    },
  })
}

function makeCRMUpdateDealStageTool(workspaceId: string) {
  return tool({
    description:
      "Move a deal to a different pipeline stage. Use this when the user says 'move this deal to...', 'advance the deal', or 'mark the deal as...'. Use crm_list_pipeline_stages first to see available stages and their IDs.",
    inputSchema: jsonSchema<{ dealId: string; stageId: string }>({
      type: "object",
      properties: {
        dealId: { type: "string", minLength: 1, maxLength: 100 },
        stageId: { type: "string", minLength: 1, maxLength: 100 },
      },
      required: ["dealId", "stageId"],
      additionalProperties: false,
    }),
    execute: async ({ dealId, stageId }) => {
      try {
        const client = await getCRMClient(workspaceId)
        if (!client) return { ok: false, error: "No CRM is connected for this workspace." }
        const deal = await client.updateDealStage(workspaceId, dealId, stageId)
        return {
          ok: true,
          provider: client.providerKey,
          deal: { id: deal.id, title: deal.title, stage: deal.stageName, url: deal.url },
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown CRM error" }
      }
    },
  })
}

function makeCRMListDealsTool(workspaceId: string) {
  return tool({
    description:
      "List recent deals/opportunities from the user's CRM. Use when the user asks about their pipeline, active deals, or revenue forecast.",
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
        const deals = await client.listDeals(workspaceId, limit ?? 10)
        return {
          ok: true,
          provider: client.providerKey,
          count: deals.length,
          deals: deals.map((d) => ({
            id: d.id, title: d.title, stage: d.stageName,
            value: d.valueFormatted, status: d.status, createdAt: d.createdAt, url: d.url,
          })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown CRM error" }
      }
    },
  })
}

function makeCRMAddNoteTool(workspaceId: string) {
  return tool({
    description:
      "Add a note to a CRM contact. Use when the user wants to log a note, memo, or observation about a contact.",
    inputSchema: jsonSchema<{ contactId: string; body: string }>({
      type: "object",
      properties: {
        contactId: { type: "string", minLength: 1, maxLength: 100 },
        body: { type: "string", minLength: 1, maxLength: 4000 },
      },
      required: ["contactId", "body"],
      additionalProperties: false,
    }),
    execute: async ({ contactId, body }) => {
      try {
        const client = await getCRMClient(workspaceId)
        if (!client) return { ok: false, error: "No CRM is connected for this workspace." }
        const note = await client.addNote(workspaceId, contactId, body)
        return { ok: true, provider: client.providerKey, note: { id: note.id, body: note.body } }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown CRM error" }
      }
    },
  })
}

function makeCRMListPipelineStages(workspaceId: string) {
  return tool({
    description:
      "List all pipeline stages in the user's CRM. Use this before creating a deal or moving a deal between stages, so you know the available stage IDs and names.",
    inputSchema: jsonSchema<Record<string, never>>({
      type: "object",
      properties: {},
      additionalProperties: false,
    }),
    execute: async () => {
      try {
        const client = await getCRMClient(workspaceId)
        if (!client) return { ok: false, error: "No CRM is connected for this workspace." }
        const stages = await client.listPipelineStages(workspaceId)
        return {
          ok: true,
          provider: client.providerKey,
          count: stages.length,
          stages: stages.map((s) => ({
            id: s.id, name: s.name, pipeline: s.pipelineName, position: s.position,
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

// ── PM tools (new) ───────────────────────────────────────

function makePMUpdateTaskTool(workspaceId: string) {
  return tool({
    description:
      "Update an existing task/issue in the user's PM tool. Use when the user asks to change a task's title, description, status, priority, or assignee.",
    inputSchema: jsonSchema<{
      taskId: string
      title?: string
      description?: string
      priority?: 0 | 1 | 2 | 3 | 4
      stateId?: string
      assigneeId?: string
    }>({
      type: "object",
      properties: {
        taskId: { type: "string", minLength: 1, maxLength: 100 },
        title: { type: "string", maxLength: 200 },
        description: { type: "string", maxLength: 4000 },
        priority: { type: "number", enum: [0, 1, 2, 3, 4] },
        stateId: { type: "string", maxLength: 100, description: "Status/state ID to move the task to" },
        assigneeId: { type: "string", maxLength: 100 },
      },
      required: ["taskId"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        const client = await getPMClient(workspaceId)
        if (!client) return { ok: false, error: "No PM tool is connected for this workspace." }
        const { taskId, ...updateFields } = input
        const task = await client.updateTask(workspaceId, taskId, updateFields)
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

function makePMAddCommentTool(workspaceId: string) {
  return tool({
    description:
      "Add a comment to a task/issue in the user's PM tool. Use when the user wants to leave an update, question, or note on a task.",
    inputSchema: jsonSchema<{ taskId: string; body: string }>({
      type: "object",
      properties: {
        taskId: { type: "string", minLength: 1, maxLength: 100 },
        body: { type: "string", minLength: 1, maxLength: 4000 },
      },
      required: ["taskId", "body"],
      additionalProperties: false,
    }),
    execute: async ({ taskId, body }) => {
      try {
        const client = await getPMClient(workspaceId)
        if (!client) return { ok: false, error: "No PM tool is connected for this workspace." }
        const comment = await client.addComment(workspaceId, taskId, body)
        return { ok: true, provider: client.providerKey, comment: { id: comment.id, body: comment.body } }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown PM error" }
      }
    },
  })
}

function makePMListTasksTool(workspaceId: string) {
  return tool({
    description:
      "List recent tasks/issues from the user's PM tool. Use when the user asks 'what are my tasks', 'show me open issues', or wants a work summary.",
    inputSchema: jsonSchema<{ limit?: number }>({
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    }),
    execute: async ({ limit }) => {
      try {
        const client = await getPMClient(workspaceId)
        if (!client) return { ok: false, error: "No PM tool is connected for this workspace." }
        const tasks = await client.listTasks(workspaceId, limit ?? 10)
        return {
          ok: true,
          provider: client.providerKey,
          count: tasks.length,
          tasks: tasks.map((t) => ({ id: t.id, identifier: t.identifier, title: t.title, url: t.url })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown PM error" }
      }
    },
  })
}

function makePMGetTaskTool(workspaceId: string) {
  return tool({
    description:
      "Get full details of a specific task/issue including description, status, assignee, and comments. Use when the user asks about a specific task or wants to see its history.",
    inputSchema: jsonSchema<{ taskId: string }>({
      type: "object",
      properties: {
        taskId: { type: "string", minLength: 1, maxLength: 100 },
      },
      required: ["taskId"],
      additionalProperties: false,
    }),
    execute: async ({ taskId }) => {
      try {
        const client = await getPMClient(workspaceId)
        if (!client) return { ok: false, error: "No PM tool is connected for this workspace." }
        const task = await client.getTask(workspaceId, taskId)
        return {
          ok: true,
          provider: client.providerKey,
          task: {
            id: task.id, identifier: task.identifier, title: task.title,
            description: task.description, status: task.status, priority: task.priority,
            assignee: task.assigneeName, url: task.url,
            createdAt: task.createdAt, updatedAt: task.updatedAt,
            comments: task.comments.map((c) => ({
              id: c.id, body: c.body, author: c.authorName, createdAt: c.createdAt,
            })),
          },
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown PM error" }
      }
    },
  })
}

// ── Email tools (approval-gated) ─────────────────────────

function makeEmailSendDraftTool(workspaceId: string, agentId: string | undefined) {
  return tool({
    description:
      "Draft an email to send to someone and submit it for the owner's approval. DOES NOT send immediately. The email will appear in the approval queue. When the owner approves it, the system sends it via the connected email provider (Resend, SendGrid, etc). Use this whenever the user asks you to 'email someone', 'send an email', or 'write an email to...'.",
    inputSchema: jsonSchema<{
      to: string
      subject: string
      body: string
      htmlBody?: string
      replyTo?: string
      cc?: string[]
      bcc?: string[]
      reasoning?: string
    }>({
      type: "object",
      properties: {
        to: { type: "string", minLength: 3, maxLength: 200, description: "Recipient email address" },
        subject: { type: "string", minLength: 1, maxLength: 200 },
        body: { type: "string", minLength: 1, maxLength: 10000, description: "Plain text email body" },
        htmlBody: { type: "string", maxLength: 50000, description: "Optional HTML version of the email body" },
        replyTo: { type: "string", maxLength: 200 },
        cc: { type: "array", items: { type: "string" }, maxItems: 10 },
        bcc: { type: "array", items: { type: "string" }, maxItems: 10 },
        reasoning: { type: "string", maxLength: 500, description: "Why this email should be sent. Shown to the owner in the approval queue." },
      },
      required: ["to", "subject", "body"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        if (!agentId) return { ok: false, error: "Agent context required to draft an email." }
        const preview = input.body.length > 80 ? input.body.slice(0, 77) + "..." : input.body
        const title = `Send email to ${input.to}: "${input.subject}"`
        const description = `To: ${input.to}\nSubject: ${input.subject}\n\n${preview}`
        const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
        const [request] = await db.insert(approvalRequests).values({
          agentId,
          agentName: agent?.name ?? "Agent",
          actionType: "email_send",
          title,
          description,
          reasoning: input.reasoning ?? null,
          urgency: "normal",
          actionPayload: {
            type: "email_send",
            workspaceId,
            to: input.to,
            subject: input.subject,
            body: input.body,
            htmlBody: input.htmlBody,
            replyTo: input.replyTo,
            cc: input.cc,
            bcc: input.bcc,
          },
        }).returning()
        return {
          ok: true,
          drafted: true,
          approvalRequestId: request.id,
          message: `Email to ${input.to} drafted and submitted for approval. The owner will review it in the approval queue.`,
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to draft email" }
      }
    },
  })
}

// ���─ Calendar tools ───────────────────────────────────────

function makeCalendarCheckAvailabilityTool(workspaceId: string) {
  return tool({
    description:
      "Check the user's calendar availability for a date range. Returns available time slots. Use this when someone asks 'when are you free', 'can we book a call', or before suggesting meeting times.",
    inputSchema: jsonSchema<{
      dateFrom: string
      dateTo: string
      eventTypeId?: number
    }>({
      type: "object",
      properties: {
        dateFrom: { type: "string", description: "Start date in YYYY-MM-DD format" },
        dateTo: { type: "string", description: "End date in YYYY-MM-DD format" },
        eventTypeId: { type: "number", description: "Optional: specific event type ID to check availability for" },
      },
      required: ["dateFrom", "dateTo"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        const client = await getCalendarClient(workspaceId)
        if (!client) return { ok: false, error: "No calendar tool is connected for this workspace." }
        const slots = await client.getAvailability(workspaceId, input)
        return {
          ok: true,
          provider: client.providerKey,
          count: slots.length,
          slots: slots.map((s) => ({ start: s.start, end: s.end })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown calendar error" }
      }
    },
  })
}

function makeCalendarListBookingsTool(workspaceId: string) {
  return tool({
    description:
      "List upcoming calendar bookings. Use when the user asks 'what meetings do I have', 'my upcoming calls', or wants a schedule overview.",
    inputSchema: jsonSchema<{ limit?: number }>({
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    }),
    execute: async ({ limit }) => {
      try {
        const client = await getCalendarClient(workspaceId)
        if (!client) return { ok: false, error: "No calendar tool is connected for this workspace." }
        const bookings = await client.listBookings(workspaceId, limit ?? 10)
        return {
          ok: true,
          provider: client.providerKey,
          count: bookings.length,
          bookings: bookings.map((b) => ({
            id: b.id, uid: b.uid, title: b.title,
            start: b.startTime, end: b.endTime,
            attendee: b.attendeeEmail, status: b.status, meetingUrl: b.meetingUrl,
          })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown calendar error" }
      }
    },
  })
}

function makeCalendarBookMeetingDraftTool(workspaceId: string, agentId: string | undefined) {
  return tool({
    description:
      "Draft a meeting booking and submit it for the owner's approval. DOES NOT book immediately. Use calendar_check_availability first to find an open slot, then use this to propose the booking. The owner reviews and approves before the meeting is actually created.",
    inputSchema: jsonSchema<{
      eventTypeId: number
      start: string
      name: string
      email: string
      notes?: string
      timeZone?: string
      reasoning?: string
    }>({
      type: "object",
      properties: {
        eventTypeId: { type: "number", description: "Cal.com event type ID" },
        start: { type: "string", description: "Meeting start time in ISO format" },
        name: { type: "string", minLength: 1, maxLength: 200, description: "Attendee name" },
        email: { type: "string", minLength: 3, maxLength: 200, description: "Attendee email" },
        notes: { type: "string", maxLength: 2000 },
        timeZone: { type: "string", maxLength: 50, description: "Attendee timezone, defaults to UTC" },
        reasoning: { type: "string", maxLength: 500 },
      },
      required: ["eventTypeId", "start", "name", "email"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        if (!agentId) return { ok: false, error: "Agent context required to draft a booking." }
        const title = `Book meeting with ${input.name} (${input.email})`
        const description = `Time: ${input.start}\nAttendee: ${input.name} <${input.email}>${input.notes ? `\nNotes: ${input.notes}` : ""}`
        const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
        const [request] = await db.insert(approvalRequests).values({
          agentId,
          agentName: agent?.name ?? "Agent",
          actionType: "calendar_book_meeting",
          title,
          description,
          reasoning: input.reasoning ?? null,
          urgency: "normal",
          actionPayload: {
            type: "calendar_book_meeting",
            workspaceId,
            eventTypeId: input.eventTypeId,
            start: input.start,
            name: input.name,
            email: input.email,
            notes: input.notes,
            timeZone: input.timeZone,
          },
        }).returning()
        return {
          ok: true, drafted: true, approvalRequestId: request.id,
          message: `Meeting with ${input.name} drafted and submitted for approval.`,
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to draft booking" }
      }
    },
  })
}

// ── Social media tools (approval-gated) ──────────────────

function makeSocialCreatePostDraftTool(workspaceId: string, agentId: string | undefined) {
  return tool({
    description:
      "Draft a social media post for the owner's approval. DOES NOT publish immediately. The post appears in the approval queue. When approved, it's published via Buffer to the connected social media profiles.",
    inputSchema: jsonSchema<{
      text: string
      profileIds?: string[]
      mediaUrls?: string[]
      reasoning?: string
    }>({
      type: "object",
      properties: {
        text: { type: "string", minLength: 1, maxLength: 2000, description: "The post text content" },
        profileIds: { type: "array", items: { type: "string" }, maxItems: 10 },
        mediaUrls: { type: "array", items: { type: "string" }, maxItems: 4 },
        reasoning: { type: "string", maxLength: 500 },
      },
      required: ["text"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        if (!agentId) return { ok: false, error: "Agent context required to draft a post." }
        const preview = input.text.length > 80 ? input.text.slice(0, 77) + "..." : input.text
        const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
        const [request] = await db.insert(approvalRequests).values({
          agentId, agentName: agent?.name ?? "Agent",
          actionType: "social_create_post",
          title: "Publish social media post",
          description: `"${preview}"`,
          reasoning: input.reasoning ?? null, urgency: "normal",
          actionPayload: { type: "social_create_post", workspaceId, text: input.text, profileIds: input.profileIds, mediaUrls: input.mediaUrls },
        }).returning()
        return { ok: true, drafted: true, approvalRequestId: request.id, message: "Social post drafted and submitted for approval." }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to draft post" }
      }
    },
  })
}

function makeSocialSchedulePostDraftTool(workspaceId: string, agentId: string | undefined) {
  return tool({
    description:
      "Draft a social media post to be scheduled for a specific time, pending owner approval.",
    inputSchema: jsonSchema<{
      text: string
      scheduledAt: string
      profileIds?: string[]
      mediaUrls?: string[]
      reasoning?: string
    }>({
      type: "object",
      properties: {
        text: { type: "string", minLength: 1, maxLength: 2000 },
        scheduledAt: { type: "string", description: "ISO datetime for when to publish the post" },
        profileIds: { type: "array", items: { type: "string" }, maxItems: 10 },
        mediaUrls: { type: "array", items: { type: "string" }, maxItems: 4 },
        reasoning: { type: "string", maxLength: 500 },
      },
      required: ["text", "scheduledAt"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        if (!agentId) return { ok: false, error: "Agent context required." }
        const preview = input.text.length > 80 ? input.text.slice(0, 77) + "..." : input.text
        const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
        const [request] = await db.insert(approvalRequests).values({
          agentId, agentName: agent?.name ?? "Agent",
          actionType: "social_schedule_post",
          title: `Schedule social post for ${input.scheduledAt}`,
          description: `Scheduled: ${input.scheduledAt}\n\n"${preview}"`,
          reasoning: input.reasoning ?? null, urgency: "normal",
          actionPayload: { type: "social_schedule_post", workspaceId, text: input.text, scheduledAt: input.scheduledAt, profileIds: input.profileIds, mediaUrls: input.mediaUrls },
        }).returning()
        return { ok: true, drafted: true, approvalRequestId: request.id, message: `Social post scheduled for ${input.scheduledAt} and submitted for approval.` }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to draft post" }
      }
    },
  })
}

function makeSocialListScheduledTool(workspaceId: string) {
  return tool({
    description:
      "List pending/scheduled social media posts. Read-only. Use when the user asks 'what's scheduled', 'upcoming posts', or 'what's in my social queue'.",
    inputSchema: jsonSchema<{ limit?: number }>({
      type: "object",
      properties: { limit: { type: "number", minimum: 1, maximum: 50 } },
      additionalProperties: false,
    }),
    execute: async ({ limit }) => {
      try {
        const client = await getSocialClient(workspaceId)
        if (!client) return { ok: false, error: "No social media tool is connected." }
        const posts = await client.listScheduledPosts(workspaceId, limit ?? 10)
        return {
          ok: true, provider: client.providerKey, count: posts.length,
          posts: posts.map((p) => ({ id: p.id, text: p.text, profile: p.profileName, scheduledAt: p.scheduledAt, status: p.status })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown social error" }
      }
    },
  })
}

// ── Docs tools ───────────────────────────────────────────

function makeDocsCreatePageTool(workspaceId: string) {
  return tool({
    description:
      "Create a new page/document in the user's connected docs tool (Notion, Google Docs). Use when the user asks to 'create a doc', 'write up a page', 'make a brief', etc. Supports markdown in the content field.",
    inputSchema: jsonSchema<{ title: string; content: string; parentId?: string }>({
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        content: { type: "string", minLength: 1, maxLength: 50000, description: "Page content in markdown format" },
        parentId: { type: "string", maxLength: 100, description: "Optional parent page/database ID." },
      },
      required: ["title", "content"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        const client = await getDocsClient(workspaceId)
        if (!client) return { ok: false, error: "No docs tool is connected for this workspace." }
        const page = await client.createPage(workspaceId, input)
        return { ok: true, provider: client.providerKey, page: { id: page.id, title: page.title, url: page.url } }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown docs error" }
      }
    },
  })
}

function makeDocsUpdatePageTool(workspaceId: string) {
  return tool({
    description:
      "Update an existing page/document. Can change the title, replace the content, or both.",
    inputSchema: jsonSchema<{ pageId: string; title?: string; content?: string }>({
      type: "object",
      properties: {
        pageId: { type: "string", minLength: 1, maxLength: 100 },
        title: { type: "string", maxLength: 200 },
        content: { type: "string", maxLength: 50000, description: "New page content in markdown. Replaces existing content entirely." },
      },
      required: ["pageId"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        const client = await getDocsClient(workspaceId)
        if (!client) return { ok: false, error: "No docs tool is connected for this workspace." }
        const { pageId, ...updateFields } = input
        const page = await client.updatePage(workspaceId, pageId, updateFields)
        return { ok: true, provider: client.providerKey, page: { id: page.id, title: page.title, url: page.url } }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown docs error" }
      }
    },
  })
}

function makeDocsSearchTool(workspaceId: string) {
  return tool({
    description:
      "Search for pages/documents by keyword. Use when the user asks 'find the doc about...', 'look up our page on...', or needs to locate an existing document.",
    inputSchema: jsonSchema<{ query: string; limit?: number }>({
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 200 },
        limit: { type: "number", minimum: 1, maximum: 50 },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    execute: async ({ query, limit }) => {
      try {
        const client = await getDocsClient(workspaceId)
        if (!client) return { ok: false, error: "No docs tool is connected for this workspace." }
        const results = await client.search(workspaceId, query, limit ?? 10)
        return {
          ok: true, provider: client.providerKey, count: results.length,
          results: results.map((r) => ({ id: r.id, title: r.title, url: r.url, snippet: r.snippet })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown docs error" }
      }
    },
  })
}

// ── Analytics tools (read-only, no approval gate) ────────

function makeAnalyticsGetMetricsTool(workspaceId: string) {
  return tool({
    description:
      "Get analytics metrics (pageviews, unique users, etc.) for a date range. Use when the user asks 'how are we doing', 'traffic this week', 'user growth', or any metrics question.",
    inputSchema: jsonSchema<{ dateFrom: string; dateTo: string }>({
      type: "object",
      properties: {
        dateFrom: { type: "string", description: "Start date in YYYY-MM-DD format" },
        dateTo: { type: "string", description: "End date in YYYY-MM-DD format" },
      },
      required: ["dateFrom", "dateTo"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        const client = await getAnalyticsClient(workspaceId)
        if (!client) return { ok: false, error: "No analytics tool is connected for this workspace." }
        const insight = await client.getMetrics(workspaceId, input.dateFrom, input.dateTo)
        return {
          ok: true, provider: client.providerKey, name: insight.name, dateRange: insight.dateRange,
          metrics: insight.metrics.map((m) => ({
            name: m.name, value: m.value,
            change: m.changePercent !== undefined ? `${m.changePercent > 0 ? "+" : ""}${m.changePercent.toFixed(1)}%` : null,
          })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown analytics error" }
      }
    },
  })
}

function makeAnalyticsGetEventsTool(workspaceId: string) {
  return tool({
    description:
      "Get recent analytics events. Use when the user wants to see specific user actions, debug event tracking, or understand what users are doing. Can filter by event name.",
    inputSchema: jsonSchema<{ eventName?: string; limit?: number }>({
      type: "object",
      properties: {
        eventName: { type: "string", maxLength: 200, description: "Filter by event name (e.g. '$pageview'). Omit for all events." },
        limit: { type: "number", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    }),
    execute: async ({ eventName, limit }) => {
      try {
        const client = await getAnalyticsClient(workspaceId)
        if (!client) return { ok: false, error: "No analytics tool is connected for this workspace." }
        const events = await client.getEvents(workspaceId, eventName, limit ?? 20)
        return {
          ok: true, provider: client.providerKey, count: events.length,
          events: events.map((e) => ({
            event: e.event, timestamp: e.timestamp, user: e.distinctId,
            url: (e.properties.$current_url as string) ?? null,
            browser: (e.properties.$browser as string) ?? null,
            os: (e.properties.$os as string) ?? null,
          })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown analytics error" }
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
  const [crmClient, pmClient, paymentsClient, messagingClient, emailClient, calendarClient, socialClient, docsClient, analyticsClient] = await Promise.all([
    getCRMClient(workspaceId),
    getPMClient(workspaceId),
    getPaymentsClient(workspaceId),
    getMessagingClient(workspaceId),
    getEmailClient(workspaceId),
    getCalendarClient(workspaceId),
    getSocialClient(workspaceId),
    getDocsClient(workspaceId),
    getAnalyticsClient(workspaceId),
  ])

  return {
    ...(crmClient
      ? {
          crm_create_contact: makeCRMCreateContactTool(workspaceId),
          crm_list_recent_contacts: makeCRMListRecentContactsTool(workspaceId),
          crm_find_contact_by_email: makeCRMFindContactByEmailTool(workspaceId),
          crm_add_tag: makeCRMAddTagTool(workspaceId),
          crm_update_contact: makeCRMUpdateContactTool(workspaceId),
          crm_create_deal: makeCRMCreateDealTool(workspaceId),
          crm_update_deal_stage: makeCRMUpdateDealStageTool(workspaceId),
          crm_list_deals: makeCRMListDealsTool(workspaceId),
          crm_add_note: makeCRMAddNoteTool(workspaceId),
          crm_list_pipeline_stages: makeCRMListPipelineStages(workspaceId),
        }
      : {}),
    ...(pmClient
      ? {
          pm_create_task: makePMCreateTaskTool(workspaceId),
          pm_update_task: makePMUpdateTaskTool(workspaceId),
          pm_add_comment: makePMAddCommentTool(workspaceId),
          pm_list_tasks: makePMListTasksTool(workspaceId),
          pm_get_task: makePMGetTaskTool(workspaceId),
        }
      : {}),
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
    ...(emailClient && agentId
      ? { email_send: makeEmailSendDraftTool(workspaceId, agentId) }
      : {}),
    ...(calendarClient
      ? {
          calendar_check_availability: makeCalendarCheckAvailabilityTool(workspaceId),
          calendar_list_bookings: makeCalendarListBookingsTool(workspaceId),
          ...(calendarClient && agentId
            ? { calendar_book_meeting: makeCalendarBookMeetingDraftTool(workspaceId, agentId) }
            : {}),
        }
      : {}),
    ...(socialClient
      ? {
          social_list_scheduled: makeSocialListScheduledTool(workspaceId),
          ...(agentId
            ? {
                social_create_post: makeSocialCreatePostDraftTool(workspaceId, agentId),
                social_schedule_post: makeSocialSchedulePostDraftTool(workspaceId, agentId),
              }
            : {}),
        }
      : {}),
    ...(docsClient
      ? {
          docs_create_page: makeDocsCreatePageTool(workspaceId),
          docs_update_page: makeDocsUpdatePageTool(workspaceId),
          docs_search: makeDocsSearchTool(workspaceId),
        }
      : {}),
    ...(analyticsClient
      ? {
          analytics_get_metrics: makeAnalyticsGetMetricsTool(workspaceId),
          analytics_get_events: makeAnalyticsGetEventsTool(workspaceId),
        }
      : {}),
  }
}
