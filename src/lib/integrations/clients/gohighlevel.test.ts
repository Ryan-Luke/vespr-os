// Tests for GoHighLevel CRM client.
// Mocks fetch to verify correct API URL construction, headers, and body shape.

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock getCredentials before importing the module
vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "test-ghl-token",
    location_id: "test-location-id",
  }),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown, ok = true, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(data),
  })
}

describe("GoHighLevel CRM Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("createContact", () => {
    it("sends POST to /contacts/ with correct body", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")
      mockFetchResponse({
        contact: {
          id: "contact-123",
          email: "jane@acme.com",
          firstName: "Jane",
          lastName: "Doe",
        },
      })

      const result = await gohighlevelClient.createContact("ws-1", {
        email: "jane@acme.com",
        firstName: "Jane",
        lastName: "Doe",
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://services.leadconnectorhq.com/contacts/")
      expect(init.method).toBe("POST")
      expect(JSON.parse(init.body)).toMatchObject({
        locationId: "test-location-id",
        email: "jane@acme.com",
        firstName: "Jane",
        lastName: "Doe",
      })
      expect(result.id).toBe("contact-123")
      expect(result.email).toBe("jane@acme.com")
    })
  })

  describe("updateContact", () => {
    it("sends PUT to /contacts/:id with only changed fields", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")
      mockFetchResponse({
        contact: {
          id: "contact-123",
          email: "jane@acme.com",
          firstName: "Janet",
          lastName: "Doe",
          phone: "+15551234567",
        },
      })

      const result = await gohighlevelClient.updateContact("ws-1", "contact-123", {
        firstName: "Janet",
        phone: "+15551234567",
      })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://services.leadconnectorhq.com/contacts/contact-123")
      expect(init.method).toBe("PUT")
      const body = JSON.parse(init.body)
      expect(body.firstName).toBe("Janet")
      expect(body.phone).toBe("+15551234567")
      expect(body.email).toBeUndefined()
      expect(result.firstName).toBe("Janet")
    })
  })

  describe("createDeal", () => {
    it("fetches default pipeline when none specified, then creates opportunity", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")

      // First call: fetch pipelines
      mockFetchResponse({
        pipelines: [{
          id: "pipeline-1",
          stages: [{ id: "stage-1" }, { id: "stage-2" }],
        }],
      })
      // Second call: create opportunity
      mockFetchResponse({
        opportunity: {
          id: "opp-1",
          name: "New Deal",
          contactId: "contact-123",
          pipelineId: "pipeline-1",
          pipelineStageId: "stage-1",
          monetaryValue: 50000,
          status: "open",
        },
      })

      const result = await gohighlevelClient.createDeal("ws-1", {
        title: "New Deal",
        contactId: "contact-123",
        value: 50000,
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.id).toBe("opp-1")
      expect(result.title).toBe("New Deal")
      expect(result.pipelineId).toBe("pipeline-1")
    })
  })

  describe("updateDealStage", () => {
    it("sends PUT to /opportunities/:id with new stage", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")
      mockFetchResponse({
        opportunity: {
          id: "opp-1",
          pipelineStageId: "stage-2",
          stageName: "Qualified",
        },
      })

      const result = await gohighlevelClient.updateDealStage("ws-1", "opp-1", "stage-2")
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://services.leadconnectorhq.com/opportunities/opp-1")
      expect(init.method).toBe("PUT")
      expect(result.stageId).toBe("stage-2")
    })
  })

  describe("addNote", () => {
    it("sends POST to /contacts/:id/notes", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")
      mockFetchResponse({
        note: {
          id: "note-1",
          contactId: "contact-123",
          body: "Had a great call today",
        },
      })

      const result = await gohighlevelClient.addNote("ws-1", "contact-123", "Had a great call today")
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://services.leadconnectorhq.com/contacts/contact-123/notes")
      expect(init.method).toBe("POST")
      expect(result.body).toBe("Had a great call today")
    })
  })

  describe("listPipelineStages", () => {
    it("flattens multiple pipelines into a single list of stages", async () => {
      const { gohighlevelClient } = await import("./gohighlevel")
      mockFetchResponse({
        pipelines: [
          {
            id: "p1",
            name: "Sales",
            stages: [
              { id: "s1", name: "Lead", position: 0 },
              { id: "s2", name: "Qualified", position: 1 },
            ],
          },
          {
            id: "p2",
            name: "Onboarding",
            stages: [
              { id: "s3", name: "Kickoff", position: 0 },
            ],
          },
        ],
      })

      const result = await gohighlevelClient.listPipelineStages("ws-1")
      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({ id: "s1", name: "Lead", pipelineName: "Sales" })
      expect(result[2]).toMatchObject({ id: "s3", name: "Kickoff", pipelineName: "Onboarding" })
    })
  })
})
