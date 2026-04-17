# Phase 3: Integration Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the integration layer so agents can reach the outside world -- send emails, book meetings, manage CRM pipelines, post to social media, create documents, and pull analytics.

**Architecture:** Each new provider follows the existing pattern: registry entry -> client module -> capability mapping -> tool builder. OAuth support added for providers that require it. Approval gates remain for high-stakes external actions.

**Tech Stack:** Resend SDK, Stripe SDK (expanded), Cal.com API, Buffer API, Google APIs, PostHog API

**Phase Dependency:** Requires Phase 1 (auth/multi-tenancy) to be complete. Can run in parallel with Phase 2 (agent autonomy).

---

## Existing Pattern Reference

Every integration follows this 5-layer stack. New tasks MUST follow this exact pattern:

1. **Registry** (`src/lib/integrations/registry.ts`) -- declares provider metadata + credential fields
2. **Client** (`src/lib/integrations/clients/<provider>.ts`) -- raw API calls using stored credentials
3. **Capability** (`src/lib/integrations/capabilities/<category>.ts`) -- abstract interface + provider router
4. **Tools** (`src/lib/integrations/tools.ts`) -- agent-facing tool definitions using `ai` SDK `tool()` helper
5. **Executor** (`src/lib/approvals/executor.ts`) -- runs approval-gated actions on user approval

**Credential flow:** Registry fields -> UI form -> `POST /api/integrations/credentials` -> `saveCredentials()` -> `encryptJson()` -> DB. Retrieval: `getCredentials()` -> `decryptJson()` -> client uses plaintext in-memory only.

**Tool dispatch pattern:** Agent calls capability tool (e.g. `crm_create_contact`) -> tool function calls `getCRMClient(workspaceId)` -> capability layer checks which provider is connected -> dynamically imports the right client -> executes API call -> returns normalized result.

**Approval gate pattern:** Tool creates an `approvalRequests` row with `actionPayload` -> user sees it in queue -> user approves -> `PATCH /api/approval-requests` -> `executeApprovalAction()` dispatches the real API call.

---

## Task 1: Expand CRM Capabilities (GoHighLevel + HubSpot)

### 1.0 Test Setup (Vitest)

Before writing any integration tests, the project needs Vitest configured. This is a one-time setup shared by all tasks.

**Install Vitest:**

```bash
npm install -D vitest @vitest/coverage-v8
```

**Create `vitest.config.ts`** at project root:

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/integrations/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

**Add test script to `package.json`:**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 1.1 Expand CRM Interface

**File:** `src/lib/integrations/capabilities/crm.ts`

Add new types and expand the `CRMClient` interface:

```ts
// ADD these new types below the existing CRMContact interface

export interface CRMContactUpdateInput {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  tags?: string[]
  notes?: string
  customFields?: Record<string, string>
}

export interface CRMDealInput {
  title: string
  contactId: string
  pipelineId?: string   // if omitted, uses default pipeline
  stageId?: string      // if omitted, uses first stage
  value?: number        // monetary value in cents
  currency?: string     // defaults to "USD"
  notes?: string
}

export interface CRMDeal {
  id: string
  title: string
  contactId: string | null
  pipelineId: string | null
  stageId: string | null
  stageName: string | null
  value: number | null        // cents
  valueFormatted: string | null
  status: "open" | "won" | "lost" | "abandoned" | string
  createdAt: string | null
  url: string | null
}

export interface CRMNote {
  id: string
  contactId: string
  body: string
  createdAt: string | null
}

export interface CRMPipelineStage {
  id: string
  name: string
  pipelineId: string
  pipelineName: string
  position: number
}
```

**Expand the `CRMClient` interface** -- add new methods while keeping all existing ones:

```ts
export interface CRMClient {
  providerKey: string

  // Existing (keep as-is)
  createContact(workspaceId: string, input: CRMContactInput): Promise<CRMContact>
  listRecentContacts(workspaceId: string, limit: number): Promise<CRMContact[]>
  findContactByEmail(workspaceId: string, email: string): Promise<CRMContact | null>
  addTags(workspaceId: string, contactId: string, tags: string[]): Promise<{ ok: true; tags: string[] }>

  // NEW: Contact updates
  updateContact(workspaceId: string, contactId: string, input: CRMContactUpdateInput): Promise<CRMContact>

  // NEW: Deals / Opportunities
  createDeal(workspaceId: string, input: CRMDealInput): Promise<CRMDeal>
  updateDealStage(workspaceId: string, dealId: string, stageId: string): Promise<CRMDeal>
  listDeals(workspaceId: string, limit: number): Promise<CRMDeal[]>

  // NEW: Notes
  addNote(workspaceId: string, contactId: string, body: string): Promise<CRMNote>

  // NEW: Pipeline structure
  listPipelineStages(workspaceId: string): Promise<CRMPipelineStage[]>
}
```

### 1.2 Expand GoHighLevel Client

**File:** `src/lib/integrations/clients/gohighlevel.ts`

Add these functions AFTER the existing `addTags` function, BEFORE the `export const gohighlevelClient`:

```ts
// ── Contact Updates ──────────────────────────────────────

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

// ── Deals / Opportunities ────────────────────────────────

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
```

**Update the `gohighlevelClient` export** to include all new methods:

```ts
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
```

**Add the import** for the new types at the top of the file:

```ts
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
```

### 1.3 Create HubSpot Client

**File:** `src/lib/integrations/clients/hubspot.ts` (NEW)

```ts
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
    // Create an engagement note associated with the deal
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
```

### 1.4 Update CRM Capability Router

**File:** `src/lib/integrations/capabilities/crm.ts`

Update the `getCRMClient` function to enable HubSpot:

```ts
export async function getCRMClient(workspaceId: string): Promise<CRMClient | null> {
  const key = await getConnectedCRMKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "gohighlevel":
      return (await import("@/lib/integrations/clients/gohighlevel")).gohighlevelClient
    case "hubspot":
      return (await import("@/lib/integrations/clients/hubspot")).hubspotClient
    case "pipedrive":
      return null
    case "attio":
      return null
    default:
      return null
  }
}
```

### 1.5 Add New CRM Tools

**File:** `src/lib/integrations/tools.ts`

Add these tool factory functions after the existing `makeCRMAddTagTool` function:

```ts
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
          deal: {
            id: deal.id,
            title: deal.title,
            stage: deal.stageName,
            url: deal.url,
          },
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
            id: d.id,
            title: d.title,
            stage: d.stageName,
            value: d.valueFormatted,
            status: d.status,
            createdAt: d.createdAt,
            url: d.url,
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
      "Add a note to a CRM contact. Use when the user wants to log a note, memo, or observation about a contact. Notes are visible to anyone with CRM access.",
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
            id: s.id,
            name: s.name,
            pipeline: s.pipelineName,
            position: s.position,
          })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown CRM error" }
      }
    },
  })
}
```

**Update the `buildIntegrationTools` function** to include new CRM tools in the CRM block:

```ts
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
```

### 1.6 Write CRM Tests

**File:** `src/lib/integrations/clients/gohighlevel.test.ts` (NEW)

```ts
// Tests for GoHighLevel CRM client.
// Mocks fetch to verify correct API URL construction, headers, and body shape.

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock getCredentials before importing the module
vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "test-ghl-token",
    location_id: "test-location-id",
  }),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown, ok = true, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(data),
  })
}

describe("GoHighLevel CRM Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("createContact", () => {
    it("sends POST to /contacts/ with correct body", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")
      mockFetchResponse({
        contact: {
          id: "contact-123",
          email: "jane@acme.com",
          firstName: "Jane",
          lastName: "Doe",
        },
      })

      const result = await gohighlevelClient.createContact("ws-1", {
        email: "jane@acme.com",
        firstName: "Jane",
        lastName: "Doe",
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://services.leadconnectorhq.com/contacts/")
      expect(init.method).toBe("POST")
      expect(JSON.parse(init.body)).toMatchObject({
        locationId: "test-location-id",
        email: "jane@acme.com",
        firstName: "Jane",
        lastName: "Doe",
      })
      expect(result.id).toBe("contact-123")
      expect(result.email).toBe("jane@acme.com")
    })
  })

  describe("updateContact", () => {
    it("sends PUT to /contacts/:id with only changed fields", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")
      mockFetchResponse({
        contact: {
          id: "contact-123",
          email: "jane@acme.com",
          firstName: "Janet",
          lastName: "Doe",
          phone: "+15551234567",
        },
      })

      const result = await gohighlevelClient.updateContact("ws-1", "contact-123", {
        firstName: "Janet",
        phone: "+15551234567",
      })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://services.leadconnectorhq.com/contacts/contact-123")
      expect(init.method).toBe("PUT")
      const body = JSON.parse(init.body)
      expect(body.firstName).toBe("Janet")
      expect(body.phone).toBe("+15551234567")
      expect(body.email).toBeUndefined()
      expect(result.firstName).toBe("Janet")
    })
  })

  describe("createDeal", () => {
    it("fetches default pipeline when none specified, then creates opportunity", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")

      // First call: fetch pipelines
      mockFetchResponse({
        pipelines: [{
          id: "pipeline-1",
          stages: [{ id: "stage-1" }, { id: "stage-2" }],
        }],
      })
      // Second call: create opportunity
      mockFetchResponse({
        opportunity: {
          id: "opp-1",
          name: "New Deal",
          contactId: "contact-123",
          pipelineId: "pipeline-1",
          pipelineStageId: "stage-1",
          monetaryValue: 50000,
          status: "open",
        },
      })

      const result = await gohighlevelClient.createDeal("ws-1", {
        title: "New Deal",
        contactId: "contact-123",
        value: 50000,
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.id).toBe("opp-1")
      expect(result.title).toBe("New Deal")
      expect(result.pipelineId).toBe("pipeline-1")
    })
  })

  describe("updateDealStage", () => {
    it("sends PUT to /opportunities/:id with new stage", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")
      mockFetchResponse({
        opportunity: {
          id: "opp-1",
          pipelineStageId: "stage-2",
          stageName: "Qualified",
        },
      })

      const result = await gohighlevelClient.updateDealStage("ws-1", "opp-1", "stage-2")
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://services.leadconnectorhq.com/opportunities/opp-1")
      expect(init.method).toBe("PUT")
      expect(result.stageId).toBe("stage-2")
    })
  })

  describe("addNote", () => {
    it("sends POST to /contacts/:id/notes", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")
      mockFetchResponse({
        note: {
          id: "note-1",
          contactId: "contact-123",
          body: "Had a great call today",
        },
      })

      const result = await gohighlevelClient.addNote("ws-1", "contact-123", "Had a great call today")
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://services.leadconnectorhq.com/contacts/contact-123/notes")
      expect(init.method).toBe("POST")
      expect(result.body).toBe("Had a great call today")
    })
  })

  describe("listPipelineStages", () => {
    it("flattens multiple pipelines into a single list of stages", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")
      mockFetchResponse({
        pipelines: [
          {
            id: "p1",
            name: "Sales",
            stages: [
              { id: "s1", name: "Lead", position: 0 },
              { id: "s2", name: "Qualified", position: 1 },
            ],
          },
          {
            id: "p2",
            name: "Onboarding",
            stages: [
              { id: "s3", name: "Kickoff", position: 0 },
            ],
          },
        ],
      })

      const result = await gohighlevelClient.listPipelineStages("ws-1")
      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({ id: "s1", name: "Lead", pipelineName: "Sales" })
      expect(result[2]).toMatchObject({ id: "s3", name: "Kickoff", pipelineName: "Onboarding" })
    })
  })
})
```

**File:** `src/lib/integrations/clients/hubspot.test.ts` (NEW)

```ts
// Tests for HubSpot CRM client.

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "test-hubspot-token",
  }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(data),
  })
}

describe("HubSpot CRM Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("createContact", () => {
    it("sends POST with correct properties", async () => {
      const { hubspotClient } = await import("./hubspot")
      mockFetchResponse({
        id: "hs-contact-1",
        properties: {
          email: "jane@acme.com",
          firstname: "Jane",
          lastname: "Doe",
        },
      })

      const result = await hubspotClient.createContact("ws-1", {
        email: "jane@acme.com",
        firstName: "Jane",
        lastName: "Doe",
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts")
      expect(init.method).toBe("POST")
      expect(result.id).toBe("hs-contact-1")
      expect(result.email).toBe("jane@acme.com")
    })
  })

  describe("findContactByEmail", () => {
    it("uses search endpoint with EQ filter", async () => {
      const { hubspotClient } = await import("./hubspot")
      mockFetchResponse({
        results: [{
          id: "hs-contact-1",
          properties: {
            email: "jane@acme.com",
            firstname: "Jane",
            lastname: "Doe",
          },
        }],
      })

      const result = await hubspotClient.findContactByEmail("ws-1", "jane@acme.com")
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/search")
      expect(init.method).toBe("POST")
      const body = JSON.parse(init.body)
      expect(body.filterGroups[0].filters[0]).toMatchObject({
        propertyName: "email",
        operator: "EQ",
        value: "jane@acme.com",
      })
      expect(result?.id).toBe("hs-contact-1")
    })

    it("returns null when no match", async () => {
      const { hubspotClient } = await import("./hubspot")
      mockFetchResponse({ results: [] })

      const result = await hubspotClient.findContactByEmail("ws-1", "nobody@acme.com")
      expect(result).toBeNull()
    })
  })

  describe("createDeal", () => {
    it("creates deal and associates with contact", async () => {
      const { hubspotClient } = await import("./hubspot")
      // Deal creation response
      mockFetchResponse({
        id: "hs-deal-1",
        properties: {
          dealname: "Q3 Retainer",
          amount: "5000.00",
          dealstage: "qualifiedtobuy",
        },
      })
      // Association response
      mockFetchResponse({ status: "complete" })

      const result = await hubspotClient.createDeal("ws-1", {
        title: "Q3 Retainer",
        contactId: "hs-contact-1",
        value: 500000,
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.id).toBe("hs-deal-1")
      expect(result.title).toBe("Q3 Retainer")
      // Verify association call
      const [assocUrl] = mockFetch.mock.calls[1]
      expect(assocUrl).toContain("/associations/contacts/hs-contact-1")
    })
  })

  describe("listPipelineStages", () => {
    it("returns flattened stages from /crm/v3/pipelines/deals", async () => {
      const { hubspotClient } = await import("./hubspot")
      mockFetchResponse({
        results: [{
          id: "p1",
          label: "Sales Pipeline",
          stages: [
            { id: "appointmentscheduled", label: "Appointment Scheduled", displayOrder: 0 },
            { id: "qualifiedtobuy", label: "Qualified to Buy", displayOrder: 1 },
          ],
        }],
      })

      const result = await hubspotClient.listPipelineStages("ws-1")
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: "appointmentscheduled",
        name: "Appointment Scheduled",
        pipelineName: "Sales Pipeline",
      })
    })
  })
})
```

### 1.7 Commit

```bash
git add -A && git commit -m "feat(integrations): expand CRM to full CRUD — contacts, deals, notes, pipeline stages

Adds updateContact, createDeal, updateDealStage, listDeals, addNote,
listPipelineStages to both GoHighLevel and HubSpot clients. HubSpot is
a new provider client. Six new agent tools exposed. Tests for both providers."
```

---

## Task 2: Add Email Integration (Resend)

### 2.1 Install Resend SDK

```bash
npm install resend
```

### 2.2 Add Resend to Registry

**File:** `src/lib/integrations/registry.ts`

Add to `PROVIDERS` array in the Email / Marketing section:

```ts
  {
    key: "resend",
    name: "Resend",
    category: "email",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true, help: "Resend Dashboard -> API Keys -> Create API Key" },
    ],
    docsUrl: "https://resend.com/docs/api-reference/introduction",
  },
```

Add to the `aliases` map in `normalizeProviderKey`:

```ts
    resend: "resend",
```

### 2.3 Create Email Capability

**File:** `src/lib/integrations/capabilities/email.ts` (NEW)

```ts
// Email capability. Agents call `email_send` without caring whether the
// user connected Resend, SendGrid, or any other transactional email provider.
//
// IMPORTANT: All email sending is approval-gated. The tool creates an
// approval request with the full email payload. The user approves or
// rejects in the queue. On approval, the executor sends the email.
// Agents NEVER send email directly.

import { listIntegrations } from "@/lib/integrations/credentials"

export interface EmailSendInput {
  to: string           // recipient email address
  subject: string
  body: string         // plain text body
  htmlBody?: string    // optional HTML body (if omitted, plain text is used)
  replyTo?: string
  cc?: string[]
  bcc?: string[]
}

export interface EmailSendResult {
  id: string           // provider message ID
  to: string
  subject: string
  status: string       // "sent", "queued", etc.
}

export interface EmailTemplateInput {
  to: string
  templateId: string
  templateData: Record<string, string>
  subject?: string     // override template subject
  replyTo?: string
}

export interface EmailClient {
  providerKey: string

  /**
   * Send a plain/HTML email. Called ONLY by the approval executor,
   * never directly by a tool.
   */
  sendEmail(workspaceId: string, input: EmailSendInput): Promise<EmailSendResult>

  /**
   * Send a template-based email. Called ONLY by the approval executor.
   * Not all providers support templates. If unsupported, throws.
   */
  sendTemplateEmail?(workspaceId: string, input: EmailTemplateInput): Promise<EmailSendResult>
}

const EMAIL_PROVIDER_KEYS = ["resend", "sendgrid"] as const
export type EmailProviderKey = typeof EMAIL_PROVIDER_KEYS[number]

export async function getConnectedEmailKey(workspaceId: string): Promise<EmailProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of EMAIL_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

export async function getEmailClient(workspaceId: string): Promise<EmailClient | null> {
  const key = await getConnectedEmailKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "resend":
      return (await import("@/lib/integrations/clients/resend")).resendEmailClient
    case "sendgrid":
      return (await import("@/lib/integrations/clients/sendgrid")).sendgridEmailClient
    default:
      return null
  }
}
```

### 2.4 Create Resend Client

**File:** `src/lib/integrations/clients/resend.ts` (NEW)

```ts
// Resend transactional email client.
//
// Uses the official Resend SDK. Credentials stored encrypted in the
// integrations table. Plaintext only lives in memory for the API call.
//
// Docs: https://resend.com/docs/api-reference/emails/send-email

import { Resend } from "resend"
import { getCredentials } from "@/lib/integrations/credentials"
import type {
  EmailClient,
  EmailSendInput,
  EmailSendResult,
  EmailTemplateInput,
} from "@/lib/integrations/capabilities/email"

async function getResendClient(workspaceId: string): Promise<Resend> {
  const creds = await getCredentials(workspaceId, "resend")
  if (!creds?.api_key) {
    throw new Error(
      "Resend is not connected for this workspace. Connect it via the integration picker first.",
    )
  }
  return new Resend(creds.api_key)
}

/**
 * Resolve the "from" address. Resend requires a verified domain.
 * We use the workspace's domain from the API key's associated domain.
 * Falls back to "onboarding@resend.dev" for testing (Resend's sandbox).
 */
function resolveFrom(workspaceId: string): string {
  // In production, this should pull the verified sending domain from
  // workspace settings. For now, use the Resend sandbox default.
  // TODO: Add workspace.emailFromAddress field in Phase 5
  return "VESPR OS <notifications@resend.dev>"
}

async function sendEmail(
  workspaceId: string,
  input: EmailSendInput,
): Promise<EmailSendResult> {
  const resend = await getResendClient(workspaceId)

  const { data, error } = await resend.emails.send({
    from: resolveFrom(workspaceId),
    to: [input.to],
    subject: input.subject,
    text: input.body,
    html: input.htmlBody ?? undefined,
    reply_to: input.replyTo ?? undefined,
    cc: input.cc ?? undefined,
    bcc: input.bcc ?? undefined,
  })

  if (error) {
    throw new Error(`Resend API error: ${error.message}`)
  }

  return {
    id: data?.id ?? "unknown",
    to: input.to,
    subject: input.subject,
    status: "sent",
  }
}

async function sendTemplateEmail(
  workspaceId: string,
  input: EmailTemplateInput,
): Promise<EmailSendResult> {
  const resend = await getResendClient(workspaceId)

  // Resend doesn't have a native template system like SendGrid.
  // We use their batch endpoint with react-email templates, but for
  // simple cases, we just merge the data into the subject/body.
  // TODO: Support react-email template rendering when templates module exists
  throw new Error(
    "Resend template emails are not yet supported. Use email_send with a plain body instead.",
  )
}

export const resendEmailClient: EmailClient = {
  providerKey: "resend",
  sendEmail,
  sendTemplateEmail,
}
```

