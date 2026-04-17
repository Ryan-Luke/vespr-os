// Resend transactional email client.
//
// Uses the official Resend SDK. Credentials stored encrypted in the
// integrations table. Plaintext only lives in memory for the API call.
//
// Docs: https://resend.com/docs/api-reference/emails/send-email

import { Resend } from "resend"
import { getCredentials } from "@/lib/integrations/credentials"
import type {
  EmailClient,
  EmailSendInput,
  EmailSendResult,
  EmailTemplateInput,
} from "@/lib/integrations/capabilities/email"

async function getResendClient(workspaceId: string): Promise<Resend> {
  const creds = await getCredentials(workspaceId, "resend")
  if (!creds?.api_key) {
    throw new Error(
      "Resend is not connected for this workspace. Connect it via the integration picker first.",
    )
  }
  return new Resend(creds.api_key)
}

/**
 * Resolve the "from" address. Resend requires a verified domain.
 * We use the workspace's domain from the API key's associated domain.
 * Falls back to "onboarding@resend.dev" for testing (Resend's sandbox).
 */
function resolveFrom(_workspaceId: string): string {
  // In production, this should pull the verified sending domain from
  // workspace settings. For now, use the Resend sandbox default.
  // TODO: Add workspace.emailFromAddress field in Phase 5
  return "VESPR <notifications@resend.dev>"
}

async function sendEmail(
  workspaceId: string,
  input: EmailSendInput,
): Promise<EmailSendResult> {
  const resend = await getResendClient(workspaceId)

  const { data, error } = await resend.emails.send({
    from: resolveFrom(workspaceId),
    to: [input.to],
    subject: input.subject,
    text: input.body,
    html: input.htmlBody ?? undefined,
    replyTo: input.replyTo ?? undefined,
    cc: input.cc ?? undefined,
    bcc: input.bcc ?? undefined,
  })

  if (error) {
    throw new Error(`Resend API error: ${error.message}`)
  }

  return {
    id: data?.id ?? "unknown",
    to: input.to,
    subject: input.subject,
    status: "sent",
  }
}

async function sendTemplateEmail(
  _workspaceId: string,
  _input: EmailTemplateInput,
): Promise<EmailSendResult> {
  // Resend doesn't have a native template system like SendGrid.
  // We use their batch endpoint with react-email templates, but for
  // simple cases, we just merge the data into the subject/body.
  // TODO: Support react-email template rendering when templates module exists
  throw new Error(
    "Resend template emails are not yet supported. Use email_send with a plain body instead.",
  )
}

export const resendEmailClient: EmailClient = {
  providerKey: "resend",
  sendEmail,
  sendTemplateEmail,
}
