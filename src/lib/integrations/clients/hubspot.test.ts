// Tests for HubSpot CRM client.

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "test-hubspot-token",
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

describe("HubSpot CRM Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("createContact", () => {
    it("sends POST with correct properties", async () => {
      const { hubspotClient } = await import("./hubspot")
      mockFetchResponse({
        id: "hs-contact-1",
        properties: {
          email: "jane@acme.com",
          firstname: "Jane",
          lastname: "Doe",
        },
      })

      const result = await hubspotClient.createContact("ws-1", {
        email: "jane@acme.com",
        firstName: "Jane",
        lastName: "Doe",
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts")
      expect(init.method).toBe("POST")
      expect(result.id).toBe("hs-contact-1")
      expect(result.email).toBe("jane@acme.com")
    })
  })

  describe("findContactByEmail", () => {
    it("uses search endpoint with EQ filter", async () => {
      const { hubspotClient } = await import("./hubspot")
      mockFetchResponse({
        results: [{
          id: "hs-contact-1",
          properties: {
            email: "jane@acme.com",
            firstname: "Jane",
            lastname: "Doe",
          },
        }],
      })

      const result = await hubspotClient.findContactByEmail("ws-1", "jane@acme.com")
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/search")
      expect(init.method).toBe("POST")
      const body = JSON.parse(init.body)
      expect(body.filterGroups[0].filters[0]).toMatchObject({
        propertyName: "email",
        operator: "EQ",
        value: "jane@acme.com",
      })
      expect(result?.id).toBe("hs-contact-1")
    })

    it("returns null when no match", async () => {
      const { hubspotClient } = await import("./hubspot")
      mockFetchResponse({ results: [] })

      const result = await hubspotClient.findContactByEmail("ws-1", "nobody@acme.com")
      expect(result).toBeNull()
    })
  })

  describe("createDeal", () => {
    it("creates deal and associates with contact", async () => {
      const { hubspotClient } = await import("./hubspot")
      mockFetchResponse({
        id: "hs-deal-1",
        properties: {
          dealname: "Q3 Retainer",
          amount: "5000.00",
          dealstage: "qualifiedtobuy",
        },
      })
      mockFetchResponse({ status: "complete" })

      const result = await hubspotClient.createDeal("ws-1", {
        title: "Q3 Retainer",
        contactId: "hs-contact-1",
        value: 500000,
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.id).toBe("hs-deal-1")
      expect(result.title).toBe("Q3 Retainer")
      const [assocUrl] = mockFetch.mock.calls[1]
      expect(assocUrl).toContain("/associations/contacts/hs-contact-1")
    })
  })

  describe("listPipelineStages", () => {
    it("returns flattened stages from /crm/v3/pipelines/deals", async () => {
      const { hubspotClient } = await import("./hubspot")
      mockFetchResponse({
        results: [{
          id: "p1",
          label: "Sales Pipeline",
          stages: [
            { id: "appointmentscheduled", label: "Appointment Scheduled", displayOrder: 0 },
            { id: "qualifiedtobuy", label: "Qualified to Buy", displayOrder: 1 },
          ],
        }],
      })

      const result = await hubspotClient.listPipelineStages("ws-1")
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: "appointmentscheduled",
        name: "Appointment Scheduled",
        pipelineName: "Sales Pipeline",
      })
    })
  })
})