### 2.5 Add Email Tools (Approval-Gated)

**File:** `src/lib/integrations/tools.ts`

Add the import at the top:

```ts
import { getEmailClient } from "@/lib/integrations/capabilities/email"
```

Add these tool factories:

```ts
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
        if (!agentId) {
          return { ok: false, error: "Agent context required to draft an email." }
        }
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
```

**Update `buildIntegrationTools`** -- add email client resolution to the Promise.all and add email tools:

```ts
export async function buildIntegrationTools({ workspaceId, agentId }: BuildToolsInput) {
  const [crmClient, pmClient, paymentsClient, messagingClient, emailClient] = await Promise.all([
    getCRMClient(workspaceId),
    getPMClient(workspaceId),
    getPaymentsClient(workspaceId),
    getMessagingClient(workspaceId),
    getEmailClient(workspaceId),
  ])

  return {
    // ... existing CRM, PM, payments, messaging blocks ...

    ...(emailClient && agentId
      ? {
          email_send: makeEmailSendDraftTool(workspaceId, agentId),
        }
      : {}),
  }
}
```

### 2.6 Register Email Send in Approval Executor

**File:** `src/lib/approvals/executor.ts`

Add the email action type and executor branch:

```ts
import { getEmailClient } from "@/lib/integrations/capabilities/email"

// Add to the action types section:
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

// Update the union:
export type ApprovalAction = SendMessageAction | SendEmailAction

// Update isApprovalAction:
export function isApprovalAction(payload: unknown): payload is ApprovalAction {
  if (!payload || typeof payload !== "object") return false
  const p = payload as { type?: string }
  return p.type === "messaging_send_message" || p.type === "email_send"
}

// Add dispatch branch in executeApprovalAction, after the messaging branch:
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
```

### 2.7 Write Resend Tests

**File:** `src/lib/integrations/clients/resend.test.ts` (NEW)

```ts
// Tests for Resend email client.

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the Resend SDK
const mockSend = vi.fn()
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}))

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "re_test_123456789",
  }),
}))

describe("Resend Email Client", () => {
  beforeEach(() => {
    mockSend.mockReset()
  })

  describe("sendEmail", () => {
    it("calls Resend SDK with correct params", async () => {
      const { resendEmailClient } = await import("./resend")
      mockSend.mockResolvedValueOnce({
        data: { id: "email-msg-123" },
        error: null,
      })

      const result = await resendEmailClient.sendEmail("ws-1", {
        to: "customer@acme.com",
        subject: "Your invoice is ready",
        body: "Hi, your invoice for $500 is attached.",
      })

      expect(mockSend).toHaveBeenCalledTimes(1)
      const sendArgs = mockSend.mock.calls[0][0]
      expect(sendArgs.to).toEqual(["customer@acme.com"])
      expect(sendArgs.subject).toBe("Your invoice is ready")
      expect(sendArgs.text).toBe("Hi, your invoice for $500 is attached.")
      expect(result.id).toBe("email-msg-123")
      expect(result.status).toBe("sent")
    })

    it("throws on Resend API error", async () => {
      const { resendEmailClient } = await import("./resend")
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Invalid API key" },
      })

      await expect(
        resendEmailClient.sendEmail("ws-1", {
          to: "test@test.com",
          subject: "Test",
          body: "Test body",
        }),
      ).rejects.toThrow("Resend API error: Invalid API key")
    })

    it("passes optional fields (cc, bcc, replyTo, htmlBody)", async () => {
      const { resendEmailClient } = await import("./resend")
      mockSend.mockResolvedValueOnce({
        data: { id: "email-msg-456" },
        error: null,
      })

      await resendEmailClient.sendEmail("ws-1", {
        to: "customer@acme.com",
        subject: "Update",
        body: "Plain text version",
        htmlBody: "<h1>HTML version</h1>",
        replyTo: "boss@acme.com",
        cc: ["cc1@acme.com"],
        bcc: ["bcc1@acme.com"],
      })

      const sendArgs = mockSend.mock.calls[0][0]
      expect(sendArgs.html).toBe("<h1>HTML version</h1>")
      expect(sendArgs.reply_to).toBe("boss@acme.com")
      expect(sendArgs.cc).toEqual(["cc1@acme.com"])
      expect(sendArgs.bcc).toEqual(["bcc1@acme.com"])
    })
  })
})
```

### 2.8 Commit

```bash
git add -A && git commit -m "feat(integrations): add Resend email integration with approval-gated sending

New email capability layer, Resend client using official SDK, email_send
tool that drafts to approval queue, executor branch for email_send action.
Email never sends without explicit user approval."
```

---

## Task 3: Add Email Integration (SendGrid as Alternative)

### 3.1 Add SendGrid to Registry

**File:** `src/lib/integrations/registry.ts`

Add to `PROVIDERS` array in the Email / Marketing section:

```ts
  {
    key: "sendgrid",
    name: "SendGrid",
    category: "email",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true, help: "Settings -> API Keys -> Create API Key (full access or mail send)" },
      { key: "from_email", label: "Verified Sender Email", type: "text", required: true, placeholder: "you@yourdomain.com", help: "Must be a verified sender in SendGrid" },
    ],
    docsUrl: "https://docs.sendgrid.com/api-reference/mail-send/mail-send",
  },
```

Add to `aliases` map:

```ts
    sendgrid: "sendgrid",
```

### 3.2 Create SendGrid Client

**File:** `src/lib/integrations/clients/sendgrid.ts` (NEW)

```ts
// SendGrid transactional email client.
//
// Uses the v3 Mail Send API directly via fetch (no SDK dependency).
// Credentials stored encrypted in the integrations table.
//
// Docs: https://docs.sendgrid.com/api-reference/mail-send/mail-send

import { getCredentials } from "@/lib/integrations/credentials"
import type {
  EmailClient,
  EmailSendInput,
  EmailSendResult,
  EmailTemplateInput,
} from "@/lib/integrations/capabilities/email"

const SENDGRID_API = "https://api.sendgrid.com/v3"

interface SendGridCreds {
  apiKey: string
  fromEmail: string
}

async function loadSendGridCreds(workspaceId: string): Promise<SendGridCreds> {
  const creds = await getCredentials(workspaceId, "sendgrid")
  if (!creds?.api_key || !creds?.from_email) {
    throw new Error(
      "SendGrid is not connected for this workspace. Connect it via the integration picker first.",
    )
  }
  return { apiKey: creds.api_key, fromEmail: creds.from_email }
}

async function callSendGrid<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(SENDGRID_API + path, {
    ...init,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers ?? {}),
    },
  })

  // SendGrid returns 202 Accepted for successful sends (no body)
  if (res.status === 202 || res.status === 204) {
    return {} as T
  }

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errors = (payload as { errors?: { message?: string }[] })?.errors
    const msg = errors?.[0]?.message ?? `SendGrid HTTP ${res.status}`
    throw new Error(`SendGrid API error: ${msg}`)
  }
  return payload as T
}

async function sendEmail(
  workspaceId: string,
  input: EmailSendInput,
): Promise<EmailSendResult> {
  const { apiKey, fromEmail } = await loadSendGridCreds(workspaceId)

  const personalizations: Record<string, unknown>[] = [{
    to: [{ email: input.to }],
    ...(input.cc && input.cc.length > 0
      ? { cc: input.cc.map((e) => ({ email: e })) }
      : {}),
    ...(input.bcc && input.bcc.length > 0
      ? { bcc: input.bcc.map((e) => ({ email: e })) }
      : {}),
  }]

  const content: { type: string; value: string }[] = [
    { type: "text/plain", value: input.body },
  ]
  if (input.htmlBody) {
    content.push({ type: "text/html", value: input.htmlBody })
  }

  await callSendGrid(
    apiKey,
    "/mail/send",
    {
      method: "POST",
      body: JSON.stringify({
        personalizations,
        from: { email: fromEmail },
        reply_to: input.replyTo ? { email: input.replyTo } : undefined,
        subject: input.subject,
        content,
      }),
    },
  )

  // SendGrid 202 doesn't return a message ID. We generate a reference.
  return {
    id: `sg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    to: input.to,
    subject: input.subject,
    status: "queued",
  }
}

async function sendTemplateEmail(
  workspaceId: string,
  input: EmailTemplateInput,
): Promise<EmailSendResult> {
  const { apiKey, fromEmail } = await loadSendGridCreds(workspaceId)

  await callSendGrid(
    apiKey,
    "/mail/send",
    {
      method: "POST",
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: input.to }],
          dynamic_template_data: input.templateData,
        }],
        from: { email: fromEmail },
        reply_to: input.replyTo ? { email: input.replyTo } : undefined,
        template_id: input.templateId,
        ...(input.subject ? { subject: input.subject } : {}),
      }),
    },
  )

  return {
    id: `sg-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    to: input.to,
    subject: input.subject ?? "(template subject)",
    status: "queued",
  }
}

export const sendgridEmailClient: EmailClient = {
  providerKey: "sendgrid",
  sendEmail,
  sendTemplateEmail,
}
```

### 3.3 Write SendGrid Tests

**File:** `src/lib/integrations/clients/sendgrid.test.ts` (NEW)

```ts
// Tests for SendGrid email client.

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "SG.test-key-12345",
    from_email: "notifications@myapp.com",
  }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe("SendGrid Email Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("sendEmail", () => {
    it("sends POST to /mail/send with correct payload structure", async () => {
      const { sendgridEmailClient } = await import("./sendgrid")
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: () => Promise.resolve({}),
      })

      const result = await sendgridEmailClient.sendEmail("ws-1", {
        to: "customer@acme.com",
        subject: "Invoice Ready",
        body: "Your invoice is ready.",
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://api.sendgrid.com/v3/mail/send")
      expect(init.method).toBe("POST")

      const body = JSON.parse(init.body)
      expect(body.personalizations[0].to).toEqual([{ email: "customer@acme.com" }])
      expect(body.from).toEqual({ email: "notifications@myapp.com" })
      expect(body.subject).toBe("Invoice Ready")
      expect(body.content[0]).toEqual({ type: "text/plain", value: "Your invoice is ready." })

      expect(result.to).toBe("customer@acme.com")
      expect(result.status).toBe("queued")
    })

    it("includes HTML content when provided", async () => {
      const { sendgridEmailClient } = await import("./sendgrid")
      mockFetch.mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({}) })

      await sendgridEmailClient.sendEmail("ws-1", {
        to: "test@test.com",
        subject: "Test",
        body: "Plain text",
        htmlBody: "<h1>HTML</h1>",
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.content).toHaveLength(2)
      expect(body.content[1]).toEqual({ type: "text/html", value: "<h1>HTML</h1>" })
    })

    it("includes cc and bcc when provided", async () => {
      const { sendgridEmailClient } = await import("./sendgrid")
      mockFetch.mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({}) })

      await sendgridEmailClient.sendEmail("ws-1", {
        to: "main@acme.com",
        subject: "Test",
        body: "Body",
        cc: ["cc1@acme.com", "cc2@acme.com"],
        bcc: ["bcc1@acme.com"],
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.personalizations[0].cc).toEqual([{ email: "cc1@acme.com" }, { email: "cc2@acme.com" }])
      expect(body.personalizations[0].bcc).toEqual([{ email: "bcc1@acme.com" }])
    })

    it("throws on SendGrid API error", async () => {
      const { sendgridEmailClient } = await import("./sendgrid")
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ errors: [{ message: "Forbidden" }] }),
      })

      await expect(
        sendgridEmailClient.sendEmail("ws-1", {
          to: "test@test.com",
          subject: "Test",
          body: "Body",
        }),
      ).rejects.toThrow("SendGrid API error: Forbidden")
    })
  })

  describe("sendTemplateEmail", () => {
    it("sends template_id and dynamic_template_data", async () => {
      const { sendgridEmailClient } = await import("./sendgrid")
      mockFetch.mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({}) })

      const result = await sendgridEmailClient.sendTemplateEmail!("ws-1", {
        to: "customer@acme.com",
        templateId: "d-abc123",
        templateData: { name: "Jane", amount: "$500" },
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.template_id).toBe("d-abc123")
      expect(body.personalizations[0].dynamic_template_data).toEqual({
        name: "Jane",
        amount: "$500",
      })
      expect(result.status).toBe("queued")
    })
  })
})
```

### 3.4 Commit

```bash
git add -A && git commit -m "feat(integrations): add SendGrid as alternative email provider

SendGrid client using v3 Mail Send API, template support via
dynamic_template_data, same EmailClient interface as Resend.
Users pick whichever email provider they prefer."
```

---

## Task 4: Add Calendar Integration (Cal.com)

### 4.1 Add Cal.com to Registry

**File:** `src/lib/integrations/registry.ts`

Add a new category value first. Update the `IntegrationProvider` category type:

```ts
  category: "crm" | "email" | "payments" | "marketing" | "delivery" | "dashboards" | "content" | "calendar"
```

Add to `PROVIDERS` array (new section):

```ts
  // ── Calendar ─────────────────────────────────────────────
  {
    key: "calcom",
    name: "Cal.com",
    category: "calendar",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true, help: "Settings -> Developer -> API Keys -> Create" },
    ],
    docsUrl: "https://cal.com/docs/enterprise-features/api",
  },
```

Add to `aliases`:

```ts
    calcom: "calcom",
    cal: "calcom",
```

### 4.2 Create Calendar Capability

**File:** `src/lib/integrations/capabilities/calendar.ts` (NEW)

```ts
// Calendar capability. Agents can check availability and draft booking
// requests for approval. Booking meetings is approval-gated because
// it creates real calendar events and sends invites to external people.

import { listIntegrations } from "@/lib/integrations/credentials"

export interface CalendarAvailabilitySlot {
  start: string   // ISO datetime
  end: string     // ISO datetime
}

export interface CalendarAvailabilityInput {
  dateFrom: string   // ISO date (YYYY-MM-DD)
  dateTo: string     // ISO date (YYYY-MM-DD)
  eventTypeId?: number
}

export interface CalendarBookingInput {
  eventTypeId: number
  start: string           // ISO datetime
  name: string            // attendee name
  email: string           // attendee email
  notes?: string          // booking notes
  timeZone?: string       // defaults to UTC
  metadata?: Record<string, string>
}

export interface CalendarBooking {
  id: number
  uid: string
  title: string
  startTime: string    // ISO
  endTime: string      // ISO
  attendeeEmail: string
  status: string       // "ACCEPTED", "PENDING", "CANCELLED"
  meetingUrl: string | null
}

export interface CalendarClient {
  providerKey: string

  /**
   * Get available time slots for a date range. Read-only, no approval needed.
   */
  getAvailability(workspaceId: string, input: CalendarAvailabilityInput): Promise<CalendarAvailabilitySlot[]>

  /**
   * Create a booking. Called ONLY by the approval executor.
   */
  createBooking(workspaceId: string, input: CalendarBookingInput): Promise<CalendarBooking>

  /**
   * List upcoming bookings. Read-only.
   */
  listBookings(workspaceId: string, limit: number): Promise<CalendarBooking[]>

  /**
   * Cancel a booking by UID. Called ONLY by the approval executor.
   */
  cancelBooking(workspaceId: string, uid: string, reason?: string): Promise<{ ok: true }>
}

const CALENDAR_PROVIDER_KEYS = ["calcom"] as const
export type CalendarProviderKey = typeof CALENDAR_PROVIDER_KEYS[number]

export async function getConnectedCalendarKey(workspaceId: string): Promise<CalendarProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of CALENDAR_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

export async function getCalendarClient(workspaceId: string): Promise<CalendarClient | null> {
  const key = await getConnectedCalendarKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "calcom":
      return (await import("@/lib/integrations/clients/calcom")).calcomClient
    default:
      return null
  }
}
```

### 4.3 Create Cal.com Client

**File:** `src/lib/integrations/clients/calcom.ts` (NEW)

```ts
// Cal.com calendar client.
//
// Uses the Cal.com v2 API with API key auth.
//
// Docs: https://cal.com/docs/enterprise-features/api

import { getCredentials } from "@/lib/integrations/credentials"
import type {
  CalendarClient,
  CalendarAvailabilityInput,
  CalendarAvailabilitySlot,
  CalendarBookingInput,
  CalendarBooking,
} from "@/lib/integrations/capabilities/calendar"

const CALCOM_API = "https://api.cal.com/v2"

async function callCalCom<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = new URL(CALCOM_API + path)
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "cal-api-version": "2024-08-13",
      ...(init.headers ?? {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (payload as { message?: string })?.message ??
      (payload as { error?: string })?.error ??
      `Cal.com HTTP ${res.status}`
    throw new Error(`Cal.com API error: ${msg}`)
  }
  return payload as T
}

async function loadCalComKey(workspaceId: string): Promise<string> {
  const creds = await getCredentials(workspaceId, "calcom")
  if (!creds?.api_key) {
    throw new Error(
      "Cal.com is not connected for this workspace. Connect it via the integration picker first.",
    )
  }
  return creds.api_key
}

// ── Availability ─────────────────────────────────────────

async function getAvailability(
  workspaceId: string,
  input: CalendarAvailabilityInput,
): Promise<CalendarAvailabilitySlot[]> {
  const apiKey = await loadCalComKey(workspaceId)
  const params = new URLSearchParams({
    startTime: input.dateFrom,
    endTime: input.dateTo,
  })
  if (input.eventTypeId) {
    params.set("eventTypeId", String(input.eventTypeId))
  }

  const data = await callCalCom<{
    status: string
    data: {
      slots: Record<string, { time: string }[]>
    }
  }>(apiKey, `/slots?${params.toString()}`)

  const slots: CalendarAvailabilitySlot[] = []
  for (const [, daySlots] of Object.entries(data.data?.slots ?? {})) {
    for (const slot of daySlots) {
      slots.push({
        start: slot.time,
        end: slot.time, // Cal.com slots are start times; duration comes from event type
      })
    }
  }
  return slots
}

// ── Bookings ─────────────────────────────────────────────

interface CalComBookingRaw {
  id: number
  uid: string
  title?: string
  startTime?: string
  endTime?: string
  attendees?: { email: string; name?: string }[]
  status?: string
  metadata?: { videoCallUrl?: string }
}

function toCalendarBooking(raw: CalComBookingRaw): CalendarBooking {
  return {
    id: raw.id,
    uid: raw.uid,
    title: raw.title ?? "Booking",
    startTime: raw.startTime ?? "",
    endTime: raw.endTime ?? "",
    attendeeEmail: raw.attendees?.[0]?.email ?? "",
    status: raw.status ?? "PENDING",
    meetingUrl: raw.metadata?.videoCallUrl ?? null,
  }
}

async function createBooking(
  workspaceId: string,
  input: CalendarBookingInput,
): Promise<CalendarBooking> {
  const apiKey = await loadCalComKey(workspaceId)

  const data = await callCalCom<{ status: string; data: CalComBookingRaw }>(
    apiKey,
    "/bookings",
    {
      method: "POST",
      body: JSON.stringify({
        eventTypeId: input.eventTypeId,
        start: input.start,
        attendee: {
          name: input.name,
          email: input.email,
          timeZone: input.timeZone ?? "UTC",
        },
        notes: input.notes,
        metadata: input.metadata,
      }),
    },
  )

  return toCalendarBooking(data.data)
}

async function listBookings(workspaceId: string, limit: number): Promise<CalendarBooking[]> {
  const apiKey = await loadCalComKey(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 100)
  const data = await callCalCom<{ status: string; data: CalComBookingRaw[] }>(
    apiKey,
    `/bookings?limit=${clamped}&status=upcoming`,
  )
  return (data.data ?? []).map(toCalendarBooking)
}

async function cancelBooking(
  workspaceId: string,
  uid: string,
  reason?: string,
): Promise<{ ok: true }> {
  const apiKey = await loadCalComKey(workspaceId)
  await callCalCom(
    apiKey,
    `/bookings/${encodeURIComponent(uid)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        cancellationReason: reason ?? "Cancelled by agent",
      }),
    },
  )
  return { ok: true }
}

