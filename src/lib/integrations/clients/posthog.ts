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
