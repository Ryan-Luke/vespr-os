// Payments capability. Narrower category than CRM (basically Stripe, PayPal,
// Square, maybe GHL Payments) but we still route through a capability so the
// agent tools are consistent with the CRM and PM capabilities.

import { listIntegrations } from "@/lib/integrations/credentials"

export interface PaymentSummary {
  id: string
  amount: number           // in cents or smallest currency unit
  amountFormatted: string  // e.g. "$123.45 USD"
  currency: string
  customerEmail: string | null
  description: string | null
  status: string
  createdAt: string        // ISO
}

export interface BalanceSlot {
  amount: number
  amountFormatted: string
  currency: string
}

export interface PaymentsBalance {
  available: BalanceSlot[]
  pending: BalanceSlot[]
}

export interface PaymentsClient {
  providerKey: string
  listRecentPayments(workspaceId: string, limit: number): Promise<PaymentSummary[]>
  getBalance(workspaceId: string): Promise<PaymentsBalance>
}

const PAYMENTS_PROVIDER_KEYS = ["stripe"] as const
export type PaymentsProviderKey = typeof PAYMENTS_PROVIDER_KEYS[number]

export async function getConnectedPaymentsKey(workspaceId: string): Promise<PaymentsProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of PAYMENTS_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

export async function getPaymentsClient(workspaceId: string): Promise<PaymentsClient | null> {
  const key = await getConnectedPaymentsKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "stripe":
      return (await import("@/lib/integrations/clients/stripe")).stripePaymentsClient
    default:
      return null
  }
}