export const calcomClient: CalendarClient = {
  providerKey: "calcom",
  getAvailability,
  createBooking,
  listBookings,
  cancelBooking,
}
```

### 4.4 Add Calendar Tools

**File:** `src/lib/integrations/tools.ts`

Add the import:

```ts
import { getCalendarClient } from "@/lib/integrations/capabilities/calendar"
```

Add these tool factories:

```ts
// ── Calendar tools ───────────────────────────────────────

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
            id: b.id,
            uid: b.uid,
            title: b.title,
            start: b.startTime,
            end: b.endTime,
            attendee: b.attendeeEmail,
            status: b.status,
            meetingUrl: b.meetingUrl,
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
        if (!agentId) {
          return { ok: false, error: "Agent context required to draft a booking." }
        }
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
          ok: true,
          drafted: true,
          approvalRequestId: request.id,
          message: `Meeting with ${input.name} drafted and submitted for approval.`,
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to draft booking" }
      }
    },
  })
}
```

**Update `buildIntegrationTools`** -- add calendar client to Promise.all and tool block:

```ts
  const [crmClient, pmClient, paymentsClient, messagingClient, emailClient, calendarClient] = await Promise.all([
    getCRMClient(workspaceId),
    getPMClient(workspaceId),
    getPaymentsClient(workspaceId),
    getMessagingClient(workspaceId),
    getEmailClient(workspaceId),
    getCalendarClient(workspaceId),
  ])

  return {
    // ... existing blocks ...

    ...(calendarClient
      ? {
          calendar_check_availability: makeCalendarCheckAvailabilityTool(workspaceId),
          calendar_list_bookings: makeCalendarListBookingsTool(workspaceId),
          ...(calendarClient && agentId
            ? { calendar_book_meeting: makeCalendarBookMeetingDraftTool(workspaceId, agentId) }
            : {}),
        }
      : {}),
  }
```

### 4.5 Register Calendar Booking in Approval Executor

**File:** `src/lib/approvals/executor.ts`

Add the import:

```ts
import { getCalendarClient } from "@/lib/integrations/capabilities/calendar"
```

Add the action type:

```ts
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

// Update union:
export type ApprovalAction = SendMessageAction | SendEmailAction | BookMeetingAction

// Update isApprovalAction:
export function isApprovalAction(payload: unknown): payload is ApprovalAction {
  if (!payload || typeof payload !== "object") return false
  const p = payload as { type?: string }
  return (
    p.type === "messaging_send_message" ||
    p.type === "email_send" ||
    p.type === "calendar_book_meeting"
  )
}

// Add dispatch branch:
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
```

### 4.6 Write Cal.com Tests

**File:** `src/lib/integrations/clients/calcom.test.ts` (NEW)

```ts
// Tests for Cal.com calendar client.

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "cal_test_key_123",
  }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(data),
  })
}

describe("Cal.com Calendar Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("getAvailability", () => {
    it("fetches slots for date range", async () => {
      const { calcomClient } = await import("./calcom")
      mockFetchResponse({
        status: "success",
        data: {
          slots: {
            "2026-04-12": [
              { time: "2026-04-12T09:00:00Z" },
              { time: "2026-04-12T10:00:00Z" },
            ],
            "2026-04-13": [
              { time: "2026-04-13T14:00:00Z" },
            ],
          },
        },
      })

      const result = await calcomClient.getAvailability("ws-1", {
        dateFrom: "2026-04-12",
        dateTo: "2026-04-14",
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain("/slots")
      expect(url).toContain("startTime=2026-04-12")
      expect(result).toHaveLength(3)
      expect(result[0].start).toBe("2026-04-12T09:00:00Z")
    })
  })

  describe("createBooking", () => {
    it("sends POST to /bookings with attendee info", async () => {
      const { calcomClient } = await import("./calcom")
      mockFetchResponse({
        status: "success",
        data: {
          id: 42,
          uid: "booking-uid-123",
          title: "30min Meeting",
          startTime: "2026-04-12T09:00:00Z",
          endTime: "2026-04-12T09:30:00Z",
          attendees: [{ email: "prospect@acme.com", name: "Alice" }],
          status: "ACCEPTED",
          metadata: { videoCallUrl: "https://meet.cal.com/abc" },
        },
      })

      const result = await calcomClient.createBooking("ws-1", {
        eventTypeId: 1,
        start: "2026-04-12T09:00:00Z",
        name: "Alice",
        email: "prospect@acme.com",
        timeZone: "America/New_York",
      })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toContain("/bookings")
      expect(init.method).toBe("POST")
      const body = JSON.parse(init.body)
      expect(body.eventTypeId).toBe(1)
      expect(body.attendee.email).toBe("prospect@acme.com")
      expect(result.uid).toBe("booking-uid-123")
      expect(result.meetingUrl).toBe("https://meet.cal.com/abc")
    })
  })

  describe("listBookings", () => {
    it("returns upcoming bookings", async () => {
      const { calcomClient } = await import("./calcom")
      mockFetchResponse({
        status: "success",
        data: [
          {
            id: 1,
            uid: "uid-1",
            title: "Discovery Call",
            startTime: "2026-04-15T10:00:00Z",
            endTime: "2026-04-15T10:30:00Z",
            attendees: [{ email: "lead@acme.com" }],
            status: "ACCEPTED",
          },
        ],
      })

      const result = await calcomClient.listBookings("ws-1", 10)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe("Discovery Call")
    })
  })

  describe("cancelBooking", () => {
    it("sends POST to /bookings/:uid/cancel", async () => {
      const { calcomClient } = await import("./calcom")
      mockFetchResponse({ status: "success" })

      const result = await calcomClient.cancelBooking("ws-1", "uid-1", "Client rescheduled")
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toContain("/bookings/uid-1/cancel")
      expect(init.method).toBe("POST")
      expect(result.ok).toBe(true)
    })
  })
})
```

### 4.7 Commit

```bash
git add -A && git commit -m "feat(integrations): add Cal.com calendar integration with approval-gated booking

New calendar capability layer, Cal.com client (availability, bookings,
cancellation), three agent tools (check availability is read-only,
booking is approval-gated). Executor branch for calendar_book_meeting."
```

---

## Task 5: Expand PM Capabilities (Linear + Asana)

### 5.1 Expand PM Interface

**File:** `src/lib/integrations/capabilities/pm.ts`

Add new types and expand the interface:

```ts
export interface PMTaskUpdateInput {
  title?: string
  description?: string
  priority?: 0 | 1 | 2 | 3 | 4
  stateId?: string       // status/state ID (e.g., Linear state UUID, Asana section GID)
  assigneeId?: string
}

export interface PMComment {
  id: string
  body: string
  authorName: string | null
  createdAt: string | null
}

export interface PMTaskDetail extends PMTask {
  description: string | null
  status: string | null
  priority: number | null
  assigneeName: string | null
  createdAt: string | null
  updatedAt: string | null
  comments: PMComment[]
}

export interface PMClient {
  providerKey: string

  // Existing
  createTask(workspaceId: string, input: PMTaskInput): Promise<PMTask>

  // NEW
  updateTask(workspaceId: string, taskId: string, input: PMTaskUpdateInput): Promise<PMTask>
  addComment(workspaceId: string, taskId: string, body: string): Promise<PMComment>
  listTasks(workspaceId: string, limit: number): Promise<PMTask[]>
  getTask(workspaceId: string, taskId: string): Promise<PMTaskDetail>
}
```

### 5.2 Expand Linear Client

**File:** `src/lib/integrations/clients/linear.ts`

Add the new imports at the top:

```ts
import type { PMClient, PMTask, PMTaskInput, PMTaskUpdateInput, PMComment, PMTaskDetail } from "@/lib/integrations/capabilities/pm"
```

Add these functions before the `linearPMClient` export:

```ts
async function pmUpdateTask(workspaceId: string, taskId: string, input: PMTaskUpdateInput): Promise<PMTask> {
  const creds = await getCredentials(workspaceId, "linear")
  if (!creds?.api_key) throw new Error("Linear is not connected for this workspace.")
  const apiKey = creds.api_key

  const issueInput: Record<string, unknown> = {}
  if (input.title !== undefined) issueInput.title = input.title
  if (input.description !== undefined) issueInput.description = input.description
  if (input.priority !== undefined) issueInput.priority = input.priority
  if (input.stateId !== undefined) issueInput.stateId = input.stateId
  if (input.assigneeId !== undefined) issueInput.assigneeId = input.assigneeId

  const data = await callLinear<{
    issueUpdate: {
      success: boolean
      issue: { id: string; identifier: string; title: string; url: string } | null
    }
  }>(
    apiKey,
    `mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue { id identifier title url }
      }
    }`,
    { id: taskId, input: issueInput },
  )

  if (!data.issueUpdate.success || !data.issueUpdate.issue) {
    throw new Error("Linear rejected the issue update")
  }
  return data.issueUpdate.issue
}

async function pmAddComment(workspaceId: string, taskId: string, body: string): Promise<PMComment> {
  const creds = await getCredentials(workspaceId, "linear")
  if (!creds?.api_key) throw new Error("Linear is not connected for this workspace.")
  const apiKey = creds.api_key

  const data = await callLinear<{
    commentCreate: {
      success: boolean
      comment: { id: string; body: string; user: { name: string } | null; createdAt: string } | null
    }
  }>(
    apiKey,
    `mutation($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment { id body user { name } createdAt }
      }
    }`,
    { input: { issueId: taskId, body } },
  )

  if (!data.commentCreate.success || !data.commentCreate.comment) {
    throw new Error("Linear rejected the comment create")
  }
  const c = data.commentCreate.comment
  return {
    id: c.id,
    body: c.body,
    authorName: c.user?.name ?? null,
    createdAt: c.createdAt,
  }
}

async function pmListTasks(workspaceId: string, limit: number): Promise<PMTask[]> {
  const creds = await getCredentials(workspaceId, "linear")
  if (!creds?.api_key) throw new Error("Linear is not connected for this workspace.")
  const apiKey = creds.api_key
  const clamped = Math.min(Math.max(limit, 1), 50)

  const data = await callLinear<{
    issues: {
      nodes: { id: string; identifier: string; title: string; url: string }[]
    }
  }>(
    apiKey,
    `query($first: Int!) {
      issues(first: $first, orderBy: createdAt) {
        nodes { id identifier title url }
      }
    }`,
    { first: clamped },
  )

  return data.issues.nodes.map((i) => ({
    id: i.id,
    identifier: i.identifier,
    title: i.title,
    url: i.url,
  }))
}

async function pmGetTask(workspaceId: string, taskId: string): Promise<PMTaskDetail> {
  const creds = await getCredentials(workspaceId, "linear")
  if (!creds?.api_key) throw new Error("Linear is not connected for this workspace.")
  const apiKey = creds.api_key

  const data = await callLinear<{
    issue: {
      id: string
      identifier: string
      title: string
      description: string | null
      url: string
      priority: number | null
      state: { name: string } | null
      assignee: { name: string } | null
      createdAt: string
      updatedAt: string
      comments: {
        nodes: { id: string; body: string; user: { name: string } | null; createdAt: string }[]
      }
    }
  }>(
    apiKey,
    `query($id: String!) {
      issue(id: $id) {
        id identifier title description url priority
        state { name }
        assignee { name }
        createdAt updatedAt
        comments(first: 20) {
          nodes { id body user { name } createdAt }
        }
      }
    }`,
    { id: taskId },
  )

  const i = data.issue
  return {
    id: i.id,
    identifier: i.identifier,
    title: i.title,
    url: i.url,
    description: i.description,
    status: i.state?.name ?? null,
    priority: i.priority,
    assigneeName: i.assignee?.name ?? null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    comments: i.comments.nodes.map((c) => ({
      id: c.id,
      body: c.body,
      authorName: c.user?.name ?? null,
      createdAt: c.createdAt,
    })),
  }
}
```

**Update the `linearPMClient` export:**

```ts
export const linearPMClient: PMClient = {
  providerKey: "linear",
  createTask: pmCreateTask,
  updateTask: pmUpdateTask,
  addComment: pmAddComment,
  listTasks: pmListTasks,
  getTask: pmGetTask,
}
```

### 5.3 Create Asana Client

**File:** `src/lib/integrations/clients/asana.ts` (NEW)

First, add Asana to the registry. **File:** `src/lib/integrations/registry.ts`

Add to `PROVIDERS` array in the Delivery / Project Mgmt section:

```ts
  {
    key: "asana",
    name: "Asana",
    category: "delivery",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "Personal Access Token", type: "password", required: true, help: "My Settings -> Apps -> Personal access tokens -> Create new token" },
      { key: "workspace_gid", label: "Workspace GID", type: "text", required: true, help: "From URL: app.asana.com/0/{workspace_gid}/..." },
    ],
    docsUrl: "https://developers.asana.com/reference/rest-api-reference",
  },
```

Add to `aliases`:

```ts
    asana: "asana",
```

**File:** `src/lib/integrations/clients/asana.ts` (NEW)

```ts
// Asana project management client.
//
// Uses Personal Access Token (PAT) auth with the REST API.
//
// Docs: https://developers.asana.com/reference/rest-api-reference

import { getCredentials } from "@/lib/integrations/credentials"
import type {
  PMClient,
  PMTask,
  PMTaskInput,
  PMTaskUpdateInput,
  PMComment,
  PMTaskDetail,
} from "@/lib/integrations/capabilities/pm"

const ASANA_API = "https://app.asana.com/api/1.0"

interface AsanaCreds {
  apiKey: string
  workspaceGid: string
}

async function loadAsanaCreds(workspaceId: string): Promise<AsanaCreds> {
  const creds = await getCredentials(workspaceId, "asana")
  if (!creds?.api_key || !creds?.workspace_gid) {
    throw new Error("Asana is not connected for this workspace. Connect it via the integration picker first.")
  }
  return { apiKey: creds.api_key, workspaceGid: creds.workspace_gid }
}

async function callAsana<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(ASANA_API + path, {
    ...init,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errors = (payload as { errors?: { message?: string }[] })?.errors
    const msg = errors?.[0]?.message ?? `Asana HTTP ${res.status}`
    throw new Error(`Asana API error: ${msg}`)
  }
  return (payload as { data: T }).data
}

// ── Priority mapping ─────────────────────────────────────
// Asana doesn't have numeric priority. We map to custom field or ignore.
// For simplicity, we store priority in notes or use Asana's custom fields
// if configured. This keeps the interface consistent.

interface AsanaTaskRaw {
  gid: string
  name: string
  notes?: string | null
  permalink_url?: string | null
  assignee?: { name?: string } | null
  assignee_status?: string | null
  completed?: boolean
  created_at?: string | null
  modified_at?: string | null
  memberships?: { section?: { name?: string } }[]
}

function toTask(raw: AsanaTaskRaw): PMTask {
  return {
    id: raw.gid,
    identifier: raw.gid,
    title: raw.name,
    url: raw.permalink_url ?? `https://app.asana.com/0/0/${raw.gid}`,
  }
}

async function createTask(workspaceId: string, input: PMTaskInput): Promise<PMTask> {
  const { apiKey, workspaceGid } = await loadAsanaCreds(workspaceId)

  // Find the first project in the workspace to attach the task
  const projects = await callAsana<{ gid: string }[]>(
    apiKey,
    `/workspaces/${encodeURIComponent(workspaceGid)}/projects?limit=1&opt_fields=gid`,
  )
  const projectGid = projects[0]?.gid

  const body: Record<string, unknown> = {
    name: input.title,
    notes: input.description ?? "",
    workspace: workspaceGid,
  }
  if (projectGid) {
    body.projects = [projectGid]
  }

  const data = await callAsana<AsanaTaskRaw>(
    apiKey,
    "/tasks",
    {
      method: "POST",
      body: JSON.stringify({ data: body }),
    },
  )
  return toTask(data)
}

async function updateTask(workspaceId: string, taskId: string, input: PMTaskUpdateInput): Promise<PMTask> {
  const { apiKey } = await loadAsanaCreds(workspaceId)

  const body: Record<string, unknown> = {}
  if (input.title !== undefined) body.name = input.title
  if (input.description !== undefined) body.notes = input.description
  if (input.assigneeId !== undefined) body.assignee = input.assigneeId

  const data = await callAsana<AsanaTaskRaw>(
    apiKey,
    `/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ data: body }),
    },
  )

  // If stateId (section GID) provided, move the task to that section
  if (input.stateId) {
    await callAsana(
      apiKey,
      `/sections/${encodeURIComponent(input.stateId)}/addTask`,
      {
        method: "POST",
        body: JSON.stringify({ data: { task: taskId } }),
      },
    )
  }

  return toTask(data)
}

async function addComment(workspaceId: string, taskId: string, body: string): Promise<PMComment> {
  const { apiKey } = await loadAsanaCreds(workspaceId)

  const data = await callAsana<{
    gid: string
    text: string
    created_by?: { name?: string }
    created_at?: string
  }>(
    apiKey,
    `/tasks/${encodeURIComponent(taskId)}/stories`,
    {
      method: "POST",
      body: JSON.stringify({ data: { text: body } }),
    },
  )

  return {
    id: data.gid,
    body: data.text,
    authorName: data.created_by?.name ?? null,
    createdAt: data.created_at ?? null,
  }
}

async function listTasks(workspaceId: string, limit: number): Promise<PMTask[]> {
  const { apiKey, workspaceGid } = await loadAsanaCreds(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 100)

  const data = await callAsana<AsanaTaskRaw[]>(
    apiKey,
    `/tasks?workspace=${encodeURIComponent(workspaceGid)}&assignee=me&limit=${clamped}&opt_fields=gid,name,permalink_url`,
  )
  return data.map(toTask)
}

async function getTask(workspaceId: string, taskId: string): Promise<PMTaskDetail> {
  const { apiKey } = await loadAsanaCreds(workspaceId)

  const data = await callAsana<AsanaTaskRaw & {
    notes?: string
  }>(
    apiKey,
    `/tasks/${encodeURIComponent(taskId)}?opt_fields=gid,name,notes,permalink_url,assignee.name,completed,created_at,modified_at,memberships.section.name`,
  )

  // Fetch stories (comments) separately
  const stories = await callAsana<{
    gid: string
    text?: string
    type?: string
    created_by?: { name?: string }
    created_at?: string
  }[]>(
    apiKey,
    `/tasks/${encodeURIComponent(taskId)}/stories?opt_fields=gid,text,type,created_by.name,created_at`,
  )
  const comments: PMComment[] = (stories ?? [])
    .filter((s) => s.type === "comment")
    .slice(0, 20)
    .map((s) => ({
      id: s.gid,
      body: s.text ?? "",
      authorName: s.created_by?.name ?? null,
      createdAt: s.created_at ?? null,
    }))

  const sectionName = data.memberships?.[0]?.section?.name ?? null

  return {
    id: data.gid,
    identifier: data.gid,
    title: data.name,
    url: data.permalink_url ?? `https://app.asana.com/0/0/${data.gid}`,
    description: data.notes ?? null,
    status: sectionName ?? (data.completed ? "Completed" : "Open"),
    priority: null, // Asana uses custom fields for priority
    assigneeName: data.assignee?.name ?? null,
    createdAt: data.created_at ?? null,
    updatedAt: data.modified_at ?? null,
    comments,
  }
}

