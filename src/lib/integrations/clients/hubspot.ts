// HubSpot CRM client.
//
// Uses Private App Access Token for auth. Users create a Private App in
// HubSpot (Settings -> Integrations -> Private Apps) and paste the token.
//
// Docs: https://developers.hubspot.com/docs/api/overview

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

const HUBSPOT_API = "https://api.hubapi.com"

async function callHubSpot<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(HUBSPOT_API + path, {
    ...init,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (payload as { message?: string })?.message ??
      (payload as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
      `HubSpot HTTP ${res.status}`
    throw new Error(`HubSpot API error: ${msg}`)
  }
  return payload as T
}

async function loadHubSpotToken(workspaceId: string): Promise<string> {
  const creds = await getCredentials(workspaceId, "hubspot")
  if (!creds?.api_key) {
    throw new Error(
      "HubSpot is not connected for this workspace. Connect it via the integration picker first.",
    )
  }
  return creds.api_key
}

// ── Contacts ─────────────────────────────────────────────

interface HubSpotContactRaw {
  id: string
  properties: {
    email?: string | null
    firstname?: string | null
    lastname?: string | null
    phone?: string | null
    createdate?: string | null
    hs_object_id?: string | null
  }
}

function toCRMContact(raw: HubSpotContactRaw): CRMContact {
  return {
    id: raw.id,
    email: raw.properties.email ?? null,
    firstName: raw.properties.firstname ?? null,
    lastName: raw.properties.lastname ?? null,
    phone: raw.properties.phone ?? null,
    createdAt: raw.properties.createdate ?? null,
    url: `https://app.hubspot.com/contacts/${raw.id}`,
  }
}

async function createContact(workspaceId: string, input: CRMContactInput): Promise<CRMContact> {
  const token = await loadHubSpotToken(workspaceId)
  const properties: Record<string, string> = {
    email: input.email,
  }
  if (input.firstName) properties.firstname = input.firstName
  if (input.lastName) properties.lastname = input.lastName
  if (input.phone) properties.phone = input.phone

  const data = await callHubSpot<HubSpotContactRaw>(
    token,
    "/crm/v3/objects/contacts",
    {
      method: "POST",
      body: JSON.stringify({ properties }),
    },
  )

  // HubSpot doesn't have native tags like GHL. We use contact lists or
  // lifecycle stage instead. For now, store tags as a note if provided.
  if (input.tags && input.tags.length > 0) {
    await addNote(workspaceId, data.id, `Tags: ${input.tags.join(", ")}`)
  }
  if (input.notes) {
    await addNote(workspaceId, data.id, input.notes)
  }

  return toCRMContact(data)
}

async function listRecentContacts(workspaceId: string, limit: number): Promise<CRMContact[]> {
  const token = await loadHubSpotToken(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 100)
  const data = await callHubSpot<{ results: HubSpotContactRaw[] }>(
    token,
    `/crm/v3/objects/contacts?limit=${clamped}&properties=email,firstname,lastname,phone,createdate&sorts=-createdate`,
  )
  return (data.results ?? []).map(toCRMContact)
}

async function findContactByEmail(workspaceId: string, email: string): Promise<CRMContact | null> {
  const token = await loadHubSpotToken(workspaceId)
  const data = await callHubSpot<{ results: HubSpotContactRaw[] }>(
    token,
    "/crm/v3/objects/contacts/search",
    {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: "email",
            operator: "EQ",
            value: email,
          }],
        }],
        properties: ["email", "firstname", "lastname", "phone", "createdate"],
        limit: 1,
      }),
    },
  )
  const match = data.results?.[0]
  return match ? toCRMContact(match) : null
}

async function addTags(
  workspaceId: string,
  contactId: string,
  tags: string[],
): Promise<{ ok: true; tags: string[] }> {
  // HubSpot uses contact lists, not tags. We store as a note for traceability.
  if (tags.length === 0) return { ok: true, tags: [] }
  await addNote(workspaceId, contactId, `Tags added: ${tags.join(", ")}`)
  return { ok: true, tags }
}

