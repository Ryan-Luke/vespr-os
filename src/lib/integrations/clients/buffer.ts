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
  _workspaceId: string,
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
