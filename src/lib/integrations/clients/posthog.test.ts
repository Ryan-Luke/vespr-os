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