export const asanaPMClient: PMClient = {
  providerKey: "asana",
  createTask,
  updateTask,
  addComment,
  listTasks,
  getTask,
}
```

### 5.4 Update PM Capability Router

**File:** `src/lib/integrations/capabilities/pm.ts`

Update `getPMClient` to enable Asana:

```ts
export async function getPMClient(workspaceId: string): Promise<PMClient | null> {
  const key = await getConnectedPMKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "linear":
      return (await import("@/lib/integrations/clients/linear")).linearPMClient
    case "asana":
      return (await import("@/lib/integrations/clients/asana")).asanaPMClient
    case "clickup":
    case "trello":
    case "notion":
      return null
    default:
      return null
  }
}
```

Also add "asana" to `PM_PROVIDER_KEYS` if it isn't already covered (it is -- `"asana"` is already in the array).

### 5.5 Add New PM Tools

**File:** `src/lib/integrations/tools.ts`

Add these tool factories after the existing `makePMCreateTaskTool`:

```ts
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
            id: task.id,
            identifier: task.identifier,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assignee: task.assigneeName,
            url: task.url,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            comments: task.comments.map((c) => ({
              id: c.id,
              body: c.body,
              author: c.authorName,
              createdAt: c.createdAt,
            })),
          },
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown PM error" }
      }
    },
  })
}
```

**Update the PM block in `buildIntegrationTools`:**

```ts
    ...(pmClient
      ? {
          pm_create_task: makePMCreateTaskTool(workspaceId),
          pm_update_task: makePMUpdateTaskTool(workspaceId),
          pm_add_comment: makePMAddCommentTool(workspaceId),
          pm_list_tasks: makePMListTasksTool(workspaceId),
          pm_get_task: makePMGetTaskTool(workspaceId),
        }
      : {}),
```

### 5.6 Write PM Tests

**File:** `src/lib/integrations/clients/linear.test.ts` (NEW)

```ts
// Tests for Linear PM client (expanded).

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "lin_api_test_key",
  }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockGqlResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data }),
  })
}

describe("Linear PM Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("createTask", () => {
    it("resolves team when not provided, then creates issue", async () => {
      const { linearPMClient } = await import("./linear")
      // First call: resolve team
      mockGqlResponse({ teams: { nodes: [{ id: "team-1" }] } })
      // Second call: create issue
      mockGqlResponse({
        issueCreate: {
          success: true,
          issue: { id: "issue-1", identifier: "ENG-42", title: "Fix bug", url: "https://linear.app/issue/ENG-42" },
        },
      })

      const result = await linearPMClient.createTask("ws-1", { title: "Fix bug" })
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.identifier).toBe("ENG-42")
    })
  })

  describe("updateTask", () => {
    it("sends issueUpdate mutation with changed fields", async () => {
      const { linearPMClient } = await import("./linear")
      mockGqlResponse({
        issueUpdate: {
          success: true,
          issue: { id: "issue-1", identifier: "ENG-42", title: "Updated title", url: "https://linear.app/issue/ENG-42" },
        },
      })

      const result = await linearPMClient.updateTask("ws-1", "issue-1", {
        title: "Updated title",
        priority: 2,
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.query).toContain("issueUpdate")
      expect(body.variables.input.title).toBe("Updated title")
      expect(body.variables.input.priority).toBe(2)
      expect(result.title).toBe("Updated title")
    })
  })

  describe("addComment", () => {
    it("sends commentCreate mutation", async () => {
      const { linearPMClient } = await import("./linear")
      mockGqlResponse({
        commentCreate: {
          success: true,
          comment: {
            id: "comment-1",
            body: "Looking into this now",
            user: { name: "Bot" },
            createdAt: "2026-04-12T10:00:00Z",
          },
        },
      })

      const result = await linearPMClient.addComment("ws-1", "issue-1", "Looking into this now")
      expect(result.body).toBe("Looking into this now")
      expect(result.authorName).toBe("Bot")
    })
  })

  describe("listTasks", () => {
    it("fetches issues ordered by createdAt", async () => {
      const { linearPMClient } = await import("./linear")
      mockGqlResponse({
        issues: {
          nodes: [
            { id: "i1", identifier: "ENG-1", title: "Task 1", url: "https://linear.app/ENG-1" },
            { id: "i2", identifier: "ENG-2", title: "Task 2", url: "https://linear.app/ENG-2" },
          ],
        },
      })

      const result = await linearPMClient.listTasks("ws-1", 10)
      expect(result).toHaveLength(2)
      expect(result[0].identifier).toBe("ENG-1")
    })
  })

  describe("getTask", () => {
    it("fetches issue detail with comments", async () => {
      const { linearPMClient } = await import("./linear")
      mockGqlResponse({
        issue: {
          id: "i1",
          identifier: "ENG-1",
          title: "Task 1",
          description: "Description here",
          url: "https://linear.app/ENG-1",
          priority: 2,
          state: { name: "In Progress" },
          assignee: { name: "Jane" },
          createdAt: "2026-04-10T10:00:00Z",
          updatedAt: "2026-04-11T10:00:00Z",
          comments: {
            nodes: [
              { id: "c1", body: "WIP", user: { name: "Jane" }, createdAt: "2026-04-11T10:00:00Z" },
            ],
          },
        },
      })

      const result = await linearPMClient.getTask("ws-1", "i1")
      expect(result.status).toBe("In Progress")
      expect(result.assigneeName).toBe("Jane")
      expect(result.comments).toHaveLength(1)
      expect(result.comments[0].body).toBe("WIP")
    })
  })
})
```

### 5.7 Commit

```bash
git add -A && git commit -m "feat(integrations): expand PM to full CRUD + add Asana provider

Linear now supports updateTask, addComment, listTasks, getTask. New Asana
client with same PMClient interface. Four new agent tools: pm_update_task,
pm_add_comment, pm_list_tasks, pm_get_task."
```

---

## Task 6: Add Social Media Integration (Buffer)

### 6.1 Create Social Capability

**File:** `src/lib/integrations/capabilities/social.ts` (NEW)

```ts
// Social media capability. Agents can draft social media posts for
// approval. All social posting is approval-gated because posts are
// public and represent the brand.

import { listIntegrations } from "@/lib/integrations/credentials"

export interface SocialPostInput {
  text: string
  profileIds?: string[]   // if omitted, posts to all connected profiles
  mediaUrls?: string[]    // optional media attachments
  scheduledAt?: string    // ISO datetime; if omitted, publishes immediately on approval
}

export interface SocialPost {
  id: string
  text: string
  profileId: string
  profileName: string | null
  status: string           // "sent", "scheduled", "draft"
  scheduledAt: string | null
  publishedAt: string | null
  url: string | null
}

export interface SocialClient {
  providerKey: string

  /**
   * Create and publish a post. Called ONLY by the approval executor.
   */
  createPost(workspaceId: string, input: SocialPostInput): Promise<SocialPost[]>

  /**
   * Schedule a post for future publishing. Called ONLY by the approval executor.
   */
  schedulePost(workspaceId: string, input: SocialPostInput): Promise<SocialPost[]>

  /**
   * List scheduled (pending) posts. Read-only.
   */
  listScheduledPosts(workspaceId: string, limit: number): Promise<SocialPost[]>

  /**
   * List connected social profiles (so the agent knows which channels are available).
   */
  listProfiles(workspaceId: string): Promise<{ id: string; name: string; service: string }[]>
}

const SOCIAL_PROVIDER_KEYS = ["buffer"] as const
export type SocialProviderKey = typeof SOCIAL_PROVIDER_KEYS[number]

export async function getConnectedSocialKey(workspaceId: string): Promise<SocialProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of SOCIAL_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

export async function getSocialClient(workspaceId: string): Promise<SocialClient | null> {
  const key = await getConnectedSocialKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "buffer":
      return (await import("@/lib/integrations/clients/buffer")).bufferSocialClient
    default:
      return null
  }
}
```

### 6.2 Create Buffer Client

**File:** `src/lib/integrations/clients/buffer.ts` (NEW)

```ts
// Buffer social media client.
//
// Uses Buffer's Publish API with an access token.
// Users generate a token in Buffer developer settings.
//
// Docs: https://publish.buffer.com/developers/api

import { getCredentials } from "@/lib/integrations/credentials"
import type {
  SocialClient,
  SocialPost,
  SocialPostInput,
} from "@/lib/integrations/capabilities/social"

const BUFFER_API = "https://api.bufferapp.com/1"

async function callBuffer<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = new URL(BUFFER_API + path)
  url.searchParams.set("access_token", accessToken)
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (payload as { message?: string })?.message ??
      (payload as { error?: string })?.error ??
      `Buffer HTTP ${res.status}`
    throw new Error(`Buffer API error: ${msg}`)
  }
  return payload as T
}

async function loadBufferToken(workspaceId: string): Promise<string> {
  const creds = await getCredentials(workspaceId, "buffer")
  if (!creds?.access_token) {
    throw new Error("Buffer is not connected for this workspace. Connect it via the integration picker first.")
  }
  return creds.access_token
}

// ── Profiles ─────────────────────────────────────────────

interface BufferProfileRaw {
  _id: string
  service: string
  formatted_username?: string
  id?: string
}

async function listProfiles(
  workspaceId: string,
): Promise<{ id: string; name: string; service: string }[]> {
  const token = await loadBufferToken(workspaceId)
  const data = await callBuffer<BufferProfileRaw[]>(token, "/profiles.json")
  return data.map((p) => ({
    id: p._id ?? p.id ?? "",
    name: p.formatted_username ?? p.service,
    service: p.service,
  }))
}

// ── Post creation ────────────────────────────────────────

interface BufferUpdateRaw {
  id: string
  text: string
  profile_id: string
  status: string
  scheduled_at?: number | null
  sent_at?: number | null
  service_link?: string | null
}

function toSocialPost(raw: BufferUpdateRaw, profileName?: string | null): SocialPost {
  return {
    id: raw.id,
    text: raw.text,
    profileId: raw.profile_id,
    profileName: profileName ?? null,
    status: raw.status ?? "sent",
    scheduledAt: raw.scheduled_at ? new Date(raw.scheduled_at * 1000).toISOString() : null,
    publishedAt: raw.sent_at ? new Date(raw.sent_at * 1000).toISOString() : null,
    url: raw.service_link ?? null,
  }
}

async function resolveProfileIds(
  token: string,
  workspaceId: string,
  profileIds?: string[],
): Promise<string[]> {
  if (profileIds && profileIds.length > 0) return profileIds
  // If no profile IDs specified, use all connected profiles
  const profiles = await callBuffer<BufferProfileRaw[]>(token, "/profiles.json")
  return profiles.map((p) => p._id ?? p.id ?? "").filter(Boolean)
}

async function createPost(
  workspaceId: string,
  input: SocialPostInput,
): Promise<SocialPost[]> {
  const token = await loadBufferToken(workspaceId)
  const profileIds = await resolveProfileIds(token, workspaceId, input.profileIds)

  if (profileIds.length === 0) {
    throw new Error("No Buffer profiles found. Connect at least one social media profile in Buffer.")
  }

  const results: SocialPost[] = []
  for (const profileId of profileIds) {
    const body: Record<string, unknown> = {
      text: input.text,
      profile_ids: [profileId],
      now: true, // publish immediately
    }
    if (input.mediaUrls && input.mediaUrls.length > 0) {
      body.media = { photo: input.mediaUrls[0] }
    }

    const data = await callBuffer<{ updates: BufferUpdateRaw[] }>(
      token,
      "/updates/create.json",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    )
    for (const update of data.updates ?? []) {
      results.push(toSocialPost(update))
    }
  }
  return results
}

async function schedulePost(
  workspaceId: string,
  input: SocialPostInput,
): Promise<SocialPost[]> {
  const token = await loadBufferToken(workspaceId)
  const profileIds = await resolveProfileIds(token, workspaceId, input.profileIds)

  if (profileIds.length === 0) {
    throw new Error("No Buffer profiles found.")
  }

  const results: SocialPost[] = []
  for (const profileId of profileIds) {
    const body: Record<string, unknown> = {
      text: input.text,
      profile_ids: [profileId],
    }
    if (input.scheduledAt) {
      body.scheduled_at = input.scheduledAt
    }
    if (input.mediaUrls && input.mediaUrls.length > 0) {
      body.media = { photo: input.mediaUrls[0] }
    }

    const data = await callBuffer<{ updates: BufferUpdateRaw[] }>(
      token,
      "/updates/create.json",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    )
    for (const update of data.updates ?? []) {
      results.push(toSocialPost(update))
    }
  }
  return results
}

async function listScheduledPosts(workspaceId: string, limit: number): Promise<SocialPost[]> {
  const token = await loadBufferToken(workspaceId)
  const profiles = await callBuffer<BufferProfileRaw[]>(token, "/profiles.json")
  const clamped = Math.min(Math.max(limit, 1), 50)

  const posts: SocialPost[] = []
  for (const profile of profiles) {
    const pid = profile._id ?? profile.id
    if (!pid) continue
    const data = await callBuffer<{ updates: BufferUpdateRaw[] }>(
      token,
      `/profiles/${encodeURIComponent(pid)}/updates/pending.json?count=${clamped}`,
    )
    for (const update of data.updates ?? []) {
      posts.push(toSocialPost(update, profile.formatted_username))
    }
    if (posts.length >= clamped) break
  }
  return posts.slice(0, clamped)
}

export const bufferSocialClient: SocialClient = {
  providerKey: "buffer",
  createPost,
  schedulePost,
  listScheduledPosts,
  listProfiles,
}
```

### 6.3 Add Social Tools (Approval-Gated)

**File:** `src/lib/integrations/tools.ts`

Add the import:

```ts
import { getSocialClient } from "@/lib/integrations/capabilities/social"
```

Add tool factories:

```ts
// ── Social media tools (approval-gated) ──────────────────

function makeSocialCreatePostDraftTool(workspaceId: string, agentId: string | undefined) {
  return tool({
    description:
      "Draft a social media post for the owner's approval. DOES NOT publish immediately. The post appears in the approval queue. When approved, it's published via Buffer to the connected social media profiles. Use when the user asks to 'post to social media', 'tweet', 'post on LinkedIn', etc.",
    inputSchema: jsonSchema<{
      text: string
      profileIds?: string[]
      mediaUrls?: string[]
      reasoning?: string
    }>({
      type: "object",
      properties: {
        text: { type: "string", minLength: 1, maxLength: 2000, description: "The post text content" },
        profileIds: { type: "array", items: { type: "string" }, maxItems: 10, description: "Specific Buffer profile IDs. Omit to post to all profiles." },
        mediaUrls: { type: "array", items: { type: "string" }, maxItems: 4, description: "URLs of images to attach" },
        reasoning: { type: "string", maxLength: 500 },
      },
      required: ["text"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        if (!agentId) return { ok: false, error: "Agent context required to draft a post." }
        const preview = input.text.length > 80 ? input.text.slice(0, 77) + "..." : input.text
        const title = "Publish social media post"
        const description = `"${preview}"`

        const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)

        const [request] = await db.insert(approvalRequests).values({
          agentId,
          agentName: agent?.name ?? "Agent",
          actionType: "social_create_post",
          title,
          description,
          reasoning: input.reasoning ?? null,
          urgency: "normal",
          actionPayload: {
            type: "social_create_post",
            workspaceId,
            text: input.text,
            profileIds: input.profileIds,
            mediaUrls: input.mediaUrls,
          },
        }).returning()

        return {
          ok: true,
          drafted: true,
          approvalRequestId: request.id,
          message: "Social post drafted and submitted for approval.",
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to draft post" }
      }
    },
  })
}

function makeSocialSchedulePostDraftTool(workspaceId: string, agentId: string | undefined) {
  return tool({
    description:
      "Draft a social media post to be scheduled for a specific time, pending owner approval. Use when the user asks to schedule a post for later.",
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
        const title = `Schedule social post for ${input.scheduledAt}`
        const description = `Scheduled: ${input.scheduledAt}\n\n"${preview}"`

        const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)

        const [request] = await db.insert(approvalRequests).values({
          agentId,
          agentName: agent?.name ?? "Agent",
          actionType: "social_schedule_post",
          title,
          description,
          reasoning: input.reasoning ?? null,
          urgency: "normal",
          actionPayload: {
            type: "social_schedule_post",
            workspaceId,
            text: input.text,
            scheduledAt: input.scheduledAt,
            profileIds: input.profileIds,
            mediaUrls: input.mediaUrls,
          },
        }).returning()

        return {
          ok: true,
          drafted: true,
          approvalRequestId: request.id,
          message: `Social post scheduled for ${input.scheduledAt} and submitted for approval.`,
        }
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
      properties: {
        limit: { type: "number", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    }),
    execute: async ({ limit }) => {
      try {
        const client = await getSocialClient(workspaceId)
        if (!client) return { ok: false, error: "No social media tool is connected." }
        const posts = await client.listScheduledPosts(workspaceId, limit ?? 10)
        return {
          ok: true,
          provider: client.providerKey,
          count: posts.length,
          posts: posts.map((p) => ({
            id: p.id,
            text: p.text,
            profile: p.profileName,
            scheduledAt: p.scheduledAt,
            status: p.status,
          })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown social error" }
      }
    },
  })
}
```

**Update `buildIntegrationTools`** to include social in the Promise.all and tool block:

```ts
  const [crmClient, pmClient, paymentsClient, messagingClient, emailClient, calendarClient, socialClient] = await Promise.all([
    getCRMClient(workspaceId),
    getPMClient(workspaceId),
    getPaymentsClient(workspaceId),
    getMessagingClient(workspaceId),
    getEmailClient(workspaceId),
    getCalendarClient(workspaceId),
    getSocialClient(workspaceId),
  ])

  return {
    // ... existing blocks ...

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
  }
```

### 6.4 Register Social Actions in Approval Executor

**File:** `src/lib/approvals/executor.ts`

```ts
import { getSocialClient } from "@/lib/integrations/capabilities/social"

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

// Update union:
export type ApprovalAction =
  | SendMessageAction
  | SendEmailAction
  | BookMeetingAction
  | SocialCreatePostAction
  | SocialSchedulePostAction

// Update isApprovalAction:
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

// Add dispatch branches:
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
```

### 6.5 Write Buffer Tests

**File:** `src/lib/integrations/clients/buffer.test.ts` (NEW)

```ts
// Tests for Buffer social media client.

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    access_token: "buf_test_token_123",
  }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(data),
  })
}

describe("Buffer Social Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("listProfiles", () => {
    it("fetches and normalizes profiles", async () => {
      const { bufferSocialClient } = await import("./buffer")
      mockFetchResponse([
        { _id: "p1", service: "twitter", formatted_username: "@mycompany" },
        { _id: "p2", service: "linkedin", formatted_username: "My Company" },
      ])

      const result = await bufferSocialClient.listProfiles("ws-1")
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ id: "p1", name: "@mycompany", service: "twitter" })
    })
  })

  describe("createPost", () => {
    it("publishes to specified profile immediately", async () => {
      const { bufferSocialClient } = await import("./buffer")
      mockFetchResponse({
        updates: [{
          id: "update-1",
          text: "Hello world!",
          profile_id: "p1",
          status: "sent",
          sent_at: 1744454400,
        }],
      })

      const result = await bufferSocialClient.createPost("ws-1", {
        text: "Hello world!",
        profileIds: ["p1"],
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toContain("/updates/create.json")
      const body = JSON.parse(init.body)
      expect(body.text).toBe("Hello world!")
      expect(body.now).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe("sent")
    })

    it("publishes to all profiles when none specified", async () => {
      const { bufferSocialClient } = await import("./buffer")
      // First: fetch profiles
      mockFetchResponse([
        { _id: "p1", service: "twitter" },
        { _id: "p2", service: "linkedin" },
      ])
      // Second: create for p1
      mockFetchResponse({ updates: [{ id: "u1", text: "Post", profile_id: "p1", status: "sent" }] })
      // Third: create for p2
      mockFetchResponse({ updates: [{ id: "u2", text: "Post", profile_id: "p2", status: "sent" }] })

      const result = await bufferSocialClient.createPost("ws-1", { text: "Post" })
      expect(result).toHaveLength(2)
    })
  })

  describe("listScheduledPosts", () => {
    it("fetches pending updates across profiles", async () => {
      const { bufferSocialClient } = await import("./buffer")
      // First: fetch profiles
      mockFetchResponse([{ _id: "p1", service: "twitter", formatted_username: "@co" }])
      // Second: fetch pending for p1
      mockFetchResponse({
        updates: [
          { id: "u1", text: "Scheduled post", profile_id: "p1", status: "buffer", scheduled_at: 1744540800 },
        ],
      })

      const result = await bufferSocialClient.listScheduledPosts("ws-1", 10)
      expect(result).toHaveLength(1)
      expect(result[0].profileName).toBe("@co")
      expect(result[0].scheduledAt).toBeTruthy()
    })
  })
})
```

### 6.6 Commit

```bash
git add -A && git commit -m "feat(integrations): add Buffer social media integration with approval-gated posting

