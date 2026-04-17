// src/lib/billing/stripe.ts

import Stripe from "stripe"
import { db } from "@/lib/db"
import { subscriptions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import type { PlanId } from "./plans"

// ── Stripe Client ────────────────────────────────────────────

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it to .env.local.")
  }
  return new Stripe(key, {
    typescript: true,
  })
}

let _stripe: Stripe | null = null
export function stripe(): Stripe {
  if (!_stripe) _stripe = getStripeClient()
  return _stripe
}

// ── Checkout Session ─────────────────────────────────────────

export async function createCheckoutSession(opts: {
  workspaceId: string
  planId: PlanId
  customerEmail: string
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  const s = stripe()

  // Get or create the Stripe customer
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, opts.workspaceId))
    .limit(1)

  let customerId = sub?.stripeCustomerId ?? undefined

  if (!customerId) {
    const customer = await s.customers.create({
      email: opts.customerEmail,
      metadata: { workspaceId: opts.workspaceId },
    })
    customerId = customer.id

    // Upsert subscription row with the new customer ID
    if (sub) {
      await db
        .update(subscriptions)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(subscriptions.workspaceId, opts.workspaceId))
    } else {
      await db.insert(subscriptions).values({
        workspaceId: opts.workspaceId,
        stripeCustomerId: customerId,
        plan: "free",
        status: "active",
      })
    }
  }

  // Determine the price ID
  const priceId =
    opts.planId === "pro"
      ? process.env.STRIPE_PRO_PRICE_ID
      : opts.planId === "team"
        ? process.env.STRIPE_TEAM_PRICE_ID
        : null

  if (!priceId) {
    throw new Error(`No Stripe price ID configured for plan: ${opts.planId}`)
  }

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: {
      workspaceId: opts.workspaceId,
      planId: opts.planId,
    },
    subscription_data: {
      metadata: {
        workspaceId: opts.workspaceId,
        planId: opts.planId,
      },
    },
  })

  return session.url!
}

// ── Customer Portal ──────────────────────────────────────────

export async function createPortalSession(opts: {
  workspaceId: string
  returnUrl: string
}): Promise<string> {
  const s = stripe()

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, opts.workspaceId))
    .limit(1)

  if (!sub?.stripeCustomerId) {
    throw new Error("No Stripe customer found for this workspace")
  }

  const session = await s.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: opts.returnUrl,
  })

  return session.url
}

// ── Webhook Handler ──────────────────────────────────────────

export async function handleStripeWebhook(
  body: string,
  signature: string
): Promise<{ handled: boolean; event?: string; error?: string }> {
  const s = stripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    return { handled: false, error: "STRIPE_WEBHOOK_SECRET not configured" }
  }

  let event: Stripe.Event
  try {
    event = s.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature"
    return { handled: false, error: `Webhook signature verification failed: ${msg}` }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const workspaceId = session.metadata?.workspaceId
      const planId = session.metadata?.planId as PlanId | undefined

      if (workspaceId && planId && session.subscription) {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id

        // Fetch the subscription to get period end
        const stripeSub = await s.subscriptions.retrieve(subscriptionId)

        await db
          .update(subscriptions)
          .set({
            stripeSubscriptionId: subscriptionId,
            plan: planId,
            status: "active",
            currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.workspaceId, workspaceId))
      }
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      const workspaceId = subscription.metadata?.workspaceId

      if (workspaceId) {
        // Map Stripe status to our simplified status
        let status: string = "active"
        if (subscription.status === "past_due") status = "past_due"
        else if (subscription.status === "canceled") status = "canceled"
        else if (subscription.status === "unpaid") status = "unpaid"
        else if (subscription.status === "trialing") status = "trialing"

        // Determine plan from price ID
        const priceId = subscription.items.data[0]?.price.id
        let plan: PlanId = "free"
        if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "pro"
        else if (priceId === process.env.STRIPE_TEAM_PRICE_ID) plan = "team"

        await db
          .update(subscriptions)
          .set({
            plan,
            status,
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.workspaceId, workspaceId))
      }
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      const workspaceId = subscription.metadata?.workspaceId

      if (workspaceId) {
        // Downgrade to free plan
        await db
          .update(subscriptions)
          .set({
            plan: "free",
            status: "canceled",
            stripeSubscriptionId: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.workspaceId, workspaceId))
      }
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const sub = (invoice as any).subscription
      const subscriptionId =
        typeof sub === "string" ? sub : sub?.id

      if (subscriptionId) {
        // Mark as past due -- the UI will show a banner
        await db
          .update(subscriptions)
          .set({
            status: "past_due",
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
      }
      break
    }

    default:
      // Unhandled event type -- that's fine
      return { handled: false, event: event.type }
  }

  return { handled: true, event: event.type }
}
