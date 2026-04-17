// src/app/api/billing/portal/route.ts

import { cookies } from "next/headers"
import { verifySessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session"
import { createPortalSession } from "@/lib/billing/stripe"

export async function POST(req: Request) {
  const jar = await cookies()
  const session = await verifySessionCookie(jar.get(SESSION_COOKIE_NAME)?.value)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.role !== "owner") {
    return Response.json({ error: "Only workspace owners can access billing portal" }, { status: 403 })
  }

  const body = await req.json()
  const { workspaceId } = body as { workspaceId: string }

  if (!workspaceId) {
    return Response.json({ error: "workspaceId is required" }, { status: 400 })
  }

  try {
    const origin = new URL(req.url).origin
    const portalUrl = await createPortalSession({
      workspaceId,
      returnUrl: `${origin}/settings/billing`,
    })

    return Response.json({ url: portalUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create portal session"
    return Response.json({ error: message }, { status: 500 })
  }
}
