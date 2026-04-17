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
