/**
 * Weekly Consolidation Cron — runs every Sunday at 3am UTC.
 *
 * Iterates all active workspaces with an Anthropic API key and
 * runs the 6-phase consolidation pipeline for each.
 */

import { db } from "@/lib/db"
import { workspaces } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { runConsolidation } from "@/lib/learning/consolidation"

export const maxDuration = 300 // 5 minutes for multi-workspace consolidation

function verifyCron(req: Request): boolean {
  const authHeader = req.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  if (process.env.NODE_ENV === "development") return true
  return false
}

export async function GET(req: Request) {
  if (!verifyCron(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get all active workspaces that have an Anthropic API key
  const activeWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      anthropicApiKey: workspaces.anthropicApiKey,
    })
    .from(workspaces)
    .where(eq(workspaces.isActive, true))

  const results: Array<{
    workspaceId: string
    workspaceName: string
    status: "ok" | "skipped" | "error"
    details?: Record<string, unknown>
    error?: string
  }> = []

  for (const ws of activeWorkspaces) {
    // Skip workspaces without an API key
    if (!ws.anthropicApiKey) {
      results.push({
        workspaceId: ws.id,
        workspaceName: ws.name,
        status: "skipped",
        details: { reason: "no_api_key" },
      })
      continue
    }

    try {
      const consolidationResult = await runConsolidation(ws.id, ws.anthropicApiKey)
      results.push({
        workspaceId: ws.id,
        workspaceName: ws.name,
        status: "ok",
        details: consolidationResult as unknown as Record<string, unknown>,
      })
    } catch (e) {
      results.push({
        workspaceId: ws.id,
        workspaceName: ws.name,
        status: "error",
        error: e instanceof Error ? e.message : "unknown error",
      })
    }
  }

  return Response.json({
    ok: true,
    consolidatedAt: new Date().toISOString(),
    workspacesProcessed: results.length,
    results,
  })
}
