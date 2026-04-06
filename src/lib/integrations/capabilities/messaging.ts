// Messaging capability. Read-only for now. Lets agents inspect conversations
// (SMS, email, IG DM, FB messenger, WhatsApp) without being able to send.
// Write actions are deferred until the approval queue is wired to execute
// actions on approval. Sending to real customers must always be human-gated
// per PVD 'never fully autonomous on customer-facing actions'.

import { listIntegrations } from "@/lib/integrations/credentials"

export type MessagingChannel =
  | "sms"
  | "email"
  | "ig_dm"
  | "fb_messenger"
  | "whatsapp"
  | "web_chat"
  | "other"

export interface MessagingConversation {
  id: string
  contactId: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  lastMessagePreview: string | null
  lastMessageAt: string | null
  unread: boolean
  channel: MessagingChannel
  url: string | null
}

export interface MessagingMessage {
  id: string
  direction: "inbound" | "outbound"
  body: string
  channel: MessagingChannel
  sentAt: string
  sender: string | null
}

export interface SendMessageInput {
  conversationId?: string
  contactId?: string
  channel: MessagingChannel
  body: string
  subject?: string // for email only
}

export interface SendMessageResult {
  messageId: string
  conversationId: string
  status: string
}

export interface MessagingClient {
  providerKey: string
  listRecentConversations(workspaceId: string, limit: number): Promise<MessagingConversation[]>
  listMessagesInConversation(workspaceId: string, conversationId: string, limit: number): Promise<MessagingMessage[]>
  // Optional write action. Gated behind the approval queue.
  sendMessage?(workspaceId: string, input: SendMessageInput): Promise<SendMessageResult>
}

const MESSAGING_PROVIDER_KEYS = ["gohighlevel"] as const
export type MessagingProviderKey = typeof MESSAGING_PROVIDER_KEYS[number]

export async function getConnectedMessagingKey(workspaceId: string): Promise<MessagingProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of MESSAGING_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

export async function getMessagingClient(workspaceId: string): Promise<MessagingClient | null> {
  const key = await getConnectedMessagingKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "gohighlevel":
      return (await import("@/lib/integrations/clients/gohighlevel")).gohighlevelMessagingClient
    default:
      return null
  }
}
