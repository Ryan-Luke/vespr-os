// Tests for SendGrid email client.

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "SG.test-key-12345",
    from_email: "notifications@myapp.com",
  }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe("SendGrid Email Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("sendEmail", () => {
    it("sends POST to /mail/send with correct payload structure", async () => {
      const { sendgridEmailClient } = await import("./sendgrid")
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: () => Promise.resolve({}),
      })

      const result = await sendgridEmailClient.sendEmail("ws-1", {
        to: "customer@acme.com",
        subject: "Invoice Ready",
        body: "Your invoice is ready.",
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://api.sendgrid.com/v3/mail/send")
      expect(init.method).toBe("POST")

      const body = JSON.parse(init.body)
      expect(body.personalizations[0].to).toEqual([{ email: "customer@acme.com" }])
      expect(body.from).toEqual({ email: "notifications@myapp.com" })
      expect(body.subject).toBe("Invoice Ready")
      expect(body.content[0]).toEqual({ type: "text/plain", value: "Your invoice is ready." })

      expect(result.to).toBe("customer@acme.com")
      expect(result.status).toBe("queued")
    })

    it("includes HTML content when provided", async () => {
      const { sendgridEmailClient } = await import("./sendgrid")
      mockFetch.mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({}) })

      await sendgridEmailClient.sendEmail("ws-1", {
        to: "test@test.com",
        subject: "Test",
        body: "Plain text",
        htmlBody: "<h1>HTML</h1>",
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.content).toHaveLength(2)
      expect(body.content[1]).toEqual({ type: "text/html", value: "<h1>HTML</h1>" })
    })

    it("includes cc and bcc when provided", async () => {
      const { sendgridEmailClient } = await import("./sendgrid")
      mockFetch.mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({}) })

      await sendgridEmailClient.sendEmail("ws-1", {
        to: "main@acme.com",
        subject: "Test",
        body: "Body",
        cc: ["cc1@acme.com", "cc2@acme.com"],
        bcc: ["bcc1@acme.com"],
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.personalizations[0].cc).toEqual([{ email: "cc1@acme.com" }, { email: "cc2@acme.com" }])
      expect(body.personalizations[0].bcc).toEqual([{ email: "bcc1@acme.com" }])
    })

    it("throws on SendGrid API error", async () => {
      const { sendgridEmailClient } = await import("./sendgrid")
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ errors: [{ message: "Forbidden" }] }),
      })

      await expect(
        sendgridEmailClient.sendEmail("ws-1", {
          to: "test@test.com",
          subject: "Test",
          body: "Body",
        }),
      ).rejects.toThrow("SendGrid API error: Forbidden")
    })
  })

  describe("sendTemplateEmail", () => {
    it("sends template_id and dynamic_template_data", async () => {
      const { sendgridEmailClient } = await import("./sendgrid")
      mockFetch.mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({}) })

      const result = await sendgridEmailClient.sendTemplateEmail!("ws-1", {
        to: "customer@acme.com",
        templateId: "d-abc123",
        templateData: { name: "Jane", amount: "$500" },
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.template_id).toBe("d-abc123")
      expect(body.personalizations[0].dynamic_template_data).toEqual({
        name: "Jane",
        amount: "$500",
      })
      expect(result.status).toBe("queued")
    })
  })
})