New social capability layer, Buffer client (create post, schedule post,
list scheduled, list profiles). Posting and scheduling are approval-gated.
Executor branches for social_create_post and social_schedule_post."
```

---

## Task 7: Add Document Integration (Notion)

### 7.1 Add Notion to Registry

**File:** `src/lib/integrations/registry.ts`

The category type already includes `"content"`. Add to `PROVIDERS` array:

```ts
  {
    key: "notion",
    name: "Notion",
    category: "content",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "Internal Integration Token", type: "password", required: true, help: "Settings -> Connections -> Develop or manage integrations -> Create new integration -> Internal -> copy token" },
    ],
    docsUrl: "https://developers.notion.com/docs/getting-started",
  },
```

Add to `aliases`:

```ts
    notion: "notion",
```

### 7.2 Create Docs Capability

**File:** `src/lib/integrations/capabilities/docs.ts` (NEW)

```ts
// Documents capability. Agents can create and update pages/docs in
// whatever document tool the user has connected (Notion, Google Docs).
// Document creation is NOT approval-gated since it's internal workspace
// content (not customer-facing). The user can always review/edit in
// the native tool.

import { listIntegrations } from "@/lib/integrations/credentials"

export interface DocsCreatePageInput {
  title: string
  content: string        // Markdown or plain text (client converts to provider format)
  parentId?: string      // parent page/database ID (if omitted, creates at top level)
}

export interface DocsUpdatePageInput {
  content?: string       // replaces page body
  title?: string         // updates title
}

export interface DocsPage {
  id: string
  title: string
  url: string
  createdAt: string | null
  updatedAt: string | null
}

export interface DocsPageDetail extends DocsPage {
  content: string        // plain text extraction of page content
}

export interface DocsSearchResult {
  id: string
  title: string
  url: string
  snippet: string | null
}

export interface DocsClient {
  providerKey: string
  createPage(workspaceId: string, input: DocsCreatePageInput): Promise<DocsPage>
  updatePage(workspaceId: string, pageId: string, input: DocsUpdatePageInput): Promise<DocsPage>
  getPage(workspaceId: string, pageId: string): Promise<DocsPageDetail>
  search(workspaceId: string, query: string, limit: number): Promise<DocsSearchResult[]>
}

const DOCS_PROVIDER_KEYS = ["notion", "google_docs"] as const
export type DocsProviderKey = typeof DOCS_PROVIDER_KEYS[number]

export async function getConnectedDocsKey(workspaceId: string): Promise<DocsProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of DOCS_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

export async function getDocsClient(workspaceId: string): Promise<DocsClient | null> {
  const key = await getConnectedDocsKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "notion":
      return (await import("@/lib/integrations/clients/notion")).notionDocsClient
    case "google_docs":
      return null // Implemented in Task 10 (OAuth required)
    default:
      return null
  }
}
```

### 7.3 Create Notion Client

**File:** `src/lib/integrations/clients/notion.ts` (NEW)

```ts
// Notion documents client.
//
// Uses internal integration tokens (no OAuth required for internal integrations).
// Creates pages with rich text blocks converted from markdown.
//
// Docs: https://developers.notion.com/reference/intro

import { getCredentials } from "@/lib/integrations/credentials"
import type {
  DocsClient,
  DocsCreatePageInput,
  DocsUpdatePageInput,
  DocsPage,
  DocsPageDetail,
  DocsSearchResult,
} from "@/lib/integrations/capabilities/docs"

const NOTION_API = "https://api.notion.com/v1"
const NOTION_VERSION = "2022-06-28"

async function callNotion<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(NOTION_API + path, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
      ...(init.headers ?? {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (payload as { message?: string })?.message ??
      (payload as { code?: string })?.code ??
      `Notion HTTP ${res.status}`
    throw new Error(`Notion API error: ${msg}`)
  }
  return payload as T
}

async function loadNotionToken(workspaceId: string): Promise<string> {
  const creds = await getCredentials(workspaceId, "notion")
  if (!creds?.api_key) {
    throw new Error("Notion is not connected for this workspace. Connect it via the integration picker first.")
  }
  return creds.api_key
}

// ── Markdown to Notion blocks ────────────────────────────
// Simplified converter. Handles paragraphs, headings, bullets, code.

interface NotionBlock {
  object: "block"
  type: string
  [key: string]: unknown
}

function markdownToBlocks(markdown: string): NotionBlock[] {
  const lines = markdown.split("\n")
  const blocks: NotionBlock[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith("### ")) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: trimmed.slice(4) } }],
        },
      })
    } else if (trimmed.startsWith("## ")) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: trimmed.slice(3) } }],
        },
      })
    } else if (trimmed.startsWith("# ")) {
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: {
          rich_text: [{ type: "text", text: { content: trimmed.slice(2) } }],
        },
      })
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: trimmed.slice(2) } }],
        },
      })
    } else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: [{ type: "text", text: { content: trimmed.replace(/^\d+\.\s/, "") } }],
        },
      })
    } else if (trimmed.startsWith("```")) {
      // Simple code block (single line for now)
      blocks.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: trimmed.replace(/^```\w*\s?/, "").replace(/```$/, "") } }],
          language: "plain text",
        },
      })
    } else {
      // Notion rich_text content has a 2000-char limit per segment
      const chunks: { type: string; text: { content: string } }[] = []
      for (let i = 0; i < trimmed.length; i += 2000) {
        chunks.push({ type: "text", text: { content: trimmed.slice(i, i + 2000) } })
      }
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: chunks },
      })
    }
  }
  return blocks
}

// ── Notion blocks to plain text ──────────────────────────

function extractRichText(richText: { plain_text?: string }[]): string {
  return (richText ?? []).map((t) => t.plain_text ?? "").join("")
}

function blocksToText(blocks: { type: string; [key: string]: unknown }[]): string {
  const lines: string[] = []
  for (const block of blocks) {
    const b = block as Record<string, unknown>
    const blockData = b[block.type] as { rich_text?: { plain_text?: string }[] } | undefined
    if (blockData?.rich_text) {
      const text = extractRichText(blockData.rich_text)
      if (block.type === "heading_1") lines.push(`# ${text}`)
      else if (block.type === "heading_2") lines.push(`## ${text}`)
      else if (block.type === "heading_3") lines.push(`### ${text}`)
      else if (block.type === "bulleted_list_item") lines.push(`- ${text}`)
      else if (block.type === "numbered_list_item") lines.push(`1. ${text}`)
      else lines.push(text)
    }
  }
  return lines.join("\n")
}

// ── Page operations ──────────────────────────────────────

interface NotionPageRaw {
  id: string
  url: string
  created_time?: string
  last_edited_time?: string
  properties?: {
    title?: { title?: { plain_text?: string }[] }
    Name?: { title?: { plain_text?: string }[] }
    [key: string]: unknown
  }
}

function extractTitle(page: NotionPageRaw): string {
  const titleProp = page.properties?.title ?? page.properties?.Name
  if (titleProp?.title) {
    return titleProp.title.map((t) => t.plain_text ?? "").join("") || "Untitled"
  }
  return "Untitled"
}

function toDocsPage(raw: NotionPageRaw): DocsPage {
  return {
    id: raw.id,
    title: extractTitle(raw),
    url: raw.url,
    createdAt: raw.created_time ?? null,
    updatedAt: raw.last_edited_time ?? null,
  }
}

async function createPage(
  workspaceId: string,
  input: DocsCreatePageInput,
): Promise<DocsPage> {
  const token = await loadNotionToken(workspaceId)
  const blocks = markdownToBlocks(input.content)

  // Determine parent. If parentId provided, use it as page parent.
  // Otherwise, search for the first accessible page to use as parent,
  // or fall back to the workspace (which requires the integration to
  // have workspace-level access).
  let parent: Record<string, string>
  if (input.parentId) {
    parent = { type: "page_id", page_id: input.parentId }
  } else {
    // Try to find a suitable parent page by searching
    const searchResults = await callNotion<{
      results: NotionPageRaw[]
    }>(token, "/search", {
      method: "POST",
      body: JSON.stringify({
        filter: { value: "page", property: "object" },
        page_size: 1,
      }),
    })
    const firstPage = searchResults.results?.[0]
    if (firstPage) {
      parent = { type: "page_id", page_id: firstPage.id }
    } else {
      // Notion requires a parent. If we can't find one, throw.
      throw new Error(
        "No accessible Notion pages found. Make sure your Notion integration has access to at least one page.",
      )
    }
  }

  const data = await callNotion<NotionPageRaw>(
    token,
    "/pages",
    {
      method: "POST",
      body: JSON.stringify({
        parent,
        properties: {
          title: {
            title: [{ type: "text", text: { content: input.title } }],
          },
        },
        children: blocks.slice(0, 100), // Notion API limit: 100 blocks per request
      }),
    },
  )

  return toDocsPage(data)
}

