import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { workspaces, teams, agents as agentsTable, trophyEvents, agentBonds } from "@/lib/db/schema"
import { eq, inArray, or, isNull, desc } from "drizzle-orm"
import { ARCHETYPES, TIER_STYLES, type ArchetypeId, type Tier } from "@/lib/archetypes"
import { PixelAvatar } from "@/components/pixel-avatar"
import { Trophy, TrendingUp, Users, Zap, ExternalLink, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1)
  if (!workspace || !workspace.isPublic) return { title: "Trainer Profile — VESPR OS" }

  return {
    title: `${workspace.name} — VESPR OS Trainer Profile`,
    description: workspace.publicTagline || workspace.description || `${workspace.name}'s AI team roster on VESPR OS`,
    openGraph: {
      title: `${workspace.name} on VESPR OS`,
      description: workspace.publicTagline || workspace.description || undefined,
      type: "profile",
    },
  }
}

export default async function PublicTrainerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1)
  if (!workspace || !workspace.isPublic) notFound()

  const wsTeams = await db.select().from(teams).where(eq(teams.workspaceId, workspace.id))
  const teamIds = wsTeams.map((t) => t.id)

  const wsAgents = teamIds.length > 0
    ? await db.select().from(agentsTable).where(or(inArray(agentsTable.teamId, teamIds), isNull(agentsTable.teamId)))
    : []

  const topTrophies = await db.select().from(trophyEvents)
    .where(eq(trophyEvents.workspaceId, workspace.id))
    .orderBy(desc(trophyEvents.createdAt))
    .limit(6)

  const allBonds = await db.select().from(agentBonds).orderBy(desc(agentBonds.outcomeLift))
  const agentIds = new Set(wsAgents.map((a) => a.id))
  const wsBonds = allBonds.filter((b) => agentIds.has(b.agentAId) && agentIds.has(b.agentBId)).slice(0, 4)

  const totalTasks = wsAgents.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0)
  const avgLevel = wsAgents.length > 0 ? Math.round(wsAgents.reduce((sum, a) => sum + (a.level ?? 1), 0) / wsAgents.length) : 0

  const publicAgents = wsAgents.filter((a) => a.teamId)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-primary/15 flex items-center justify-center text-3xl">
              {workspace.icon}
            </div>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{workspace.name}</h1>
            {workspace.publicTagline && (
              <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-xl mx-auto">
                {workspace.publicTagline}
              </p>
            )}
            {workspace.website && (
              <a href={workspace.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                {workspace.website.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-px bg-border rounded-xl overflow-hidden max-w-md mx-auto">
          <div className="bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <Users className="h-3 w-3" />Agents
            </div>
            <p className="text-xl font-bold tabular-nums mt-1">{publicAgents.length}</p>
          </div>
          <div className="bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <Zap className="h-3 w-3" />Shipped
            </div>
            <p className="text-xl font-bold tabular-nums mt-1">{totalTasks.toLocaleString()}</p>
          </div>
          <div className="bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <TrendingUp className="h-3 w-3" />Avg Lv
            </div>
            <p className="text-xl font-bold tabular-nums mt-1">Lv.{avgLevel}</p>
          </div>
        </div>

        {/* Roster */}
        <section>
          <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">The Roster</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {publicAgents.map((agent) => {
              const archetypeId = (agent.archetype || "operator") as ArchetypeId
              const archetype = ARCHETYPES[archetypeId] || ARCHETYPES.operator
              const tier = (agent.tier || "common") as Tier
              const tierStyle = TIER_STYLES[tier] || TIER_STYLES.common
              return (
                <div key={agent.id} className={cn("rounded-xl border-2 p-4 transition-all", tierStyle.bg, tierStyle.border, tierStyle.glow)}>
                  <div className="flex items-start gap-3">
                    <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={40} className="rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold truncate">{agent.nickname || agent.name}</h3>
                        <span className="text-base">{archetype.icon}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{agent.currentForm || archetype.label}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={cn("text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border", tierStyle.text, tierStyle.bg, tierStyle.border)}>
                          {tierStyle.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">Lv.{agent.level}</span>
                        <span className="text-[10px] text-muted-foreground">· {(agent.tasksCompleted ?? 0).toLocaleString()} shipped</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Recent wins */}
        {topTrophies.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Trophy className="h-3 w-3 text-amber-400" />
              Recent Wins
            </h2>
            <div className="space-y-2">
              {topTrophies.map((t) => (
                <div key={t.id} className="bg-card border border-border rounded-md p-3 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-muted/40 flex items-center justify-center text-base shrink-0">
                    {t.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium">{t.title}</p>
                    {t.description && <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>}
                  </div>
                  {t.amount && (
                    <span className="text-[13px] font-bold text-emerald-400 tabular-nums shrink-0">${t.amount.toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Bonds */}
        {wsBonds.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-purple-400" />
              Team Chemistry
            </h2>
            <div className="space-y-2">
              {wsBonds.map((b) => {
                const a = publicAgents.find((x) => x.id === b.agentAId)
                const other = publicAgents.find((x) => x.id === b.agentBId)
                return (
                  <div key={b.id} className="bg-card border border-border rounded-md p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium">
                        {a?.nickname || a?.name} + {other?.nickname || other?.name}
                      </span>
                      {b.outcomeLift && (
                        <span className="text-[13px] font-bold text-emerald-400">+{Math.round(b.outcomeLift * 100)}%</span>
                      )}
                    </div>
                    {b.context && <p className="text-[11px] text-muted-foreground mt-0.5">{b.context}</p>}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-12 pb-6 text-center space-y-2 border-t border-border">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Powered by</p>
          <a href="/" className="inline-flex items-center gap-1 text-sm font-bold hover:underline">
            VESPR OS
          </a>
          <p className="text-[10px] text-muted-foreground/60">The operating system for building businesses with AI agents.</p>
        </footer>
      </div>
    </div>
  )
}
