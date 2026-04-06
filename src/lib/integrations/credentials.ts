// Server-side helpers for saving and retrieving integration credentials.
// Credentials are always encrypted at rest. Plaintext only exists in
// memory inside these functions and the call site that needs them.

import { db } from "@/lib/db"
import { integrations } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { encryptJson, decryptJson } from "./crypto"
import { getProvider, type IntegrationProvider } from "./registry"

export interface SaveCredentialsInput {
  workspaceId: string
  providerKey: string
  credentials: Record<string, string>
}

export interface StoredIntegration {
  id: string
  providerKey: string
  name: string
  category: string
  status: "connected" | "disconnected" | "error"
  connectedAt: Date | null
}

/**
 * Save or replace credentials for a provider. Credentials are encrypted
 * before writing. Returns the sanitized row (no credentials included).
 */
export async function saveCredentials({
  workspaceId,
  providerKey,
  credentials,
}: SaveCredentialsInput): Promise<StoredIntegration> {
  const provider = getProvider(providerKey)
  if (!provider) {
    throw new Error(`Unknown provider: ${providerKey}`)
  }

  // Validate required fields are present before encrypting
  for (const field of provider.fields) {
    if (field.required && !credentials[field.key]) {
      throw new Error(`Missing required field: ${field.label} (${field.key})`)
    }
  }

  const encrypted = encryptJson(credentials)
  const now = new Date()

  const [existing] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.workspaceId, workspaceId),
        eq(integrations.providerKey, providerKey),
      ),
    )
    .limit(1)

  if (existing) {
    const [row] = await db
      .update(integrations)
      .set({
        config: { encrypted },
        status: "connected",
        connectedAt: now,
        updatedAt: now,
      })
      .where(eq(integrations.id, existing.id))
      .returning()
    return toStoredIntegration(row, provider)
  }

  const [row] = await db
    .insert(integrations)
    .values({
      workspaceId,
      providerKey,
      name: provider.name,
      provider: providerKey, // legacy compat
      category: provider.category,
      status: "connected",
      config: { encrypted },
      connectedAt: now,
    })
    .returning()
  return toStoredIntegration(row, provider)
}

/**
 * Get decrypted credentials for a workspace + provider. Returns null if
 * not connected. ONLY call this from server code that needs to make an
 * outbound API call. Never send the result to the client.
 */
export async function getCredentials(
  workspaceId: string,
  providerKey: string,
): Promise<Record<string, string> | null> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.workspaceId, workspaceId),
        eq(integrations.providerKey, providerKey),
      ),
    )
    .limit(1)

  const encrypted = (row?.config as { encrypted?: string } | null | undefined)?.encrypted
  if (!row || row.status !== "connected" || !encrypted) {
    return null
  }
  try {
    return decryptJson<Record<string, string>>(encrypted)
  } catch {
    return null
  }
}

/** List connected integrations for a workspace. Never includes credentials. */
export async function listIntegrations(workspaceId: string): Promise<StoredIntegration[]> {
  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.workspaceId, workspaceId))

  const out: StoredIntegration[] = []
  for (const row of rows) {
    if (!row.providerKey) continue
    const provider = getProvider(row.providerKey)
    if (!provider) continue
    out.push(toStoredIntegration(row, provider))
  }
  return out
}

/** Disconnect a provider. Deletes the row entirely rather than leaving dead credentials. */
export async function disconnectIntegration(
  workspaceId: string,
  providerKey: string,
): Promise<void> {
  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.workspaceId, workspaceId),
        eq(integrations.providerKey, providerKey),
      ),
    )
}

function toStoredIntegration(
  row: typeof integrations.$inferSelect,
  provider: IntegrationProvider,
): StoredIntegration {
  return {
    id: row.id,
    providerKey: provider.key,
    name: provider.name,
    category: provider.category,
    status: (row.status as StoredIntegration["status"]) ?? "disconnected",
    connectedAt: row.connectedAt ?? null,
  }
}