async function updatePage(
  workspaceId: string,
  pageId: string,
  input: DocsUpdatePageInput,
): Promise<DocsPage> {
  const token = await loadNotionToken(workspaceId)

  // Update title if provided
  if (input.title) {
    await callNotion(
      token,
      `/pages/${encodeURIComponent(pageId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            title: {
              title: [{ type: "text", text: { content: input.title } }],
            },
          },
        }),
      },
    )
  }

  // Replace content if provided.
  // Notion doesn't have a "replace all blocks" API. We need to:
  // 1. Get existing block children
  // 2. Delete them
  // 3. Append new blocks
  if (input.content) {
    // Fetch existing children
    const existing = await callNotion<{
      results: { id: string }[]
    }>(token, `/blocks/${encodeURIComponent(pageId)}/children?page_size=100`)

    // Delete existing blocks
    for (const block of existing.results ?? []) {
      await callNotion(token, `/blocks/${encodeURIComponent(block.id)}`, { method: "DELETE" })
    }

    // Append new blocks
    const newBlocks = markdownToBlocks(input.content)
    if (newBlocks.length > 0) {
      await callNotion(
        token,
        `/blocks/${encodeURIComponent(pageId)}/children`,
        {
          method: "PATCH",
          body: JSON.stringify({ children: newBlocks.slice(0, 100) }),
        },
      )
    }
  }

  // Fetch updated page
  const page = await callNotion<NotionPageRaw>(
    token,
    `/pages/${encodeURIComponent(pageId)}`,
  )
  return toDocsPage(page)
}

async function getPage(
  workspaceId: string,
  pageId: string,
): Promise<DocsPageDetail> {
  const token = await loadNotionToken(workspaceId)

  const page = await callNotion<NotionPageRaw>(
    token,
    `/pages/${encodeURIComponent(pageId)}`,
  )

  const blocks = await callNotion<{
    results: { type: string; [key: string]: unknown }[]
  }>(token, `/blocks/${encodeURIComponent(pageId)}/children?page_size=100`)

  return {
    ...toDocsPage(page),
    content: blocksToText(blocks.results ?? []),
  }
}

async function search(
  workspaceId: string,
  query: string,
  limit: number,
): Promise<DocsSearchResult[]> {
  const token = await loadNotionToken(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 50)

  const data = await callNotion<{
    results: (NotionPageRaw & {
      properties?: Record<string, unknown>
    })[]
  }>(
    token,
    "/search",
    {
      method: "POST",
      body: JSON.stringify({
        query,
        filter: { value: "page", property: "object" },
        page_size: clamped,
      }),
    },
  )

  return (data.results ?? []).map((r) => ({
    id: r.id,
    title: extractTitle(r),
    url: r.url,
    snippet: null, // Notion search doesn't return content snippets
  }))
}

export const notionDocsClient: DocsClient = {
  providerKey: "notion",
  createPage,
  updatePage,
  getPage,
  search,
}
```

### 7.4 Add Docs Tools

**File:** `src/lib/integrations/tools.ts`

Add the import:

```ts
import { getDocsClient } from "@/lib/integrations/capabilities/docs"
```

Add tool factories:

```ts
// ── Docs tools ───────────────────────────────────────────

function makeDocsCreatePageTool(workspaceId: string) {
  return tool({
    description:
      "Create a new page/document in the user's connected docs tool (Notion, Google Docs). Use when the user asks to 'create a doc', 'write up a page', 'make a brief', etc. Supports markdown in the content field.",
    inputSchema: jsonSchema<{
      title: string
      content: string
      parentId?: string
    }>({
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        content: { type: "string", minLength: 1, maxLength: 50000, description: "Page content in markdown format" },
        parentId: { type: "string", maxLength: 100, description: "Optional parent page/database ID. Creates at top level if omitted." },
      },
      required: ["title", "content"],
      additionalProperties: false,
    }),
    execute: async (input) => {
      try {
        const client = await getDocsClient(workspaceId)
        if (!client) return { ok: false, error: "No docs tool is connected for this workspace." }
        const page = await client.createPage(workspaceId, input)
        return {
          ok: true,
          provider: client.providerKey,
          page: { id: page.id, title: page.title, url: page.url },
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown docs error" }
      }
    },
  })
}

function makeDocsUpdatePageTool(workspaceId: string) {
  return tool({
    description:
      "Update an existing page/document. Can change the title, replace the content, or both. Use when the user asks to 'update the doc', 'edit the page', 'revise the brief'.",
    inputSchema: jsonSchema<{
      pageId: string
      title?: string
      content?: string
    }>({
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
        return {
          ok: true,
          provider: client.providerKey,
          page: { id: page.id, title: page.title, url: page.url },
        }
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
          ok: true,
          provider: client.providerKey,
          count: results.length,
          results: results.map((r) => ({
            id: r.id,
            title: r.title,
            url: r.url,
            snippet: r.snippet,
          })),
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown docs error" }
      }
    },
  })
}
```

**Update `buildIntegrationTools`:**

```ts
  const [crmClient, pmClient, paymentsClient, messagingClient, emailClient, calendarClient, socialClient, docsClient] = await Promise.all([
    getCRMClient(workspaceId),
    getPMClient(workspaceId),
    getPaymentsClient(workspaceId),
    getMessagingClient(workspaceId),
    getEmailClient(workspaceId),
    getCalendarClient(workspaceId),
    getSocialClient(workspaceId),
    getDocsClient(workspaceId),
  ])

  return {
    // ... existing blocks ...

    ...(docsClient
      ? {
          docs_create_page: makeDocsCreatePageTool(workspaceId),
          docs_update_page: makeDocsUpdatePageTool(workspaceId),
          docs_search: makeDocsSearchTool(workspaceId),
        }
      : {}),
  }
```

### 7.5 Write Notion Tests

**File:** `src/lib/integrations/clients/notion.test.ts` (NEW)

```ts
// Tests for Notion docs client.

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "ntn_test_token_123",
  }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(data),
  })
}

describe("Notion Docs Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("createPage", () => {
    it("creates page with markdown converted to blocks", async () => {
      const { notionDocsClient } = await import("./notion")

      // Search for parent page
      mockFetchResponse({
        results: [{ id: "parent-page-id", url: "https://notion.so/parent" }],
      })

      // Create page
      mockFetchResponse({
        id: "new-page-id",
        url: "https://notion.so/new-page",
        created_time: "2026-04-12T10:00:00Z",
        properties: {
          title: { title: [{ plain_text: "Meeting Notes" }] },
        },
      })

      const result = await notionDocsClient.createPage("ws-1", {
        title: "Meeting Notes",
        content: "# Header\n\n- Bullet one\n- Bullet two\n\nParagraph text.",
      })

      expect(result.id).toBe("new-page-id")
      expect(result.title).toBe("Meeting Notes")

      // Verify blocks were sent
      const createCall = mockFetch.mock.calls[1]
      const body = JSON.parse(createCall[1].body)
      expect(body.children.length).toBeGreaterThan(0)
      expect(body.children[0].type).toBe("heading_1")
      expect(body.properties.title.title[0].text.content).toBe("Meeting Notes")
    })

    it("uses parentId when provided", async () => {
      const { notionDocsClient } = await import("./notion")
      mockFetchResponse({
        id: "child-page",
        url: "https://notion.so/child",
        properties: { title: { title: [{ plain_text: "Child" }] } },
      })

      await notionDocsClient.createPage("ws-1", {
        title: "Child",
        content: "Content",
        parentId: "specific-parent-id",
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.parent.page_id).toBe("specific-parent-id")
    })
  })

  describe("search", () => {
    it("searches and returns results", async () => {
      const { notionDocsClient } = await import("./notion")
      mockFetchResponse({
        results: [
          {
            id: "p1",
            url: "https://notion.so/p1",
            properties: { title: { title: [{ plain_text: "Strategy Doc" }] } },
          },
          {
            id: "p2",
            url: "https://notion.so/p2",
            properties: { Name: { title: [{ plain_text: "Q3 Plan" }] } },
          },
        ],
      })

      const result = await notionDocsClient.search("ws-1", "strategy", 10)
      expect(result).toHaveLength(2)
      expect(result[0].title).toBe("Strategy Doc")
      expect(result[1].title).toBe("Q3 Plan")
    })
  })

  describe("getPage", () => {
    it("fetches page metadata and block content", async () => {
      const { notionDocsClient } = await import("./notion")
      // Page metadata
      mockFetchResponse({
        id: "p1",
        url: "https://notion.so/p1",
        created_time: "2026-04-10T10:00:00Z",
        last_edited_time: "2026-04-11T10:00:00Z",
        properties: { title: { title: [{ plain_text: "My Page" }] } },
      })
      // Block children
      mockFetchResponse({
        results: [
          {
            type: "heading_2",
            heading_2: { rich_text: [{ plain_text: "Section Title" }] },
          },
          {
            type: "paragraph",
            paragraph: { rich_text: [{ plain_text: "Some content here." }] },
          },
        ],
      })

      const result = await notionDocsClient.getPage("ws-1", "p1")
      expect(result.title).toBe("My Page")
      expect(result.content).toContain("## Section Title")
      expect(result.content).toContain("Some content here.")
    })
  })
})
```

### 7.6 Commit

```bash
git add -A && git commit -m "feat(integrations): add Notion document integration with markdown support

New docs capability layer, Notion client (create, update, get, search
pages). Markdown-to-Notion-blocks converter for content input. Not
approval-gated since docs are internal workspace content."
```

---

## Task 8: Add Analytics Integration (PostHog)

### 8.1 Add PostHog to Registry

**File:** `src/lib/integrations/registry.ts`

Add a new category. Update the category type:

```ts
  category: "crm" | "email" | "payments" | "marketing" | "delivery" | "dashboards" | "content" | "calendar" | "analytics"
```

Add to `PROVIDERS` array:

```ts
  // ── Analytics ────────────────────────────────────────────
  {
    key: "posthog",
    name: "PostHog",
    category: "analytics",
    authType: "api_key_multi",
    fields: [
      { key: "api_key", label: "Personal API Key", type: "password", required: true, help: "Settings -> Personal API Keys -> Create personal API key" },
      { key: "project_id", label: "Project ID", type: "text", required: true, help: "Settings -> Project -> Project API Key (the numeric project ID)" },
      { key: "host", label: "PostHog Host", type: "url", required: false, placeholder: "https://app.posthog.com", help: "Leave blank for PostHog Cloud. For self-hosted, enter your instance URL." },
    ],
    docsUrl: "https://posthog.com/docs/api",
  },
```

Add to `aliases`:

```ts
    posthog: "posthog",
```

### 8.2 Create Analytics Capability

**File:** `src/lib/integrations/capabilities/analytics.ts` (NEW)

```ts
// Analytics capability. Read-only access to product/traffic metrics.
// No approval gate needed since this is pure data retrieval.

import { listIntegrations } from "@/lib/integrations/credentials"

export interface AnalyticsMetric {
  name: string
  value: number
  previousValue?: number
  changePercent?: number
}

export interface AnalyticsInsight {
  id: string
  name: string
  description: string | null
  metrics: AnalyticsMetric[]
  dateRange: { from: string; to: string }
}

export interface AnalyticsEvent {
  id: string
  event: string
  timestamp: string
  distinctId: string
  properties: Record<string, unknown>
}

export interface AnalyticsClient {
  providerKey: string

  /**
   * Get key metrics (pageviews, unique users, sessions, etc.) for a date range.
   */
  getMetrics(
    workspaceId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<AnalyticsInsight>

  /**
   * Get recent events (page views, custom events, etc.)
   */
  getEvents(
    workspaceId: string,
    eventName: string | undefined,
    limit: number,
  ): Promise<AnalyticsEvent[]>
}

const ANALYTICS_PROVIDER_KEYS = ["posthog"] as const
export type AnalyticsProviderKey = typeof ANALYTICS_PROVIDER_KEYS[number]

export async function getConnectedAnalyticsKey(workspaceId: string): Promise<AnalyticsProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of ANALYTICS_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

export async function getAnalyticsClient(workspaceId: string): Promise<AnalyticsClient | null> {
  const key = await getConnectedAnalyticsKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "posthog":
      return (await import("@/lib/integrations/clients/posthog")).posthogAnalyticsClient
    default:
      return null
  }
}
```

### 8.3 Create PostHog Client

**File:** `src/lib/integrations/clients/posthog.ts` (NEW)

```ts
// PostHog analytics client.
//
// Uses PostHog API with personal API key for server-side queries.
// Read-only: fetches insights, events, and trends.
//
// Docs: https://posthog.com/docs/api

import { getCredentials } from "@/lib/integrations/credentials"
import type {
  AnalyticsClient,
  AnalyticsInsight,
  AnalyticsMetric,
  AnalyticsEvent,
} from "@/lib/integrations/capabilities/analytics"

interface PostHogCreds {
  apiKey: string
  projectId: string
  host: string
}

async function loadPostHogCreds(workspaceId: string): Promise<PostHogCreds> {
  const creds = await getCredentials(workspaceId, "posthog")
  if (!creds?.api_key || !creds?.project_id) {
    throw new Error("PostHog is not connected for this workspace. Connect it via the integration picker first.")
  }
  return {
    apiKey: creds.api_key,
    projectId: creds.project_id,
    host: creds.host || "https://app.posthog.com",
  }
}

async function callPostHog<T>(
  creds: PostHogCreds,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${creds.host}/api/projects/${creds.projectId}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      "Authorization": `Bearer ${creds.apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (payload as { detail?: string })?.detail ??
      (payload as { message?: string })?.message ??
      `PostHog HTTP ${res.status}`
    throw new Error(`PostHog API error: ${msg}`)
  }
  return payload as T
}

// ── Metrics via Trends query ─────────────────────────────

async function getMetrics(
  workspaceId: string,
  dateFrom: string,
  dateTo: string,
): Promise<AnalyticsInsight> {
  const creds = await loadPostHogCreds(workspaceId)

  // Query pageview and unique user counts via the trends endpoint
  const data = await callPostHog<{
    result: {
      action: { id: string; name: string }
      count: number
      data: number[]
      labels: string[]
    }[]
  }>(creds, "/insights/trend/", {
    method: "POST",
    body: JSON.stringify({
      events: [
        { id: "$pageview", math: "total", name: "Pageviews" },
        { id: "$pageview", math: "dau", name: "Unique Users" },
      ],
      date_from: dateFrom,
      date_to: dateTo,
    }),
  })

  const metrics: AnalyticsMetric[] = (data.result ?? []).map((r) => {
    const total = r.count ?? r.data?.reduce((a, b) => a + b, 0) ?? 0
    return {
      name: r.action?.name ?? "Unknown",
      value: total,
    }
  })

  return {
    id: "trend-overview",
    name: "Analytics Overview",
    description: `Metrics from ${dateFrom} to ${dateTo}`,
    metrics,
    dateRange: { from: dateFrom, to: dateTo },
  }
}

// ── Recent Events ────────────────────────────────────────

async function getEvents(
  workspaceId: string,
  eventName: string | undefined,
  limit: number,
): Promise<AnalyticsEvent[]> {
  const creds = await loadPostHogCreds(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 100)

  const params = new URLSearchParams({ limit: String(clamped) })
  if (eventName) {
    params.set("event", eventName)
  }

  const data = await callPostHog<{
    results: {
      id: string
      event: string
      timestamp: string
      distinct_id: string
      properties: Record<string, unknown>
    }[]
  }>(creds, `/events/?${params.toString()}`)

  return (data.results ?? []).map((e) => ({
    id: e.id,
    event: e.event,
    timestamp: e.timestamp,
    distinctId: e.distinct_id,
    properties: e.properties ?? {},
  }))
}

export const posthogAnalyticsClient: AnalyticsClient = {
  providerKey: "posthog",
  getMetrics,
  getEvents,
}
```

### 8.4 Add Analytics Tools

**File:** `src/lib/integrations/tools.ts`

Add the import:

```ts
import { getAnalyticsClient } from "@/lib/integrations/capabilities/analytics"
```

Add tool factories:

```ts
// ── Analytics tools (read-only, no approval gate) ────────

function makeAnalyticsGetMetricsTool(workspaceId: string) {
  return tool({
    description:
      "Get analytics metrics (pageviews, unique users, etc.) for a date range. Use when the user asks 'how are we doing', 'traffic this week', 'user growth', or any metrics question. Pulls from the connected analytics tool (PostHog, Plausible).",
    inputSchema: jsonSchema<{
      dateFrom: string
      dateTo: string
    }>({
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
          ok: true,
          provider: client.providerKey,
          name: insight.name,
          dateRange: insight.dateRange,
          metrics: insight.metrics.map((m) => ({
            name: m.name,
            value: m.value,
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
    inputSchema: jsonSchema<{
      eventName?: string
      limit?: number
    }>({
      type: "object",
      properties: {
        eventName: { type: "string", maxLength: 200, description: "Filter by event name (e.g. '$pageview', 'signup_completed'). Omit for all events." },
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
          ok: true,
          provider: client.providerKey,
          count: events.length,
          events: events.map((e) => ({
            event: e.event,
            timestamp: e.timestamp,
            user: e.distinctId,
            // Only include a subset of properties to avoid overwhelming the agent context
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
```

**Update `buildIntegrationTools`:**

```ts
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
    // ... existing blocks ...

    ...(analyticsClient
      ? {
          analytics_get_metrics: makeAnalyticsGetMetricsTool(workspaceId),
          analytics_get_events: makeAnalyticsGetEventsTool(workspaceId),
        }
      : {}),
  }
```

### 8.5 Write PostHog Tests

**File:** `src/lib/integrations/clients/posthog.test.ts` (NEW)

```ts
// Tests for PostHog analytics client.

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "phx_test_key_123",
    project_id: "12345",
    host: "https://app.posthog.com",
  }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(data),
  })
}

describe("PostHog Analytics Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("getMetrics", () => {
    it("queries trends endpoint and returns formatted metrics", async () => {
      const { posthogAnalyticsClient } = await import("./posthog")
      mockFetchResponse({
        result: [
          { action: { id: "$pageview", name: "Pageviews" }, count: 1523, data: [200, 300, 400, 623] },
          { action: { id: "$pageview", name: "Unique Users" }, count: 342, data: [80, 90, 72, 100] },
        ],
      })

      const result = await posthogAnalyticsClient.getMetrics("ws-1", "2026-04-01", "2026-04-07")

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://app.posthog.com/api/projects/12345/insights/trend/")
      expect(init.method).toBe("POST")
      const body = JSON.parse(init.body)
      expect(body.date_from).toBe("2026-04-01")
      expect(body.date_to).toBe("2026-04-07")

      expect(result.metrics).toHaveLength(2)
      expect(result.metrics[0]).toMatchObject({ name: "Pageviews", value: 1523 })
      expect(result.metrics[1]).toMatchObject({ name: "Unique Users", value: 342 })
      expect(result.dateRange).toEqual({ from: "2026-04-01", to: "2026-04-07" })
    })

    it("uses custom host when provided", async () => {
      const { getCredentials } = await import("@/lib/integrations/credentials")
      vi.mocked(getCredentials).mockResolvedValueOnce({
        api_key: "phx_test",
        project_id: "99",
        host: "https://posthog.mycompany.com",
      })

      const { posthogAnalyticsClient } = await import("./posthog")
      mockFetchResponse({ result: [] })

      await posthogAnalyticsClient.getMetrics("ws-1", "2026-04-01", "2026-04-07")
      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe("https://posthog.mycompany.com/api/projects/99/insights/trend/")
    })
  })

  describe("getEvents", () => {
    it("fetches recent events with optional event name filter", async () => {
      const { posthogAnalyticsClient } = await import("./posthog")
      mockFetchResponse({
        results: [
          {
            id: "evt-1",
            event: "$pageview",
            timestamp: "2026-04-06T10:00:00Z",
            distinct_id: "user-123",
            properties: {
              $current_url: "https://myapp.com/dashboard",
              $browser: "Chrome",
              $os: "Mac OS X",
            },
          },
          {
            id: "evt-2",
            event: "$pageview",
            timestamp: "2026-04-06T09:55:00Z",
            distinct_id: "user-456",
            properties: { $current_url: "https://myapp.com/login" },
          },
        ],
      })

      const result = await posthogAnalyticsClient.getEvents("ws-1", "$pageview", 10)
      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain("event=%24pageview")
      expect(url).toContain("limit=10")
      expect(result).toHaveLength(2)
      expect(result[0].event).toBe("$pageview")
      expect(result[0].distinctId).toBe("user-123")
    })

    it("fetches all events when no name specified", async () => {
      const { posthogAnalyticsClient } = await import("./posthog")
      mockFetchResponse({ results: [] })

      await posthogAnalyticsClient.getEvents("ws-1", undefined, 20)
      const [url] = mockFetch.mock.calls[0]
      expect(url).not.toContain("event=")
      expect(url).toContain("limit=20")
    })
  })
})
```

### 8.6 Commit

```bash
git add -A && git commit -m "feat(integrations): add PostHog analytics integration (read-only)

New analytics capability layer, PostHog client (getMetrics via trends
query, getEvents). Two agent tools: analytics_get_metrics and
analytics_get_events. Read-only, no approval gate needed."
```

---

## Task 9: OAuth2 PKCE Support

### 9.1 Create OAuth Module

**File:** `src/lib/integrations/oauth.ts` (NEW)

```ts
// OAuth2 PKCE flow helpers for integration providers that require OAuth
// instead of simple API key auth.
//
// Flow:
// 1. User clicks "Connect" for an OAuth provider
// 2. Frontend calls GET /api/integrations/oauth/start?provider=xxx
// 3. Server generates PKCE verifier + challenge, stores verifier in session,
//    returns redirect URL to provider's authorize endpoint
// 4. User authorizes in provider's UI
// 5. Provider redirects to /api/integrations/oauth/callback?code=xxx&state=yyy
// 6. Server exchanges code for tokens using the stored PKCE verifier
// 7. Tokens are encrypted and stored in the integrations table
// 8. Automatic token refresh when access_token expires

import { randomBytes, createHash } from "node:crypto"
import { encryptJson, decryptJson } from "./crypto"

export interface OAuthProviderConfig {
  providerKey: string
  authorizeUrl: string
  tokenUrl: string
  clientId: string
  clientSecret?: string    // Some PKCE flows don't need a secret
  scopes: string[]
  extraAuthParams?: Record<string, string>
}

export interface OAuthTokens {
  access_token: string
  refresh_token?: string
  expires_at?: number       // Unix timestamp in seconds
  token_type: string
  scope?: string
}

// ── PKCE Helpers ─────────────────────────────────────────

/**
 * Generate a random code verifier for PKCE (43-128 characters, URL-safe).
 */
export function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9\-._~]/g, "")
    .slice(0, 64)
}

/**
 * Compute the S256 code challenge from a verifier.
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

/**
 * Generate a random state parameter to prevent CSRF.
 */
export function generateState(): string {
  return randomBytes(16).toString("hex")
}

// ── Auth URL ─────────────────────────────────────────────

export interface StartOAuthInput {
  config: OAuthProviderConfig
  redirectUri: string
  workspaceId: string
}

export interface StartOAuthResult {
  authorizationUrl: string
  state: string
  codeVerifier: string     // Must be stored server-side (session/cookie)
}

export function generateAuthUrl(input: StartOAuthInput): StartOAuthResult {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = generateState()

  const params = new URLSearchParams({
    client_id: input.config.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: input.config.scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    ...input.config.extraAuthParams,
  })

  const authorizationUrl = `${input.config.authorizeUrl}?${params.toString()}`

  return {
    authorizationUrl,
    state,
    codeVerifier,
  }
}

// ── Token Exchange ───────────────────────────────────────

export interface ExchangeCodeInput {
  config: OAuthProviderConfig
  code: string
  codeVerifier: string
  redirectUri: string
}

export async function exchangeCode(input: ExchangeCodeInput): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.config.clientId,
    code_verifier: input.codeVerifier,
  })

  if (input.config.clientSecret) {
    body.set("client_secret", input.config.clientSecret)
  }

  const res = await fetch(input.config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  const payload = await res.json()
  if (!res.ok) {
    const msg = (payload as { error_description?: string; error?: string })?.error_description ??
      (payload as { error?: string })?.error ?? `OAuth token exchange failed (${res.status})`
    throw new Error(msg)
  }

  const tokens = payload as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type: string
    scope?: string
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_in
      ? Math.floor(Date.now() / 1000) + tokens.expires_in
      : undefined,
    token_type: tokens.token_type ?? "Bearer",
    scope: tokens.scope,
  }
}

// ── Token Refresh ────────────────────────────────────────

export interface RefreshTokenInput {
  config: OAuthProviderConfig
  refreshToken: string
}

export async function refreshToken(input: RefreshTokenInput): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    client_id: input.config.clientId,
  })

  if (input.config.clientSecret) {
    body.set("client_secret", input.config.clientSecret)
  }

  const res = await fetch(input.config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  const payload = await res.json()
  if (!res.ok) {
    const msg = (payload as { error_description?: string })?.error_description ??
      `OAuth token refresh failed (${res.status})`
    throw new Error(msg)
  }

  const tokens = payload as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type: string
    scope?: string
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? input.refreshToken, // Keep old refresh token if not returned
    expires_at: tokens.expires_in
      ? Math.floor(Date.now() / 1000) + tokens.expires_in
      : undefined,
    token_type: tokens.token_type ?? "Bearer",
    scope: tokens.scope,
  }
}

// ── Token Storage ────────────────────────────────────────

/**
 * Encrypt OAuth tokens for storage in the integrations.config column.
 * Stored as { encrypted_tokens: "<base64>" } alongside any other config.
 */
export function encryptTokens(tokens: OAuthTokens): string {
  return encryptJson(tokens)
}

export function decryptTokens(encrypted: string): OAuthTokens {
  return decryptJson<OAuthTokens>(encrypted)
}

/**
 * Check if an access token is expired (or expires within 5 minutes).
 */
export function isTokenExpired(tokens: OAuthTokens): boolean {
  if (!tokens.expires_at) return false // No expiry info, assume valid
  const bufferSeconds = 5 * 60 // Refresh 5 minutes before expiry
  return Math.floor(Date.now() / 1000) >= tokens.expires_at - bufferSeconds
}

// ── Provider Configs ─────────────────────────────────────
// Centralized OAuth configs for supported providers.

export const OAUTH_CONFIGS: Record<string, Omit<OAuthProviderConfig, "clientId" | "clientSecret"> & {
  clientIdEnv: string
  clientSecretEnv?: string
}> = {
  google_docs: {
    providerKey: "google_docs",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
    ],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
}

/**
 * Build a full OAuthProviderConfig from environment variables.
 * Throws if required env vars are missing.
 */
export function getOAuthConfig(providerKey: string): OAuthProviderConfig {
  const template = OAUTH_CONFIGS[providerKey]
  if (!template) {
    throw new Error(`No OAuth config registered for provider: ${providerKey}`)
  }
  const clientId = process.env[template.clientIdEnv]
  if (!clientId) {
    throw new Error(`Missing env var ${template.clientIdEnv} for OAuth provider ${providerKey}`)
  }
  const clientSecret = template.clientSecretEnv
    ? process.env[template.clientSecretEnv]
    : undefined

  return {
    providerKey: template.providerKey,
    authorizeUrl: template.authorizeUrl,
    tokenUrl: template.tokenUrl,
    scopes: template.scopes,
    clientId,
    clientSecret,
    extraAuthParams: template.extraAuthParams,
  }
}
```

### 9.2 Create OAuth Start Route

**File:** `src/app/api/integrations/oauth/start/route.ts` (NEW)

```ts
// GET /api/integrations/oauth/start?provider=xxx&workspaceId=yyy
//
// Generates PKCE challenge, builds the authorization URL, and returns
// it along with a temporary state cookie so the callback can verify it.

import { cookies } from "next/headers"
import { generateAuthUrl, getOAuthConfig } from "@/lib/integrations/oauth"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const providerKey = url.searchParams.get("provider")
  const workspaceId = url.searchParams.get("workspaceId")

  if (!providerKey || !workspaceId) {
    return Response.json(
      { error: "provider and workspaceId are required" },
      { status: 400 },
    )
  }

  try {
    const config = getOAuthConfig(providerKey)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`
    const redirectUri = `${baseUrl}/api/integrations/oauth/callback`

    const result = generateAuthUrl({
      config,
      redirectUri,
      workspaceId,
    })

    // Store PKCE verifier and context in an encrypted HTTP-only cookie.
    // The cookie survives the redirect to the OAuth provider and back.
    const cookieStore = await cookies()
    const oauthState = JSON.stringify({
      state: result.state,
      codeVerifier: result.codeVerifier,
      providerKey,
      workspaceId,
    })

    cookieStore.set("oauth_state", oauthState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    })

    return Response.json({
      authorizationUrl: result.authorizationUrl,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to start OAuth flow" },
      { status: 400 },
    )
  }
}
```

### 9.3 Create OAuth Callback Route

**File:** `src/app/api/integrations/oauth/callback/route.ts` (NEW)

```ts
// GET /api/integrations/oauth/callback?code=xxx&state=yyy
//
// OAuth redirect handler. Exchanges the code for tokens using the
// stored PKCE verifier, encrypts the tokens, and saves them to the
// integrations table.

import { cookies } from "next/headers"
import { exchangeCode, encryptTokens, getOAuthConfig } from "@/lib/integrations/oauth"
import { saveCredentials } from "@/lib/integrations/credentials"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    const desc = url.searchParams.get("error_description") ?? error
    return new Response(
      renderCallbackHTML("error", `OAuth error: ${desc}`),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  if (!code || !state) {
    return new Response(
      renderCallbackHTML("error", "Missing code or state parameter"),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  // Retrieve and validate the OAuth state cookie
  const cookieStore = await cookies()
  const oauthStateCookie = cookieStore.get("oauth_state")?.value
  if (!oauthStateCookie) {
    return new Response(
      renderCallbackHTML("error", "OAuth session expired. Please try connecting again."),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  let oauthContext: {
    state: string
    codeVerifier: string
    providerKey: string
    workspaceId: string
  }
  try {
    oauthContext = JSON.parse(oauthStateCookie)
  } catch {
    return new Response(
      renderCallbackHTML("error", "Invalid OAuth session."),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  if (oauthContext.state !== state) {
    return new Response(
      renderCallbackHTML("error", "State mismatch. Possible CSRF attack. Please try again."),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }

  try {
    const config = getOAuthConfig(oauthContext.providerKey)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`
    const redirectUri = `${baseUrl}/api/integrations/oauth/callback`

    const tokens = await exchangeCode({
      config,
      code,
      codeVerifier: oauthContext.codeVerifier,
      redirectUri,
    })

    // Store encrypted tokens as credentials
    await saveCredentials({
      workspaceId: oauthContext.workspaceId,
      providerKey: oauthContext.providerKey,
      credentials: {
        oauth_tokens: encryptTokens(tokens),
        auth_type: "oauth",
      },
    })

    // Clean up the cookie
    cookieStore.delete("oauth_state")

    return new Response(
      renderCallbackHTML("success", `${oauthContext.providerKey} connected successfully!`),
      { headers: { "Content-Type": "text/html" } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange failed"
    return new Response(
      renderCallbackHTML("error", msg),
      { status: 400, headers: { "Content-Type": "text/html" } },
    )
  }
}

/**
 * Render a simple HTML page that communicates the result back to the
 * opener window. The integration picker UI listens for the postMessage.
 */
function renderCallbackHTML(status: "success" | "error", message: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Integration Connected</title></head>
<body>
  <h2>${status === "success" ? "Connected!" : "Connection Failed"}</h2>
  <p>${message}</p>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: "oauth_callback",
        status: "${status}",
        message: ${JSON.stringify(message)},
      }, window.location.origin);
      setTimeout(() => window.close(), 2000);
    }
  </script>
