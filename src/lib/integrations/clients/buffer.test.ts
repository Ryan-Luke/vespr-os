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
