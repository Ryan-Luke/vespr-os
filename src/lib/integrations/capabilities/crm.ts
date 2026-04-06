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

export interface CRMClient {
  providerKey: string
  createContact(workspaceId: string, input: CRMContactInput): Promise<CRMContact>
  listRecentContacts(workspaceId: string, limit: number): Promise<CRMContact[]>
  findContactByEmail(workspaceId: string, email: string): Promise<CRMContact | null>
  addTags(workspaceId: string, contactId: string, tags: string[]): Promise<{ ok: true; tags: string[] }>
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
      // Not implemented yet. Client stub will throw with a clear message
      // until someone builds it. Tool factory checks this so the tool only
      // appears when an IMPLEMENTED CRM is connected.
      return null
    case "pipedrive":
      return null
    case "attio":
      return null
    default:
      return null
  }
}
