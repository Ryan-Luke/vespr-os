// Tests for Resend email client.

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the Resend SDK
const mockSend = vi.fn()
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = { send: mockSend }
    },
  }
})

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "re_test_123456789",
  }),
}))

describe("Resend Email Client", () => {
  beforeEach(() => {
    mockSend.mockReset()
  })

  describe("sendEmail", () => {
    it("calls Resend SDK with correct params", async () => {
      const { resendEmailClient } = await import("./resend")
      mockSend.mockResolvedValueOnce({
        data: { id: "email-msg-123" },
        error: null,
      })

      const result = await resendEmailClient.sendEmail("ws-1", {
        to: "customer@acme.com",
        subject: "Your invoice is ready",
        body: "Hi, your invoice for $500 is attached.",
      })

      expect(mockSend).toHaveBeenCalledTimes(1)
      const sendArgs = mockSend.mock.calls[0][0]
      expect(sendArgs.to).toEqual(["customer@acme.com"])
      expect(sendArgs.subject).toBe("Your invoice is ready")
      expect(sendArgs.text).toBe("Hi, your invoice for $500 is attached.")
      expect(result.id).toBe("email-msg-123")
      expect(result.status).toBe("sent")
    })

    it("throws on Resend API error", async () => {
      const { resendEmailClient } = await import("./resend")
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Invalid API key" },
      })

      await expect(
        resendEmailClient.sendEmail("ws-1", {
          to: "test@test.com",
          subject: "Test",
          body: "Test body",
        }),
      ).rejects.toThrow("Resend API error: Invalid API key")
    })

    it("passes optional fields (cc, bcc, replyTo, htmlBody)", async () => {
      const { resendEmailClient } = await import("./resend")
      mockSend.mockResolvedValueOnce({
        data: { id: "email-msg-456" },
        error: null,
      })

      await resendEmailClient.sendEmail("ws-1", {
        to: "customer@acme.com",
        subject: "Update",
        body: "Plain text version",
        htmlBody: "<h1>HTML version</h1>",
        replyTo: "boss@acme.com",
        cc: ["cc1@acme.com"],
        bcc: ["bcc1@acme.com"],
      })

      const sendArgs = mockSend.mock.calls[0][0]
      expect(sendArgs.html).toBe("<h1>HTML version</h1>")
      expect(sendArgs.replyTo).toBe("boss@acme.com")
      expect(sendArgs.cc).toEqual(["cc1@acme.com"])
      expect(sendArgs.bcc).toEqual(["bcc1@acme.com"])
    })
  })
})