async function updateContact(
  workspaceId: string,
  contactId: string,
  input: CRMContactUpdateInput,
): Promise<CRMContact> {
  const token = await loadHubSpotToken(workspaceId)
  const properties: Record<string, string> = {}
  if (input.firstName !== undefined) properties.firstname = input.firstName
  if (input.lastName !== undefined) properties.lastname = input.lastName
  if (input.phone !== undefined) properties.phone = input.phone
  if (input.email !== undefined) properties.email = input.email

  const data = await callHubSpot<HubSpotContactRaw>(
    token,
    `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    },
  )

  if (input.tags && input.tags.length > 0) {
    await addNote(workspaceId, contactId, `Tags updated: ${input.tags.join(", ")}`)
  }
  if (input.notes) {
    await addNote(workspaceId, contactId, input.notes)
  }

  return toCRMContact(data)
}

// ── Deals ────────────────────────────────────────────────

interface HubSpotDealRaw {
  id: string
  properties: {
    dealname?: string | null
    amount?: string | null
    dealstage?: string | null
    pipeline?: string | null
    createdate?: string | null
    hs_object_id?: string | null
    closedate?: string | null
  }
}

function toCRMDeal(raw: HubSpotDealRaw, contactId?: string | null): CRMDeal {
  const amountStr = raw.properties.amount
  const value = amountStr ? Math.round(parseFloat(amountStr) * 100) : null
  return {
    id: raw.id,
    title: raw.properties.dealname ?? "Untitled",
    contactId: contactId ?? null,
    pipelineId: raw.properties.pipeline ?? null,
    stageId: raw.properties.dealstage ?? null,
    stageName: raw.properties.dealstage ?? null, // HubSpot uses stage ID as name in basic API
    value,
    valueFormatted: value !== null ? `$${(value / 100).toFixed(2)} USD` : null,
    status: "open", // HubSpot tracks via dealstage, not a separate status field
    createdAt: raw.properties.createdate ?? null,
    url: `https://app.hubspot.com/contacts/deals/${raw.id}`,
  }
}

async function createDeal(workspaceId: string, input: CRMDealInput): Promise<CRMDeal> {
  const token = await loadHubSpotToken(workspaceId)
  const properties: Record<string, string | number> = {
    dealname: input.title,
  }
  if (input.value !== undefined) properties.amount = (input.value / 100).toString()
  if (input.stageId) properties.dealstage = input.stageId
  if (input.pipelineId) properties.pipeline = input.pipelineId

  const data = await callHubSpot<HubSpotDealRaw>(
    token,
    "/crm/v3/objects/deals",
    {
      method: "POST",
      body: JSON.stringify({ properties }),
    },
  )

  // Associate deal with contact
  if (input.contactId) {
    await callHubSpot(
      token,
      `/crm/v3/objects/deals/${data.id}/associations/contacts/${input.contactId}/deal_to_contact`,
      { method: "PUT" },
    )
  }

  if (input.notes) {
    await callHubSpot(
      token,
      "/crm/v3/objects/notes",
      {
        method: "POST",
        body: JSON.stringify({
          properties: { hs_note_body: input.notes, hs_timestamp: new Date().toISOString() },
          associations: [
            { to: { id: data.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }] },
          ],
        }),
      },
    )
  }

  return toCRMDeal(data, input.contactId)
}

async function updateDealStage(
  workspaceId: string,
  dealId: string,
  stageId: string,
): Promise<CRMDeal> {
  const token = await loadHubSpotToken(workspaceId)
  const data = await callHubSpot<HubSpotDealRaw>(
    token,
    `/crm/v3/objects/deals/${encodeURIComponent(dealId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ properties: { dealstage: stageId } }),
    },
  )
  return toCRMDeal(data)
}

async function listDeals(workspaceId: string, limit: number): Promise<CRMDeal[]> {
  const token = await loadHubSpotToken(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 100)
  const data = await callHubSpot<{ results: HubSpotDealRaw[] }>(
    token,
    `/crm/v3/objects/deals?limit=${clamped}&properties=dealname,amount,dealstage,pipeline,createdate&sorts=-createdate`,
  )
  return (data.results ?? []).map((d) => toCRMDeal(d))
}

// ── Notes ────────────────────────────────────────────────

async function addNote(
  workspaceId: string,
  contactId: string,
  body: string,
): Promise<CRMNote> {
  const token = await loadHubSpotToken(workspaceId)
  const data = await callHubSpot<{ id: string; properties: { hs_note_body?: string; hs_timestamp?: string } }>(
    token,
    "/crm/v3/objects/notes",
    {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_note_body: body,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: contactId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
          },
        ],
      }),
    },
  )
  return {
    id: data.id,
    contactId,
    body: data.properties.hs_note_body ?? body,
    createdAt: data.properties.hs_timestamp ?? null,
  }
}

// ── Pipeline Stages ──────────────────────────────────────

async function listPipelineStages(workspaceId: string): Promise<CRMPipelineStage[]> {
  const token = await loadHubSpotToken(workspaceId)
  const data = await callHubSpot<{
    results: {
      id: string
      label: string
      stages: { id: string; label: string; displayOrder: number }[]
    }[]
  }>(token, "/crm/v3/pipelines/deals")

  const stages: CRMPipelineStage[] = []
  for (const pipeline of data.results ?? []) {
    for (const stage of pipeline.stages ?? []) {
      stages.push({
        id: stage.id,
        name: stage.label,
        pipelineId: pipeline.id,
        pipelineName: pipeline.label,
        position: stage.displayOrder,
      })
    }
  }
  return stages
}

// ── Export ────────────────────────────────────────────────

export const hubspotClient: CRMClient = {
  providerKey: "hubspot",
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
