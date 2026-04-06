import { db } from "@/lib/db"
import { knowledgeEntries, agents, teams, channels } from "@/lib/db/schema"
import { sql, eq } from "drizzle-orm"
import Link from "next/link"
import { PixelAvatar } from "@/components/pixel-avatar"
import { ArrowRight, FileText, MessageSquare, Zap } from "lucide-react"
import { getActiveWorkspace } from "@/lib/workspace-server"

// Getting Started card for fresh workspaces. Shows after onboarding
// when the user hasn't started the R&D conversation yet. Once the
// Business Overview doc exists, this card disappears.

export async function GettingStarted() {
  const ws = await getActiveWorkspace()
  if (!ws) return null

  // Check if the Business Overview doc exists. If it does, the user
  // has already gone through R&D and this card is no longer needed.
  const agentDocs = await db.select({ id: knowledgeEntries.id })
    .from(knowledgeEntries)
    .where(sql`${knowledgeEntries.createdByAgentId} IS NOT NULL AND NOT (${knowledgeEntries.tags} @> '["internal"]'::jsonb)`)
    .limit(1)

  if (agentDocs.length > 0) return null

  // Find the R&D team lead and their channel
  const allTeams = await db.select().from(teams).where(eq(teams.workspaceId, ws.id))
  const rdTeam = allTeams.find((t) => /research|r&d/i.test(t.name))
  const rdLeadId = rdTeam?.leadAgentId
  const rdLead = rdLeadId
    ? (await db.select().from(agents).where(eq(agents.id, rdLeadId)).limit(1))[0]
    : null
  const rdChannel = rdTeam
    ? (await db.select().from(channels).where(eq(channels.teamId, rdTeam.id)).limit(1))[0]
    : null

  return (
    <div className="bg-card border border-border rounded-md p-5">
      <div className="flex items-start gap-4">
        {rdLead && (
          <PixelAvatar characterIndex={rdLead.pixelAvatarIndex} size={40} className="rounded-md shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold">Your team is ready</h2>
          <p className="text-sm text-muted-foreground/70 mt-1 leading-relaxed">
            {rdLead?.name ?? "Your R&D lead"} is waiting to learn about your business. Answer a few questions and they'll produce a full Business Overview document, then hand off to Marketing to start building your go-to-market.
          </p>

          <div className="flex flex-col gap-2 mt-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span>Answer 4 questions about your product</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>Get a Business Overview document in My Business</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span>Marketing starts working automatically after R&D finishes</span>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-4 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Go to {rdChannel?.name ? `#${rdChannel.name}` : "R&D"} channel
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
