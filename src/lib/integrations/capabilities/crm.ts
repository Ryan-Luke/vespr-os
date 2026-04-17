// CRM capability. Every CRM provider client implements this interface
// so agents can call `crm_create_contact` without caring which CRM the
// user has connected. Per the integrate-don't-rebuild principle, BOS
// never locks the user into one CRM. Whatever they already use, they
// connect. The tool layer dispatches.

import { listIntegrations } from "@/lib/integrations/credentials"

export interface CRMContactInput {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  tags?: string[]
  notes?: string
}

export interface CRMContact {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  createdAt: string | null
  url: string | null   // link into the provider's UI when available
}

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

export interface CRMClient {
  providerKey: string

  // Existing
  createContact(workspaceId: string, input: CRMContactInput): Promise<CRMContact>
  listRecentContacts(workspaceId: string, limit: number): Promise<CRMContact[]>
  findContactByEmail(workspaceId: string, email: string): Promise<CRMContact | null>
  addTags(workspaceId: string, contactId: string, tags: string[]): Promise<{ ok: true; tags: string[] }>

  // Contact updates
  updateContact(workspaceId: string, contactId: string, input: CRMContactUpdateInput): Promise<CRMContact>

  // Deals / Opportunities
  createDeal(workspaceId: string, input: CRMDealInput): Promise<CRMDeal>
  updateDealStage(workspaceId: string, dealId: string, stageId: string): Promise<CRMDeal>
  listDeals(workspaceId: string, limit: number): Promise<CRMDeal[]>

  // Notes
  addNote(workspaceId: string, contactId: string, body: string): Promise<CRMNote>

  // Pipeline structure
  listPipelineStages(workspaceId: string): Promise<CRMPipelineStage[]>
}

/** CRM providers supported by the capability layer. Ordered by Luke's preference. */
const CRM_PROVIDER_KEYS = ["gohighlevel", "hubspot", "pipedrive", "attio"] as const
export type CRMProviderKey = typeof CRM_PROVIDER_KEYS[number]

/**
 * Returns the connected CRM provider key for a workspace, or null if no
 * CRM is connected. If multiple CRMs are connected (edge case), returns
 * the first one in the preference order above.
 */
export async function getConnectedCRMKey(workspaceId: string): Promise<CRMProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of CRM_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

/**
 * Load the provider-specific CRM client for whichever CRM is connected.
 * Returns null if no CRM is connected. Dynamically imports so the capability
 * layer only pulls in the client code it needs.
 */
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
