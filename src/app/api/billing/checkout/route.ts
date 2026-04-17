// src/app/api/billing/checkout/route.ts

import { cookies } from "next/headers"
import { verifySessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session"
import { createCheckoutSession } from "@/lib/billing/stripe"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import type { PlanId } from "@/lib/billing/plans"

export async function POST(req: Request) {
  // Verify auth
  const jar = await cookies()
  const session = await verifySessionCookie(jar.get(SESSION_COOKIE_NAME)?.value)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Only owners can manage billing
  if (session.role !== "owner") {
    return Response.json({ error: "Only workspace owners can manage billing" }, { status: 403 })
  }

  const body = await req.json()
  const { workspaceId, planId } = body as { workspaceId: string; planId: PlanId }

  if (!workspaceId || !planId) {
    return Response.json({ error: "workspaceId and planId are required" }, { status: 400 })
  }

  if (!["pro", "team"].includes(planId)) {
    return Response.json({ error: "Invalid plan. Use 'pro' or 'team'." }, { status: 400 })
  }

  // Get user email for Stripe customer
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 })
  }

  try {
    const origin = new URL(req.url).origin
    const checkoutUrl = await createCheckoutSession({
      workspaceId,
      planId,
      customerEmail: user.email,
      successUrl: `${origin}/settings/billing?success=true`,
      cancelUrl: `${origin}/settings/billing?canceled=true`,
    })

    return Response.json({ url: checkoutUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout session"
    return Response.json({ error: message }, { status: 500 })
  }
}
