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
