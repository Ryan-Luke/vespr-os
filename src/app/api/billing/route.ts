import { withAuth } from "@/lib/auth/with-auth"
import { db } from "@/lib/db"
import { subscriptions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const auth = await withAuth()

  const [sub] = await db.select().from(subscriptions)
    .where(eq(subscriptions.workspaceId, auth.workspace.id))
    .limit(1)

  return Response.json({
    plan: sub?.plan || "free",
    status: sub?.status || "active",
    workspaceId: auth.workspace.id,
    currentPeriodEnd: sub?.currentPeriodEnd || null,
  })
}
