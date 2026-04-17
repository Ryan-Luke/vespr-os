// GoHighLevel CRM client.
//
// Uses LeadConnector v2 API with a Private Integration Token (PIT) for
// authentication. PITs are the v2 replacement for the legacy v1 API key
// and do not require OAuth flow.
//
// User generates a PIT at: Settings → Integrations → Private Integrations.
// They also provide the location_id from Settings → Business Profile.
//
// Docs: https://highlevel.stoplight.io/docs/integrations

import { getCredentials } from "@/lib/integrations/credentials"
import type {
  CRMClient,
  CRMContact,
  CRMContactInput,
  CRMContactUpdateInput,
  CRMDealInput,
  CRMDeal,
  CRMNote,
  CRMPipelineStage,
} from "@/lib/integrations/capabilities/crm"
import type {
  MessagingClient,
  MessagingConversation,
  MessagingMessage,
  MessagingChannel,
  SendMessageInput,
  SendMessageResult,
} from "@/lib/integrations/capabilities/messaging"

const GHL_API = "https://services.leadconnectorhq.com"

async function callGHL<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(GHL_API + path, {
    ...init,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Version": "2021-07-28",
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (payload as { message?: string; error?: string; errors?: { message?: string }[] })?.message ??
      (payload as { error?: string })?.error ??
      (payload as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
      `GHL HTTP ${res.status}`
    throw new Error(`GoHighLevel API error: ${msg}`)
  }
  return payload as T
}

async function loadGHLCreds(workspaceId: string): Promise<{ apiKey: string; locationId: string }> {
  const creds = await getCredentials(workspaceId, "gohighlevel")
  if (!creds?.api_key || !creds?.location_id) {
    throw new Error(
      "GoHighLevel is not connected for this workspace. Connect it via the integration picker first.",
    )
  }
  return { apiKey: creds.api_key, locationId: creds.location_id }
}

interface GHLContactRaw {
  id: string
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  dateAdded?: string | null
}

function toCRMContact(raw: GHLContactRaw): CRMContact {
  return {
    id: raw.id,
    email: raw.email ?? null,
    firstName: raw.firstName ?? null,
    lastName: raw.lastName ?? null,
    phone: raw.phone ?? null,
    createdAt: raw.dateAdded ?? null,
    url: `https://app.gohighlevel.com/contacts/detail/${raw.id}`,
  }
}

async function createContact(workspaceId: string, input: CRMContactInput): Promise<CRMContact> {
  const { apiKey, locationId } = await loadGHLCreds(workspaceId)
  const data = await callGHL<{ contact: GHLContactRaw }>(
    apiKey,
    "/contacts/",
    {
      method: "POST",
      body: JSON.stringify({
        locationId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        tags: input.tags,
        notes: input.notes,
      }),
    },
  )
  return toCRMContact(data.contact)
}

async function listRecentContacts(workspaceId: string, limit: number): Promise<CRMContact[]> {
  const { apiKey, locationId } = await loadGHLCreds(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 100)
  const data = await callGHL<{ contacts: GHLContactRaw[] }>(
    apiKey,
    `/contacts/?locationId=${encodeURIComponent(locationId)}&limit=${clamped}`,
  )
  return (data.contacts ?? []).map(toCRMContact)
}

async function findContactByEmail(workspaceId: string, email: string): Promise<CRMContact | null> {
  const { apiKey, locationId } = await loadGHLCreds(workspaceId)
  // GHL v2 search by email filter
  const params = new URLSearchParams({
    locationId,
    query: email,
    limit: "1",
  })
  const data = await callGHL<{ contacts: GHLContactRaw[] }>(
    apiKey,
    `/contacts/?${params.toString()}`,
  )
  const match = (data.contacts ?? []).find((c) => (c.email ?? "").toLowerCase() === email.toLowerCase())
  return match ? toCRMContact(match) : null
}

async function addTags(
  workspaceId: string,
  contactId: string,
  tags: string[],
): Promise<{ ok: true; tags: string[] }> {
  const { apiKey } = await loadGHLCreds(workspaceId)
  if (tags.length === 0) return { ok: true, tags: [] }
  await callGHL<{ tags: string[] }>(
    apiKey,
    `/contacts/${encodeURIComponent(contactId)}/tags`,
    {
      method: "POST",
      body: JSON.stringify({ tags }),
    },
  )
  return { ok: true, tags }
}

// ── Contact Updates ────��─────────────────────────────────

async function updateContact(
  workspaceId: string,
  contactId: string,
  input: CRMContactUpdateInput,
): Promise<CRMContact> {
  const { apiKey } = await loadGHLCreds(workspaceId)
  const body: Record<string, unknown> = {}
  if (input.firstName !== undefined) body.firstName = input.firstName
  if (input.lastName !== undefined) body.lastName = input.lastName
  if (input.phone !== undefined) body.phone = input.phone
  if (input.email !== undefined) body.email = input.email
  if (input.tags !== undefined) body.tags = input.tags
  if (input.customFields !== undefined) body.customField = input.customFields
  const data = await callGHL<{ contact: GHLContactRaw }>(
    apiKey,
    `/contacts/${encodeURIComponent(contactId)}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  )
  return toCRMContact(data.contact)
}

// ── Deals / Opportunities ────────���───────────────────────

interface GHLOpportunityRaw {
  id: string
  name?: string
  contactId?: string | null
  pipelineId?: string | null
  pipelineStageId?: string | null
  stageName?: string | null
  monetaryValue?: number | null
  currency?: string | null
  status?: string
  dateAdded?: string | null
}

function toCRMDeal(raw: GHLOpportunityRaw): CRMDeal {
  const value = raw.monetaryValue ?? null
  const currency = raw.currency ?? "USD"
  return {
    id: raw.id,
    title: raw.name ?? "Untitled",
    contactId: raw.contactId ?? null,
    pipelineId: raw.pipelineId ?? null,
    stageId: raw.pipelineStageId ?? null,
    stageName: raw.stageName ?? null,
    value,
    valueFormatted: value !== null ? `$${(value / 100).toFixed(2)} ${currency.toUpperCase()}` : null,
    status: raw.status ?? "open",
    createdAt: raw.dateAdded ?? null,
    url: raw.id ? `https://app.gohighlevel.com/opportunities/${raw.id}` : null,
  }
}

async function createDeal(workspaceId: string, input: CRMDealInput): Promise<CRMDeal> {
  const { apiKey, locationId } = await loadGHLCreds(workspaceId)

  // If no pipelineId, fetch default pipeline
  let pipelineId = input.pipelineId
  let stageId = input.stageId
  if (!pipelineId) {
    const pipelines = await callGHL<{ pipelines: { id: string; stages: { id: string }[] }[] }>(
      apiKey,
      `/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
    )
    const firstPipeline = pipelines.pipelines?.[0]
    if (!firstPipeline) {
      throw new Error("No pipelines found in GoHighLevel. Create a pipeline first.")
    }
    pipelineId = firstPipeline.id
    if (!stageId && firstPipeline.stages?.length > 0) {
      stageId = firstPipeline.stages[0].id
    }
  }

  const data = await callGHL<{ opportunity: GHLOpportunityRaw }>(
    apiKey,
    "/opportunities/",
    {
      method: "POST",
      body: JSON.stringify({
        locationId,
        name: input.title,
        contactId: input.contactId,
        pipelineId,
        pipelineStageId: stageId,
        monetaryValue: input.value,
        currency: input.currency ?? "USD",
        status: "open",
      }),
    },
  )
  return toCRMDeal(data.opportunity)
}

async function updateDealStage(
  workspaceId: string,
  dealId: string,
  stageId: string,
): Promise<CRMDeal> {
  const { apiKey } = await loadGHLCreds(workspaceId)
  const data = await callGHL<{ opportunity: GHLOpportunityRaw }>(
    apiKey,
    `/opportunities/${encodeURIComponent(dealId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ pipelineStageId: stageId }),
    },
  )
  return toCRMDeal(data.opportunity)
}

async function listDeals(workspaceId: string, limit: number): Promise<CRMDeal[]> {
  const { apiKey, locationId } = await loadGHLCreds(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 100)
  const data = await callGHL<{ opportunities: GHLOpportunityRaw[] }>(
    apiKey,
    `/opportunities/search?locationId=${encodeURIComponent(locationId)}&limit=${clamped}`,
  )
  return (data.opportunities ?? []).map(toCRMDeal)
}

// ── Notes ────────────────────────────────────────────────

interface GHLNoteRaw {
  id: string
  contactId?: string
  body?: string
  dateAdded?: string | null
}

async function addNote(
  workspaceId: string,
  contactId: string,
  body: string,
): Promise<CRMNote> {
  const { apiKey } = await loadGHLCreds(workspaceId)
  const data = await callGHL<{ note: GHLNoteRaw }>(
    apiKey,
    `/contacts/${encodeURIComponent(contactId)}/notes`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  )
  return {
    id: data.note.id,
    contactId,
    body: data.note.body ?? body,
    createdAt: data.note.dateAdded ?? null,
  }
}

// ── Pipeline Stages ──────────────────────────────────────

async function listPipelineStages(workspaceId: string): Promise<CRMPipelineStage[]> {
  const { apiKey, locationId } = await loadGHLCreds(workspaceId)
  const data = await callGHL<{
    pipelines: {
      id: string
      name: string
      stages: { id: string; name: string; position: number }[]
    }[]
  }>(apiKey, `/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`)

  const stages: CRMPipelineStage[] = []
  for (const pipeline of data.pipelines ?? []) {
    for (const stage of pipeline.stages ?? []) {
      stages.push({
        id: stage.id,
        name: stage.name,
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        position: stage.position,
      })
    }
  }
  return stages
}

export const gohighlevelClient: CRMClient = {
  providerKey: "gohighlevel",
  createContact,
  listRecentContacts,
  findContactByEmail,
  addTags,
  updateContact,
  createDeal,
  updateDealStage,
  listDeals,
  addNote,
  listPipelineStages,
}

// ── Messaging capability ──────────────────────────────────
// GHL Conversations API. Read-only for now. Supports SMS, email, IG DM,
// FB messenger, WhatsApp, web chat in one unified inbox.

interface GHLConversationRaw {
  id: string
  contactId?: string | null
  fullName?: string | null
  email?: string | null
  phone?: string | null
  lastMessageBody?: string | null
  lastMessageDate?: string | null
  unreadCount?: number
  type?: string // "TYPE_PHONE", "TYPE_EMAIL", "TYPE_FB_MESSENGER", "TYPE_INSTAGRAM", etc.
}

interface GHLMessageRaw {
  id: string
  direction?: "inbound" | "outbound"
  body?: string | null
  dateAdded?: string
  messageType?: string
  source?: string
}

function mapGHLChannel(type: string | undefined): MessagingChannel {
  if (!type) return "other"
  const t = type.toUpperCase()
  if (t.includes("PHONE") || t.includes("SMS")) return "sms"
  if (t.includes("EMAIL")) return "email"
  if (t.includes("INSTAGRAM")) return "ig_dm"
  if (t.includes("FB_MESSENGER") || t.includes("FACEBOOK")) return "fb_messenger"
  if (t.includes("WHATSAPP")) return "whatsapp"
  if (t.includes("WEBCHAT") || t.includes("LIVE_CHAT")) return "web_chat"
  return "other"
}

function toMessagingConversation(raw: GHLConversationRaw): MessagingConversation {
  return {
    id: raw.id,
    contactId: raw.contactId ?? null,
    contactName: raw.fullName ?? null,
    contactEmail: raw.email ?? null,
    contactPhone: raw.phone ?? null,
    lastMessagePreview: raw.lastMessageBody ?? null,
    lastMessageAt: raw.lastMessageDate ?? null,
    unread: (raw.unreadCount ?? 0) > 0,
    channel: mapGHLChannel(raw.type),
    url: `https://app.gohighlevel.com/conversations/${raw.id}`,
  }
}

function toMessagingMessage(raw: GHLMessageRaw): MessagingMessage {
  return {
    id: raw.id,
    direction: raw.direction ?? "inbound",
    body: raw.body ?? "",
    channel: mapGHLChannel(raw.messageType),
    sentAt: raw.dateAdded ?? new Date().toISOString(),
    sender: raw.source ?? null,
  }
}

async function listRecentConversations(
  workspaceId: string,
  limit: number,
): Promise<MessagingConversation[]> {
  const { apiKey, locationId } = await loadGHLCreds(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 100)
  const params = new URLSearchParams({
    locationId,
    limit: String(clamped),
  })
  const data = await callGHL<{ conversations: GHLConversationRaw[] }>(
    apiKey,
    `/conversations/search?${params.toString()}`,
  )
  return (data.conversations ?? []).map(toMessagingConversation)
}

async function listMessagesInConversation(
  workspaceId: string,
  conversationId: string,
  limit: number,
): Promise<MessagingMessage[]> {
  const { apiKey } = await loadGHLCreds(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 100)
  const data = await callGHL<{ messages: { messages: GHLMessageRaw[] } }>(
    apiKey,
    `/conversations/${encodeURIComponent(conversationId)}/messages?limit=${clamped}`,
  )
  // Response shape: { messages: { messages: [...] } }
  return (data.messages?.messages ?? []).map(toMessagingMessage)
}

function mapChannelToGHLType(channel: MessagingChannel): string {
  switch (channel) {
    case "sms": return "SMS"
    case "email": return "Email"
    case "ig_dm": return "IG"
    case "fb_messenger": return "FB"
    case "whatsapp": return "WhatsApp"
    case "web_chat": return "Live_Chat"
    default: return "SMS"
  }
}

async function sendMessage(workspaceId: string, input: SendMessageInput): Promise<SendMessageResult> {
  const { apiKey } = await loadGHLCreds(workspaceId)
  if (!input.conversationId && !input.contactId) {
    throw new Error("Either conversationId or contactId is required to send a message")
  }
  const data = await callGHL<{ messageId: string; conversationId: string; status?: string }>(
    apiKey,
    "/conversations/messages",
    {
      method: "POST",
      body: JSON.stringify({
        type: mapChannelToGHLType(input.channel),
        contactId: input.contactId,
        conversationId: input.conversationId,
        message: input.body,
        subject: input.subject,
      }),
    },
  )
  return {
    messageId: data.messageId,
    conversationId: data.conversationId,
    status: data.status ?? "sent",
  }
}

export const gohighlevelMessagingClient: MessagingClient = {
  providerKey: "gohighlevel",
  listRecentConversations,
  listMessagesInConversation,
  sendMessage,
}
