// SendGrid transactional email client.
//
// Uses the v3 Mail Send API directly via fetch (no SDK dependency).
// Credentials stored encrypted in the integrations table.
//
// Docs: https://docs.sendgrid.com/api-reference/mail-send/mail-send

import { getCredentials } from "@/lib/integrations/credentials"
import type {
  EmailClient,
  EmailSendInput,
  EmailSendResult,
  EmailTemplateInput,
} from "@/lib/integrations/capabilities/email"

const SENDGRID_API = "https://api.sendgrid.com/v3"

interface SendGridCreds {
  apiKey: string
  fromEmail: string
}

async function loadSendGridCreds(workspaceId: string): Promise<SendGridCreds> {
  const creds = await getCredentials(workspaceId, "sendgrid")
  if (!creds?.api_key || !creds?.from_email) {
    throw new Error(
      "SendGrid is not connected for this workspace. Connect it via the integration picker first.",
    )
  }
  return { apiKey: creds.api_key, fromEmail: creds.from_email }
}

async function callSendGrid<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(SENDGRID_API + path, {
    ...init,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers ?? {}),
    },
  })

  // SendGrid returns 202 Accepted for successful sends (no body)
  if (res.status === 202 || res.status === 204) {
    return {} as T
  }

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errors = (payload as { errors?: { message?: string }[] })?.errors
    const msg = errors?.[0]?.message ?? `SendGrid HTTP ${res.status}`
    throw new Error(`SendGrid API error: ${msg}`)
  }
  return payload as T
}

async function sendEmail(
  workspaceId: string,
  input: EmailSendInput,
): Promise<EmailSendResult> {
  const { apiKey, fromEmail } = await loadSendGridCreds(workspaceId)

  const personalizations: Record<string, unknown>[] = [{
    to: [{ email: input.to }],
    ...(input.cc && input.cc.length > 0
      ? { cc: input.cc.map((e) => ({ email: e })) }
      : {}),
    ...(input.bcc && input.bcc.length > 0
      ? { bcc: input.bcc.map((e) => ({ email: e })) }
      : {}),
  }]

  const content: { type: string; value: string }[] = [
    { type: "text/plain", value: input.body },
  ]
  if (input.htmlBody) {
    content.push({ type: "text/html", value: input.htmlBody })
  }

  await callSendGrid(
    apiKey,
    "/mail/send",
    {
      method: "POST",
      body: JSON.stringify({
        personalizations,
        from: { email: fromEmail },
        reply_to: input.replyTo ? { email: input.replyTo } : undefined,
        subject: input.subject,
        content,
      }),
    },
  )

  // SendGrid 202 doesn't return a message ID. We generate a reference.
  return {
    id: `sg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    to: input.to,
    subject: input.subject,
    status: "queued",
  }
}

async function sendTemplateEmail(
  workspaceId: string,
  input: EmailTemplateInput,
): Promise<EmailSendResult> {
  const { apiKey, fromEmail } = await loadSendGridCreds(workspaceId)

  await callSendGrid(
    apiKey,
    "/mail/send",
    {
      method: "POST",
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: input.to }],
          dynamic_template_data: input.templateData,
        }],
        from: { email: fromEmail },
        reply_to: input.replyTo ? { email: input.replyTo } : undefined,
        template_id: input.templateId,
        ...(input.subject ? { subject: input.subject } : {}),
      }),
    },
  )

  return {
    id: `sg-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    to: input.to,
    subject: input.subject ?? "(template subject)",
    status: "queued",
  }
}

export const sendgridEmailClient: EmailClient = {
  providerKey: "sendgrid",
  sendEmail,
  sendTemplateEmail,
}
