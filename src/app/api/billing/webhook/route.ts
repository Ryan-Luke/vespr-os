// src/app/api/billing/webhook/route.ts

import { handleStripeWebhook } from "@/lib/billing/stripe"

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  const body = await req.text()

  const result = await handleStripeWebhook(body, signature)

  if (result.error) {
    console.error("[Stripe Webhook] Error:", result.error)
    return Response.json({ error: result.error }, { status: 400 })
  }

  if (!result.handled) {
    // Unhandled event type -- return 200 so Stripe doesn't retry
    return Response.json({ received: true, event: result.event, handled: false })
  }

  return Response.json({ received: true, event: result.event, handled: true })
}

// Stripe webhooks must receive the raw body for signature verification.
// Next.js App Router sends raw body by default for route handlers,
// but we need to make sure no middleware parses it first.
export const runtime = "nodejs"
