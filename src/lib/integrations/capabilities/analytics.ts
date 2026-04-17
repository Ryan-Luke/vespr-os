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