</body>
</html>`
}
```

### 9.4 Create Token Refresh Helper

**File:** `src/lib/integrations/oauth-client-wrapper.ts` (NEW)

```ts
// Automatic token refresh wrapper for OAuth-authenticated clients.
//
// Wraps any API call so that if the token is expired (or about to expire),
// it refreshes first, saves the new tokens, then retries the call.
// Clients that use OAuth import this helper instead of managing tokens themselves.

import { getCredentials, saveCredentials } from "@/lib/integrations/credentials"
import {
  decryptTokens,
  encryptTokens,
  isTokenExpired,
  refreshToken as doRefresh,
  getOAuthConfig,
  type OAuthTokens,
} from "@/lib/integrations/oauth"

export interface OAuthCredentialResult {
  accessToken: string
  tokens: OAuthTokens
}

/**
 * Get a valid access token for an OAuth provider, refreshing if needed.
 * Returns the access token string ready to use in Authorization headers.
 */
export async function getOAuthAccessToken(
  workspaceId: string,
  providerKey: string,
): Promise<string> {
  const creds = await getCredentials(workspaceId, providerKey)
  if (!creds?.oauth_tokens) {
    throw new Error(
      `${providerKey} is not connected via OAuth for this workspace. Connect it first.`,
    )
  }

  let tokens = decryptTokens(creds.oauth_tokens)

  if (isTokenExpired(tokens)) {
    if (!tokens.refresh_token) {
      throw new Error(
        `${providerKey} access token expired and no refresh token available. Please reconnect.`,
      )
    }

    const config = getOAuthConfig(providerKey)
    tokens = await doRefresh({
      config,
      refreshToken: tokens.refresh_token,
    })

    // Save the refreshed tokens
    await saveCredentials({
      workspaceId,
      providerKey,
      credentials: {
        oauth_tokens: encryptTokens(tokens),
        auth_type: "oauth",
      },
    })
  }

  return tokens.access_token
}
```

### 9.5 Write OAuth Tests

**File:** `src/lib/integrations/oauth.test.ts` (NEW)

```ts
// Tests for OAuth2 PKCE helpers.

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  generateAuthUrl,
  exchangeCode,
  refreshToken,
  isTokenExpired,
  encryptTokens,
  decryptTokens,
} from "./oauth"

// Set required env var for crypto
process.env.INTEGRATION_ENCRYPTION_KEY = "a".repeat(64)

const mockFetch = vi.fn()
global.fetch = mockFetch

describe("OAuth2 PKCE", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("generateCodeVerifier", () => {
    it("returns a URL-safe string of correct length", () => {
      const verifier = generateCodeVerifier()
      expect(verifier.length).toBeGreaterThanOrEqual(32)
      expect(verifier.length).toBeLessThanOrEqual(128)
      expect(/^[a-zA-Z0-9\-._~]+$/.test(verifier)).toBe(true)
    })

    it("generates unique values", () => {
      const v1 = generateCodeVerifier()
      const v2 = generateCodeVerifier()
      expect(v1).not.toBe(v2)
    })
  })

  describe("generateCodeChallenge", () => {
    it("returns a base64url-encoded SHA256 hash", () => {
      const verifier = "test-verifier-string"
      const challenge = generateCodeChallenge(verifier)
      expect(challenge).toBeTruthy()
      expect(challenge).not.toBe(verifier)
      // Same input should produce same output
      expect(generateCodeChallenge(verifier)).toBe(challenge)
    })
  })

  describe("generateState", () => {
    it("returns a 32-character hex string", () => {
      const state = generateState()
      expect(state).toHaveLength(32)
      expect(/^[a-f0-9]+$/.test(state)).toBe(true)
    })
  })

  describe("generateAuthUrl", () => {
    it("builds a correct authorization URL with PKCE params", () => {
      const result = generateAuthUrl({
        config: {
          providerKey: "test_provider",
          authorizeUrl: "https://auth.example.com/authorize",
          tokenUrl: "https://auth.example.com/token",
          clientId: "client-123",
          scopes: ["read", "write"],
        },
        redirectUri: "https://myapp.com/api/integrations/oauth/callback",
        workspaceId: "ws-1",
      })

      expect(result.authorizationUrl).toContain("https://auth.example.com/authorize?")
      expect(result.authorizationUrl).toContain("client_id=client-123")
      expect(result.authorizationUrl).toContain("response_type=code")
      expect(result.authorizationUrl).toContain("scope=read+write")
      expect(result.authorizationUrl).toContain("code_challenge_method=S256")
      expect(result.authorizationUrl).toContain("code_challenge=")
      expect(result.authorizationUrl).toContain("state=")
      expect(result.state).toHaveLength(32)
      expect(result.codeVerifier).toBeTruthy()
    })
  })

  describe("exchangeCode", () => {
    it("sends POST to token URL with PKCE verifier", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: "at-123",
          refresh_token: "rt-456",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "read write",
        }),
      })

      const result = await exchangeCode({
        config: {
          providerKey: "test",
          authorizeUrl: "https://auth.example.com/authorize",
          tokenUrl: "https://auth.example.com/token",
          clientId: "client-123",
          scopes: [],
        },
        code: "auth-code-xxx",
        codeVerifier: "verifier-yyy",
        redirectUri: "https://myapp.com/callback",
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://auth.example.com/token")
      expect(init.method).toBe("POST")
      expect(init.body).toContain("code=auth-code-xxx")
      expect(init.body).toContain("code_verifier=verifier-yyy")

      expect(result.access_token).toBe("at-123")
      expect(result.refresh_token).toBe("rt-456")
      expect(result.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it("throws on token exchange failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "invalid_grant", error_description: "Code expired" }),
      })

      await expect(
        exchangeCode({
          config: {
            providerKey: "test",
            authorizeUrl: "https://a.com/auth",
            tokenUrl: "https://a.com/token",
            clientId: "c",
            scopes: [],
          },
          code: "bad-code",
          codeVerifier: "v",
          redirectUri: "https://r.com",
        }),
      ).rejects.toThrow("Code expired")
    })
  })

  describe("refreshToken", () => {
    it("exchanges refresh token for new access token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: "new-at-789",
          refresh_token: "new-rt-012",
          expires_in: 7200,
          token_type: "Bearer",
        }),
      })

      const result = await refreshToken({
        config: {
          providerKey: "test",
          authorizeUrl: "https://a.com/auth",
          tokenUrl: "https://a.com/token",
          clientId: "c",
          scopes: [],
        },
        refreshToken: "old-rt-456",
      })

      expect(result.access_token).toBe("new-at-789")
      expect(result.refresh_token).toBe("new-rt-012")
    })

    it("keeps old refresh token if not returned", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: "new-at",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      })

      const result = await refreshToken({
        config: {
          providerKey: "test",
          authorizeUrl: "https://a.com/auth",
          tokenUrl: "https://a.com/token",
          clientId: "c",
          scopes: [],
        },
        refreshToken: "keep-this-rt",
      })

      expect(result.refresh_token).toBe("keep-this-rt")
    })
  })

  describe("isTokenExpired", () => {
    it("returns false when no expiry info", () => {
      expect(isTokenExpired({ access_token: "at", token_type: "Bearer" })).toBe(false)
    })

    it("returns false when token is fresh", () => {
      expect(isTokenExpired({
        access_token: "at",
        token_type: "Bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      })).toBe(false)
    })

    it("returns true when token expires within 5 minutes", () => {
      expect(isTokenExpired({
        access_token: "at",
        token_type: "Bearer",
        expires_at: Math.floor(Date.now() / 1000) + 60,
      })).toBe(true)
    })

    it("returns true when token is expired", () => {
      expect(isTokenExpired({
        access_token: "at",
        token_type: "Bearer",
        expires_at: Math.floor(Date.now() / 1000) - 60,
      })).toBe(true)
    })
  })

  describe("encryptTokens / decryptTokens", () => {
    it("round-trips tokens through encryption", () => {
      const tokens = {
        access_token: "at-123",
        refresh_token: "rt-456",
        expires_at: 1744454400,
        token_type: "Bearer" as const,
        scope: "read write",
      }
      const encrypted = encryptTokens(tokens)
      expect(typeof encrypted).toBe("string")
      expect(encrypted).not.toContain("at-123") // Should be encrypted

      const decrypted = decryptTokens(encrypted)
      expect(decrypted).toEqual(tokens)
    })
  })
})
```

### 9.6 Commit

```bash
git add -A && git commit -m "feat(integrations): add OAuth2 PKCE support for provider authentication

OAuth module with PKCE flow (verifier, challenge, state), start/callback
API routes, automatic token refresh wrapper, encrypted token storage.
Google Docs config pre-registered. Tests cover full PKCE lifecycle."
```

---

## Task 10: Google Docs Integration (OAuth)

### 10.1 Add Google Docs to Registry

**File:** `src/lib/integrations/registry.ts`

Add to `PROVIDERS` array:

```ts
  {
    key: "google_docs",
    name: "Google Docs",
    category: "content",
    authType: "oauth",
    fields: [],   // OAuth providers have no manual credential fields
    docsUrl: "https://developers.google.com/docs/api/reference/rest",
  },
```

Add to `aliases`:

```ts
    googledocs: "google_docs",
    gdocs: "google_docs",
```

### 10.2 Create Google Docs Client

**File:** `src/lib/integrations/clients/google-docs.ts` (NEW)

