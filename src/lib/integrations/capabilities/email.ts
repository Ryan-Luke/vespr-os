// Email capability. Agents call `email_send` without caring whether the
// user connected Resend, SendGrid, or any other transactional email provider.
//
// IMPORTANT: All email sending is approval-gated. The tool creates an
// approval request with the full email payload. The user approves or
// rejects in the queue. On approval, the executor sends the email.
// Agents NEVER send email directly.

import { listIntegrations } from "@/lib/integrations/credentials"

export interface EmailSendInput {
  to: string           // recipient email address
  subject: string
  body: string         // plain text body
  htmlBody?: string    // optional HTML body (if omitted, plain text is used)
  replyTo?: string
  cc?: string[]
  bcc?: string[]
}

export interface EmailSendResult {
  id: string           // provider message ID
  to: string
  subject: string
  status: string       // "sent", "queued", etc.
}

export interface EmailTemplateInput {
  to: string
  templateId: string
  templateData: Record<string, string>
  subject?: string     // override template subject
  replyTo?: string
}

export interface EmailClient {
  providerKey: string

  /**
   * Send a plain/HTML email. Called ONLY by the approval executor,
   * never directly by a tool.
   */
  sendEmail(workspaceId: string, input: EmailSendInput): Promise<EmailSendResult>

  /**
   * Send a template-based email. Called ONLY by the approval executor.
   * Not all providers support templates. If unsupported, throws.
   */
  sendTemplateEmail?(workspaceId: string, input: EmailTemplateInput): Promise<EmailSendResult>
}

const EMAIL_PROVIDER_KEYS = ["resend", "sendgrid"] as const
export type EmailProviderKey = typeof EMAIL_PROVIDER_KEYS[number]

export async function getConnectedEmailKey(workspaceId: string): Promise<EmailProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of EMAIL_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

export async function getEmailClient(workspaceId: string): Promise<EmailClient | null> {
  const key = await getConnectedEmailKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "resend":
      return (await import("@/lib/integrations/clients/resend")).resendEmailClient
    case "sendgrid":
      return (await import("@/lib/integrations/clients/sendgrid")).sendgridEmailClient
    default:
      return null
  }
}
