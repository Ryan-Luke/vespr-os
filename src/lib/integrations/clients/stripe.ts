// Stripe API client.
//
// Read-only actions only in this chunk. Writes (create_invoice, charge, etc)
// come in a follow-up because they have real money side effects and need
// a human approval gate per PVD (never fully autonomous on payments).
//
// Docs: https://docs.stripe.com/api

import { getCredentials } from "@/lib/integrations/credentials"

const STRIPE_API = "https://api.stripe.com/v1"

async function callStripe<T>(
  secretKey: string,
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(STRIPE_API + path)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Stripe-Version": "2025-01-27.acacia",
    },
  })
  const payload = await res.json()
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } })?.error?.message ?? `Stripe HTTP ${res.status}`
    throw new Error(`Stripe API error: ${msg}`)
  }
  return payload as T
}

export interface StripeChargeSummary {
  id: string
  amount: number      // in cents
  amountFormatted: string // e.g. "$123.45"
  currency: string
  customerEmail: string | null
  description: string | null
  status: string
  createdAt: string   // ISO
}

interface StripeChargeRaw {
  id: string
  amount: number
  currency: string
  billing_details?: { email?: string | null }
  receipt_email?: string | null
  description?: string | null
  status: string
  created: number
}

function formatCents(cents: number, currency: string): string {
  const major = (cents / 100).toFixed(2)
  const symbol = currency.toLowerCase() === "usd" ? "$" : ""
  return `${symbol}${major} ${currency.toUpperCase()}`.trim()
}

/**
 * List the most recent successful charges. Safe read-only call.
 * Defaults to 10 most recent, max 50.
 */
export async function listRecentStripePayments(
  workspaceId: string,
  limit = 10,
): Promise<StripeChargeSummary[]> {
  const creds = await getCredentials(workspaceId, "stripe")
  if (!creds?.secret_key) {
    throw new Error("Stripe is not connected for this workspace. Connect it via the integration picker first.")
  }

  const clamped = Math.min(Math.max(limit, 1), 50)
  const data = await callStripe<{ data: StripeChargeRaw[] }>(
    creds.secret_key,
    "/charges",
    { limit: clamped },
  )

  return data.data.map((c) => ({
    id: c.id,
    amount: c.amount,
    amountFormatted: formatCents(c.amount, c.currency),
    currency: c.currency,
    customerEmail: c.billing_details?.email ?? c.receipt_email ?? null,
    description: c.description ?? null,
    status: c.status,
    createdAt: new Date(c.created * 1000).toISOString(),
  }))
}

export interface StripeBalanceSummary {
  available: { amount: number; amountFormatted: string; currency: string }[]
  pending: { amount: number; amountFormatted: string; currency: string }[]
}

/**
 * Get the current Stripe account balance (available + pending).
 * Safe read-only call. Useful for monetization phase dashboards.
 */
export async function getStripeBalance(workspaceId: string): Promise<StripeBalanceSummary> {
  const creds = await getCredentials(workspaceId, "stripe")
  if (!creds?.secret_key) {
    throw new Error("Stripe is not connected for this workspace. Connect it via the integration picker first.")
  }
  const data = await callStripe<{
    available: { amount: number; currency: string }[]
    pending: { amount: number; currency: string }[]
  }>(creds.secret_key, "/balance")

  return {
    available: data.available.map((b) => ({
      amount: b.amount,
      amountFormatted: formatCents(b.amount, b.currency),
      currency: b.currency,
    })),
    pending: data.pending.map((b) => ({
      amount: b.amount,
      amountFormatted: formatCents(b.amount, b.currency),
      currency: b.currency,
    })),
  }
}

// ── Payments capability adapter ───────────────────────────
// Exposes Stripe as a drop-in PaymentsClient so agents call
// `payments_list_recent` without caring which processor is connected.

import type { PaymentsClient, PaymentSummary, PaymentsBalance } from "@/lib/integrations/capabilities/payments"

async function paymentsListRecent(workspaceId: string, limit: number): Promise<PaymentSummary[]> {
  const charges = await listRecentStripePayments(workspaceId, limit)
  return charges.map((c) => ({
    id: c.id,
    amount: c.amount,
    amountFormatted: c.amountFormatted,
    currency: c.currency,
    customerEmail: c.customerEmail,
    description: c.description,
    status: c.status,
    createdAt: c.createdAt,
  }))
}

async function paymentsGetBalance(workspaceId: string): Promise<PaymentsBalance> {
  return getStripeBalance(workspaceId)
}

export const stripePaymentsClient: PaymentsClient = {
  providerKey: "stripe",
  listRecentPayments: paymentsListRecent,
  getBalance: paymentsGetBalance,
}