```ts
// Google Docs client (OAuth-authenticated).
//
// Uses Google Docs API v1 and Drive API v3 for document operations.
// Authentication is via OAuth2 tokens managed by the oauth-client-wrapper.
//
// Docs: https://developers.google.com/docs/api/reference/rest

import { getOAuthAccessToken } from "@/lib/integrations/oauth-client-wrapper"
import type {
  DocsClient,
  DocsCreatePageInput,
  DocsUpdatePageInput,
  DocsPage,
  DocsPageDetail,
  DocsSearchResult,
} from "@/lib/integrations/capabilities/docs"

const DOCS_API = "https://docs.googleapis.com/v1"
const DRIVE_API = "https://www.googleapis.com/drive/v3"

async function callGoogle<T>(
  accessToken: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
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
      (payload as { error?: { message?: string } })?.error?.message ??
      `Google API HTTP ${res.status}`
    throw new Error(`Google API error: ${msg}`)
  }
  return payload as T
}

// ── Document operations ──────────────────────────────────

async function createPage(
  workspaceId: string,
  input: DocsCreatePageInput,
): Promise<DocsPage> {
  const token = await getOAuthAccessToken(workspaceId, "google_docs")

  // Create document
  const doc = await callGoogle<{
    documentId: string
    title: string
    revisionId?: string
  }>(
    token,
    `${DOCS_API}/documents`,
    {
      method: "POST",
      body: JSON.stringify({ title: input.title }),
    },
  )

  // Insert content as plain text.
  // Google Docs API uses batchUpdate with InsertTextRequest.
  if (input.content) {
    await callGoogle(
      token,
      `${DOCS_API}/documents/${doc.documentId}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 }, // After the initial newline
                text: input.content,
              },
            },
          ],
        }),
      },
    )
  }

  // Move to parent folder if specified
  if (input.parentId) {
    await callGoogle(
      token,
      `${DRIVE_API}/files/${doc.documentId}?addParents=${encodeURIComponent(input.parentId)}&fields=id`,
      { method: "PATCH" },
    )
  }

  return {
    id: doc.documentId,
    title: doc.title,
    url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

async function updatePage(
  workspaceId: string,
  pageId: string,
  input: DocsUpdatePageInput,
): Promise<DocsPage> {
  const token = await getOAuthAccessToken(workspaceId, "google_docs")

  const requests: unknown[] = []

  if (input.title) {
    // Rename via Drive API
    await callGoogle(
      token,
      `${DRIVE_API}/files/${encodeURIComponent(pageId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: input.title }),
      },
    )
  }

  if (input.content) {
    // Get current document to find content range
    const doc = await callGoogle<{
      body: {
        content: { endIndex: number }[]
      }
    }>(token, `${DOCS_API}/documents/${encodeURIComponent(pageId)}`)

    // Find the end of content (last element's endIndex - 1 to preserve trailing newline)
    const lastElement = doc.body?.content?.[doc.body.content.length - 1]
    const endIndex = lastElement?.endIndex ?? 2

    // Delete existing content (leave first character which is the required newline)
    if (endIndex > 2) {
      requests.push({
        deleteContentRange: {
          range: { startIndex: 1, endIndex: endIndex - 1 },
        },
      })
    }

    // Insert new content
    requests.push({
      insertText: {
        location: { index: 1 },
        text: input.content,
      },
    })

    if (requests.length > 0) {
      await callGoogle(
        token,
        `${DOCS_API}/documents/${encodeURIComponent(pageId)}:batchUpdate`,
        {
          method: "POST",
          body: JSON.stringify({ requests }),
        },
      )
    }
  }

  // Fetch updated doc metadata
  const file = await callGoogle<{
    id: string
    name: string
    modifiedTime: string
    createdTime: string
  }>(
    token,
    `${DRIVE_API}/files/${encodeURIComponent(pageId)}?fields=id,name,modifiedTime,createdTime`,
  )

  return {
    id: file.id,
    title: file.name,
    url: `https://docs.google.com/document/d/${file.id}/edit`,
    createdAt: file.createdTime ?? null,
    updatedAt: file.modifiedTime ?? null,
  }
}

async function getPage(
  workspaceId: string,
  pageId: string,
): Promise<DocsPageDetail> {
  const token = await getOAuthAccessToken(workspaceId, "google_docs")

  const doc = await callGoogle<{
    documentId: string
    title: string
    body: {
      content: {
        paragraph?: {
          elements: { textRun?: { content: string } }[]
        }
      }[]
    }
  }>(token, `${DOCS_API}/documents/${encodeURIComponent(pageId)}`)

  const file = await callGoogle<{
    createdTime: string
    modifiedTime: string
  }>(
    token,
    `${DRIVE_API}/files/${encodeURIComponent(pageId)}?fields=createdTime,modifiedTime`,
  )

  // Extract plain text from document body
  const textParts: string[] = []
  for (const element of doc.body?.content ?? []) {
    if (element.paragraph) {
      for (const el of element.paragraph.elements) {
        if (el.textRun?.content) {
          textParts.push(el.textRun.content)
        }
      }
    }
  }

  return {
    id: doc.documentId,
    title: doc.title,
    url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
    createdAt: file.createdTime ?? null,
    updatedAt: file.modifiedTime ?? null,
    content: textParts.join(""),
  }
}

async function search(
  workspaceId: string,
  query: string,
  limit: number,
): Promise<DocsSearchResult[]> {
  const token = await getOAuthAccessToken(workspaceId, "google_docs")
  const clamped = Math.min(Math.max(limit, 1), 50)

  const data = await callGoogle<{
    files: {
      id: string
      name: string
      modifiedTime?: string
    }[]
  }>(
    token,
    `${DRIVE_API}/files?q=${encodeURIComponent(`name contains '${query}' and mimeType='application/vnd.google-apps.document'`)}&pageSize=${clamped}&fields=files(id,name,modifiedTime)`,
  )

  return (data.files ?? []).map((f) => ({
    id: f.id,
    title: f.name,
    url: `https://docs.google.com/document/d/${f.id}/edit`,
    snippet: null,
  }))
}

export const googleDocsClient: DocsClient = {
  providerKey: "google_docs",
  createPage,
  updatePage,
  getPage,
  search,
}
```

### 10.3 Update Docs Capability Router

**File:** `src/lib/integrations/capabilities/docs.ts`

Update `getDocsClient`:

```ts
    case "google_docs":
      return (await import("@/lib/integrations/clients/google-docs")).googleDocsClient
```

### 10.4 Write Google Docs Tests

**File:** `src/lib/integrations/clients/google-docs.test.ts` (NEW)

```ts
// Tests for Google Docs client.

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the OAuth wrapper
vi.mock("@/lib/integrations/oauth-client-wrapper", () => ({
  getOAuthAccessToken: vi.fn().mockResolvedValue("mock-google-access-token"),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(data),
  })
}

describe("Google Docs Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("createPage", () => {
    it("creates a document and inserts content", async () => {
      const { googleDocsClient } = await import("./google-docs")

      // Create doc response
      mockFetchResponse({
        documentId: "doc-123",
        title: "Strategy Brief",
      })
      // Insert text response
      mockFetchResponse({ replies: [] })

      const result = await googleDocsClient.createPage("ws-1", {
        title: "Strategy Brief",
        content: "This is the strategy brief content.",
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Verify create call
      const [createUrl, createInit] = mockFetch.mock.calls[0]
      expect(createUrl).toContain("/documents")
      expect(JSON.parse(createInit.body).title).toBe("Strategy Brief")

      // Verify batchUpdate call
      const [updateUrl, updateInit] = mockFetch.mock.calls[1]
      expect(updateUrl).toContain("/documents/doc-123:batchUpdate")
      const requests = JSON.parse(updateInit.body).requests
      expect(requests[0].insertText.text).toBe("This is the strategy brief content.")

      expect(result.id).toBe("doc-123")
      expect(result.url).toContain("docs.google.com/document/d/doc-123")
    })
  })

  describe("search", () => {
    it("queries Drive API for documents matching query", async () => {
      const { googleDocsClient } = await import("./google-docs")
      mockFetchResponse({
        files: [
          { id: "doc-1", name: "Q3 Strategy" },
          { id: "doc-2", name: "Strategy Review" },
        ],
      })

      const result = await googleDocsClient.search("ws-1", "strategy", 10)
      expect(result).toHaveLength(2)
      expect(result[0].title).toBe("Q3 Strategy")

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain("name+contains")
      expect(url).toContain("mimeType")
    })
  })

  describe("getPage", () => {
    it("fetches document content and metadata", async () => {
      const { googleDocsClient } = await import("./google-docs")
      // Doc content
      mockFetchResponse({
        documentId: "doc-1",
        title: "My Doc",
        body: {
          content: [
            {
              paragraph: {
                elements: [{ textRun: { content: "Hello world\n" } }],
              },
            },
            {
              paragraph: {
                elements: [{ textRun: { content: "Second paragraph\n" } }],
              },
            },
          ],
        },
      })
      // File metadata
      mockFetchResponse({
        createdTime: "2026-04-10T10:00:00Z",
        modifiedTime: "2026-04-11T10:00:00Z",
      })

      const result = await googleDocsClient.getPage("ws-1", "doc-1")
      expect(result.title).toBe("My Doc")
      expect(result.content).toContain("Hello world")
      expect(result.content).toContain("Second paragraph")
    })
  })
})
```

### 10.5 Commit

```bash
git add -A && git commit -m "feat(integrations): add Google Docs integration via OAuth

Google Docs client using Docs API v1 + Drive API v3, OAuth-authenticated
via the PKCE flow. Supports create, update, get, and search operations.
Wired into the docs capability alongside Notion."
```

---

## Task 11: Integration Health Monitoring

### 11.1 Create Health Check API Route

**File:** `src/app/api/integrations/health/route.ts` (NEW)

```ts
// GET /api/integrations/health?workspaceId=XXX
//
// Tests each connected integration's credentials by making a lightweight
// API call. Returns status per provider. Used by the health monitoring
// component and daily cron job.

import { listIntegrations, getCredentials } from "@/lib/integrations/credentials"
import { db } from "@/lib/db"
import { integrations } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

interface HealthCheckResult {
  providerKey: string
  name: string
  status: "healthy" | "unhealthy" | "unknown"
  latencyMs: number | null
  error: string | null
  checkedAt: string
}

/**
 * Lightweight health check for each provider. Makes the cheapest possible
 * API call to verify credentials still work.
 */
async function checkProvider(
  workspaceId: string,
  providerKey: string,
): Promise<{ healthy: boolean; error: string | null; latencyMs: number }> {
  const start = Date.now()
  try {
    const creds = await getCredentials(workspaceId, providerKey)
    if (!creds) {
      return { healthy: false, error: "No credentials found", latencyMs: Date.now() - start }
    }

    switch (providerKey) {
      case "gohighlevel": {
        const res = await fetch("https://services.leadconnectorhq.com/contacts/?limit=1&locationId=" + encodeURIComponent(creds.location_id ?? ""), {
          headers: { "Authorization": `Bearer ${creds.api_key}`, "Version": "2021-07-28" },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        break
      }
      case "hubspot": {
        const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
          headers: { "Authorization": `Bearer ${creds.api_key}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        break
      }
      case "stripe": {
        const res = await fetch("https://api.stripe.com/v1/balance", {
          headers: { "Authorization": `Bearer ${creds.secret_key}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        break
      }
      case "linear": {
        const res = await fetch("https://api.linear.app/graphql", {
          method: "POST",
          headers: { "Authorization": creds.api_key ?? "", "Content-Type": "application/json" },
          body: JSON.stringify({ query: "{ viewer { id } }" }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        break
      }
      case "resend": {
        const res = await fetch("https://api.resend.com/api-keys", {
          headers: { "Authorization": `Bearer ${creds.api_key}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        break
      }
      case "calcom": {
        const res = await fetch("https://api.cal.com/v2/me", {
          headers: { "Authorization": `Bearer ${creds.api_key}`, "cal-api-version": "2024-08-13" },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        break
      }
      case "posthog": {
        const host = creds.host || "https://app.posthog.com"
        const res = await fetch(`${host}/api/projects/${creds.project_id}/`, {
          headers: { "Authorization": `Bearer ${creds.api_key}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        break
      }
      case "notion": {
        const res = await fetch("https://api.notion.com/v1/users/me", {
          headers: { "Authorization": `Bearer ${creds.api_key}`, "Notion-Version": "2022-06-28" },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        break
      }
      case "buffer": {
        const res = await fetch(`https://api.bufferapp.com/1/user.json?access_token=${creds.access_token}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        break
      }
      default:
        return { healthy: true, error: null, latencyMs: Date.now() - start } // No check available
    }

    return { healthy: true, error: null, latencyMs: Date.now() - start }
  } catch (err) {
    return {
      healthy: false,
      error: err instanceof Error ? err.message : "Unknown error",
      latencyMs: Date.now() - start,
    }
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId")

  if (!workspaceId) {
    return Response.json({ error: "workspaceId required" }, { status: 400 })
  }

  const connected = await listIntegrations(workspaceId)
  const results: HealthCheckResult[] = []

  for (const integration of connected) {
    if (integration.status !== "connected") continue

    const check = await checkProvider(workspaceId, integration.providerKey)
    results.push({
      providerKey: integration.providerKey,
      name: integration.name,
      status: check.healthy ? "healthy" : "unhealthy",
      latencyMs: check.latencyMs,
      error: check.error,
      checkedAt: new Date().toISOString(),
    })

    // If unhealthy, update the integration status to "error"
    if (!check.healthy) {
      await db
        .update(integrations)
        .set({ status: "error", updatedAt: new Date() })
        .where(
          and(
            eq(integrations.workspaceId, workspaceId),
            eq(integrations.providerKey, integration.providerKey),
          ),
        )
    }
  }

  return Response.json({
    workspaceId,
    checkedAt: new Date().toISOString(),
    results,
    healthy: results.every((r) => r.status === "healthy"),
    unhealthyCount: results.filter((r) => r.status === "unhealthy").length,
  })
}
```

### 11.2 Create Integration Health Component

**File:** `src/components/integration-health.tsx` (NEW)

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"

interface HealthResult {
  providerKey: string
  name: string
  status: "healthy" | "unhealthy" | "unknown"
  latencyMs: number | null
  error: string | null
  checkedAt: string
}

interface HealthResponse {
  results: HealthResult[]
  healthy: boolean
  unhealthyCount: number
  checkedAt: string
}

export function IntegrationHealth({ workspaceId }: { workspaceId: string }) {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/integrations/health?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error("Failed to check health")
      const data = await res.json()
      setHealth(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed")
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  if (loading && !health) {
    return <div className="text-sm text-muted-foreground">Checking integrations...</div>
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>
  }

  if (!health || health.results.length === 0) {
    return <div className="text-sm text-muted-foreground">No integrations connected.</div>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Integration Health</h3>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>

      <div className="space-y-1">
        {health.results.map((result) => (
          <div
            key={result.providerKey}
            className="flex items-center justify-between rounded px-3 py-2 text-sm bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  result.status === "healthy"
                    ? "bg-green-500"
                    : result.status === "unhealthy"
                    ? "bg-red-500"
                    : "bg-yellow-500"
                }`}
              />
              <span>{result.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {result.latencyMs !== null && (
                <span>{result.latencyMs}ms</span>
              )}
              {result.error && (
                <span className="text-red-400" title={result.error}>
                  Error
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {health.unhealthyCount > 0 && (
        <p className="text-xs text-red-400">
          {health.unhealthyCount} integration{health.unhealthyCount > 1 ? "s" : ""} need attention.
          Check credentials in Settings.
        </p>
      )}
    </div>
  )
}
```

### 11.3 Create Health Cron Endpoint

**File:** `src/app/api/cron/integration-health/route.ts` (NEW)

```ts
// POST /api/cron/integration-health
//
// Daily cron job that checks the health of all connected integrations
// across all workspaces. Marks unhealthy integrations with "error" status.
// Protected by CRON_SECRET.

import { db } from "@/lib/db"
import { integrations, workspaces } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch all workspaces
  const allWorkspaces = await db.select({ id: workspaces.id }).from(workspaces)

  let checked = 0
  let unhealthy = 0

  for (const workspace of allWorkspaces) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      const res = await fetch(
        `${baseUrl}/api/integrations/health?workspaceId=${workspace.id}`,
        {
          headers: { "Authorization": `Bearer ${cronSecret}` },
        },
      )
      if (res.ok) {
        const data = await res.json()
        checked += data.results?.length ?? 0
        unhealthy += data.unhealthyCount ?? 0
      }
    } catch {
      // Individual workspace failure shouldn't stop the cron
    }
  }

  return Response.json({
    ok: true,
    workspacesChecked: allWorkspaces.length,
    integrationsChecked: checked,
    unhealthyCount: unhealthy,
    checkedAt: new Date().toISOString(),
  })
}
```

### 11.4 Commit

```bash
git add -A && git commit -m "feat(integrations): add health monitoring for connected integrations

Health check API that tests each provider's credentials with lightweight
API calls. IntegrationHealth UI component with status indicators. Daily
cron endpoint for automated health checks across all workspaces."
```

---

## Task 12: Integration Tests (End-to-End Flows)

### 12.1 Email Flow Integration Test

**File:** `src/lib/integrations/__tests__/email-flow.test.ts` (NEW)

```ts
// Integration test: Full email flow
// Connect Resend -> Agent drafts email -> Approval created -> Approve -> Email sent

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock DB
const mockDbInsert = vi.fn()
const mockDbSelect = vi.fn()
const mockDbUpdate = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({ values: (v: unknown) => ({ returning: () => mockDbInsert(v) }) }),
    select: () => ({ from: () => ({ where: () => ({ limit: () => mockDbSelect() }) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => mockDbUpdate() }) }) }),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  agents: {},
  approvalRequests: {},
  integrations: {},
}))

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({ api_key: "re_test_key" }),
  listIntegrations: vi.fn().mockResolvedValue([
    { providerKey: "resend", status: "connected", name: "Resend", category: "email" },
  ]),
  saveCredentials: vi.fn(),
}))

const mockResendSend = vi.fn()
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockResendSend },
  })),
}))

describe("Email Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbInsert.mockResolvedValue([{ id: "approval-1" }])
    mockDbSelect.mockResolvedValue([{ id: "agent-1", name: "Scout" }])
  })

  it("full flow: agent drafts -> approval created -> approved -> sent via Resend", async () => {
    // Step 1: Build tools (simulating what the agent runtime does)
    const { getEmailClient } = await import("@/lib/integrations/capabilities/email")
    const emailClient = await getEmailClient("ws-1")
    expect(emailClient).not.toBeNull()
    expect(emailClient!.providerKey).toBe("resend")

    // Step 2: Verify approval request would be created (the tool inserts into DB)
    // The tool itself is tested in tools.ts tests. Here we verify the executor.

    // Step 3: Simulate approval executor running the email_send action
    mockResendSend.mockResolvedValueOnce({
      data: { id: "msg-resend-123" },
      error: null,
    })

    const { executeApprovalAction } = await import("@/lib/approvals/executor")
    const result = await executeApprovalAction({
      type: "email_send",
      workspaceId: "ws-1",
      to: "customer@acme.com",
      subject: "Your proposal is ready",
      body: "Hi Jane, your proposal for Q3 is attached.",
    } as any)

    expect(result.ok).toBe(true)
    expect(result.provider).toBe("resend")
    expect(mockResendSend).toHaveBeenCalledTimes(1)
    expect(mockResendSend.mock.calls[0][0].to).toEqual(["customer@acme.com"])
  })
})
```

### 12.2 CRM Flow Integration Test

**File:** `src/lib/integrations/__tests__/crm-flow.test.ts` (NEW)

```ts
// Integration test: Full CRM pipeline flow
// Create contact -> Update contact -> Create deal -> Move deal stage

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "test-ghl-token",
    location_id: "test-loc",
  }),
  listIntegrations: vi.fn().mockResolvedValue([
    { providerKey: "gohighlevel", status: "connected", name: "GoHighLevel", category: "crm" },
  ]),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  })
}

describe("CRM Pipeline Flow", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("full flow: create contact -> update -> create deal -> move stage", async () => {
    const { getCRMClient } = await import("@/lib/integrations/capabilities/crm")
    const client = await getCRMClient("ws-1")
    expect(client).not.toBeNull()
    expect(client!.providerKey).toBe("gohighlevel")

    // Step 1: Create contact
    mockFetchResponse({
      contact: {
        id: "contact-1",
        email: "prospect@acme.com",
        firstName: "Alice",
        lastName: "Smith",
      },
    })
    const contact = await client!.createContact("ws-1", {
      email: "prospect@acme.com",
      firstName: "Alice",
      lastName: "Smith",
    })
    expect(contact.id).toBe("contact-1")

    // Step 2: Update contact
    mockFetchResponse({
      contact: {
        id: "contact-1",
        email: "prospect@acme.com",
        firstName: "Alice",
        lastName: "Smith-Jones",
        phone: "+15551234567",
      },
    })
    const updated = await client!.updateContact("ws-1", "contact-1", {
      lastName: "Smith-Jones",
      phone: "+15551234567",
    })
    expect(updated.lastName).toBe("Smith-Jones")
    expect(updated.phone).toBe("+15551234567")

    // Step 3: Create deal (with pipeline lookup)
    mockFetchResponse({
      pipelines: [{
        id: "pipeline-1",
        stages: [
          { id: "stage-new", name: "New" },
          { id: "stage-qualified", name: "Qualified" },
          { id: "stage-closed", name: "Closed Won" },
        ],
      }],
    })
    mockFetchResponse({
      opportunity: {
        id: "deal-1",
        name: "$50K Retainer",
        contactId: "contact-1",
        pipelineId: "pipeline-1",
        pipelineStageId: "stage-new",
        monetaryValue: 5000000,
        status: "open",
      },
    })
    const deal = await client!.createDeal("ws-1", {
      title: "$50K Retainer",
      contactId: "contact-1",
      value: 5000000,
    })
    expect(deal.id).toBe("deal-1")
    expect(deal.pipelineId).toBe("pipeline-1")

    // Step 4: Move deal to "Qualified" stage
    mockFetchResponse({
      opportunity: {
        id: "deal-1",
        pipelineStageId: "stage-qualified",
        stageName: "Qualified",
      },
    })
    const movedDeal = await client!.updateDealStage("ws-1", "deal-1", "stage-qualified")
    expect(movedDeal.stageId).toBe("stage-qualified")

    // Verify all API calls were made
    expect(mockFetch).toHaveBeenCalledTimes(5) // create + update + pipelines + create deal + move stage
  })
})
```

### 12.3 OAuth Flow Integration Test

**File:** `src/lib/integrations/__tests__/oauth-flow.test.ts` (NEW)

```ts
// Integration test: Full OAuth PKCE flow
// Generate auth URL -> Exchange code -> Store tokens -> Use token -> Refresh

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  generateAuthUrl,
  exchangeCode,
  refreshToken,
  encryptTokens,
  decryptTokens,
  isTokenExpired,
} from "@/lib/integrations/oauth"

// Required for crypto operations
process.env.INTEGRATION_ENCRYPTION_KEY = "b".repeat(64)

const mockFetch = vi.fn()
global.fetch = mockFetch

describe("OAuth PKCE Full Flow", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("complete lifecycle: authorize -> exchange -> store -> use -> refresh -> use again", async () => {
    const config = {
      providerKey: "google_docs",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      scopes: ["https://www.googleapis.com/auth/documents"],
      extraAuthParams: { access_type: "offline", prompt: "consent" },
    }

    // Step 1: Generate authorization URL
    const authResult = generateAuthUrl({
      config,
      redirectUri: "https://myapp.com/api/integrations/oauth/callback",
      workspaceId: "ws-1",
    })

    expect(authResult.authorizationUrl).toContain("accounts.google.com")
    expect(authResult.authorizationUrl).toContain("client_id=test-client-id")
    expect(authResult.authorizationUrl).toContain("code_challenge_method=S256")
    expect(authResult.authorizationUrl).toContain("access_type=offline")
    expect(authResult.state).toBeTruthy()
    expect(authResult.codeVerifier).toBeTruthy()

    // Step 2: Exchange code for tokens (simulating callback)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: "ya29.initial-token",
        refresh_token: "1//refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/documents",
      }),
    })

    const tokens = await exchangeCode({
      config,
      code: "auth-code-from-google",
      codeVerifier: authResult.codeVerifier,
      redirectUri: "https://myapp.com/api/integrations/oauth/callback",
    })

    expect(tokens.access_token).toBe("ya29.initial-token")
    expect(tokens.refresh_token).toBe("1//refresh-token")
    expect(tokens.expires_at).toBeGreaterThan(Date.now() / 1000)

    // Step 3: Encrypt and store tokens
    const encrypted = encryptTokens(tokens)
    expect(encrypted).toBeTruthy()
    expect(encrypted).not.toContain("ya29")

    // Step 4: Decrypt and use tokens
    const decrypted = decryptTokens(encrypted)
    expect(decrypted.access_token).toBe("ya29.initial-token")
    expect(isTokenExpired(decrypted)).toBe(false)

    // Step 5: Simulate token expiry and refresh
    const expiredTokens = { ...decrypted, expires_at: Math.floor(Date.now() / 1000) - 100 }
    expect(isTokenExpired(expiredTokens)).toBe(true)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: "ya29.refreshed-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    })

    const refreshed = await refreshToken({
      config,
      refreshToken: expiredTokens.refresh_token!,
    })

    expect(refreshed.access_token).toBe("ya29.refreshed-token")
    expect(refreshed.refresh_token).toBe("1//refresh-token") // Kept from original
    expect(isTokenExpired(refreshed)).toBe(false)

    // Step 6: Encrypt refreshed tokens (simulating save back to DB)
    const reEncrypted = encryptTokens(refreshed)
    const reDecrypted = decryptTokens(reEncrypted)
    expect(reDecrypted.access_token).toBe("ya29.refreshed-token")
  })
})
```

### 12.4 Commit

```bash
git add -A && git commit -m "test(integrations): add end-to-end integration tests

Tests for full email flow (draft -> approve -> send via Resend), CRM
pipeline flow (create -> update -> deal -> stage move), and OAuth PKCE
lifecycle (authorize -> exchange -> store -> refresh)."
```

---

## Summary

### New Files Created (25)

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest test runner configuration |
| `src/lib/integrations/capabilities/email.ts` | Email capability interface + router |
| `src/lib/integrations/capabilities/calendar.ts` | Calendar capability interface + router |
| `src/lib/integrations/capabilities/social.ts` | Social media capability interface + router |
| `src/lib/integrations/capabilities/docs.ts` | Documents capability interface + router |
| `src/lib/integrations/capabilities/analytics.ts` | Analytics capability interface + router |
| `src/lib/integrations/clients/hubspot.ts` | HubSpot CRM client (full CRUD) |
| `src/lib/integrations/clients/resend.ts` | Resend email client |
| `src/lib/integrations/clients/sendgrid.ts` | SendGrid email client |
| `src/lib/integrations/clients/calcom.ts` | Cal.com calendar client |
| `src/lib/integrations/clients/asana.ts` | Asana PM client |
| `src/lib/integrations/clients/buffer.ts` | Buffer social media client |
| `src/lib/integrations/clients/notion.ts` | Notion documents client |
| `src/lib/integrations/clients/posthog.ts` | PostHog analytics client |
| `src/lib/integrations/clients/google-docs.ts` | Google Docs client (OAuth) |
| `src/lib/integrations/oauth.ts` | OAuth2 PKCE flow helpers |
| `src/lib/integrations/oauth-client-wrapper.ts` | Automatic token refresh wrapper |
| `src/app/api/integrations/oauth/start/route.ts` | OAuth flow initiation endpoint |
| `src/app/api/integrations/oauth/callback/route.ts` | OAuth redirect handler |
| `src/app/api/integrations/health/route.ts` | Integration health check API |
| `src/app/api/cron/integration-health/route.ts` | Daily health check cron |
| `src/components/integration-health.tsx` | Health status UI component |
| `src/lib/integrations/clients/*.test.ts` | Unit tests (8 files) |
| `src/lib/integrations/__tests__/*.test.ts` | Integration tests (3 files) |
| `src/lib/integrations/oauth.test.ts` | OAuth PKCE tests |

### Files Modified (6)

| File | Changes |
|------|---------|
| `src/lib/integrations/registry.ts` | 7 new providers, updated category type, aliases |
| `src/lib/integrations/capabilities/crm.ts` | Extended CRMClient interface, enabled HubSpot |
| `src/lib/integrations/capabilities/pm.ts` | Extended PMClient interface, enabled Asana |
| `src/lib/integrations/tools.ts` | 20+ new tool factories, 5 new capability imports |
| `src/lib/approvals/executor.ts` | 4 new action types + dispatch branches |
| `package.json` | Vitest + Resend SDK dependencies |

### New Agent Tools (20+)

| Tool | Capability | Approval Gate |
|------|-----------|---------------|
| `crm_update_contact` | CRM | No |
| `crm_create_deal` | CRM | No |
| `crm_update_deal_stage` | CRM | No |
| `crm_list_deals` | CRM | No |
| `crm_add_note` | CRM | No |
| `crm_list_pipeline_stages` | CRM | No |
| `email_send` | Email | YES |
| `calendar_check_availability` | Calendar | No |
| `calendar_list_bookings` | Calendar | No |
| `calendar_book_meeting` | Calendar | YES |
| `pm_update_task` | PM | No |
| `pm_add_comment` | PM | No |
| `pm_list_tasks` | PM | No |
| `pm_get_task` | PM | No |
| `social_create_post` | Social | YES |
| `social_schedule_post` | Social | YES |
| `social_list_scheduled` | Social | No |
| `docs_create_page` | Docs | No |
| `docs_update_page` | Docs | No |
| `docs_search` | Docs | No |
| `analytics_get_metrics` | Analytics | No |
| `analytics_get_events` | Analytics | No |

### Approval-Gated Actions

All customer-facing write actions require approval:
- `email_send` -- email never sends without explicit approval
- `calendar_book_meeting` -- creates real calendar events + invites
- `social_create_post` -- public brand-facing content
- `social_schedule_post` -- scheduled public content
- `messaging_send_message` -- existing, unchanged
