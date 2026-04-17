import { db } from "@/lib/db"
import { agents, teams, channels, messages, workspaces } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

// Returns a handoff PLAN that the client executes step-by-step.
// This allows real-time staggered messages with typing indicators per PVD Stage 4.
//
// The client calls this once to get the plan, then POSTs each step to /api/messages
// on its own schedule, with typing indicators between steps for a live-feeling flow.

export interface HandoffStep {
  id: string
  delayMs: number          // time to wait before this message appears
  typingMs: number         // how long to show "typing..." before posting
  channelId: string
  channelName: string
  agentId: string
  agentName: string
  agentAvatar: string
  content: string
}

export async function POST(req: Request) {
  const auth = await withAuth()

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, auth.workspace.id)).limit(1)
  if (!workspace) return Response.json({ error: "Workspace not found" }, { status: 404 })

  const wsTeams = await db.select().from(teams).where(eq(teams.workspaceId, auth.workspace.id))
  const teamIds = wsTeams.map((t) => t.id)

  const wsChannels = await db.select().from(channels)
  const tlChannel = wsChannels.find((c) => c.name === "team-leaders")

  // Idempotency: check if already triggered
  if (tlChannel) {
    const existing = await db.select().from(messages).where(eq(messages.channelId, tlChannel.id))
    const alreadyTriggered = existing.some((m) => m.content.includes("[handoff-triggered]"))
    if (alreadyTriggered) {
      return Response.json({ ok: true, skipped: true, steps: [] })
    }
  }

  const allAgents = await db.select().from(agents)
  const wsAgents = allAgents.filter((a) => a.teamId && teamIds.includes(a.teamId))
  const chiefOfStaff = allAgents.find((a) => a.role === "Chief of Staff")

  const teamLeads = wsAgents.filter((a) => a.isTeamLead)
  const addressName = workspace.ownerName || "boss"
  const bName = workspace.name

  function leadForTeamName(nameSubstring: string) {
    return teamLeads.find((l) => {
      const team = wsTeams.find((t) => t.id === l.teamId)
      return team?.name.toLowerCase().includes(nameSubstring.toLowerCase())
    })
  }

  function channelForTeam(teamId: string | null) {
    if (!teamId) return null
    return wsChannels.find((c) => c.teamId === teamId) ?? null
  }

  const rndLead = leadForTeamName("research") || leadForTeamName("r&d")
  const marketingLead = leadForTeamName("marketing") || leadForTeamName("growth") || leadForTeamName("content")
  const opsLead = leadForTeamName("operations") || leadForTeamName("ops") || leadForTeamName("delivery") || leadForTeamName("fulfillment")
  const financeLead = leadForTeamName("finance") || leadForTeamName("monetization")

  const profile = (workspace.businessProfile ?? {}) as Record<string, unknown>
  const existingGoal = profile.goal as string | undefined
  const existingScale = profile.targetScale as string | undefined
  const existingTimeline = profile.timeline as string | undefined

  const steps: HandoffStep[] = []
  let cumulativeDelay = 0

  function addStep(agent: typeof allAgents[number] | undefined, channelId: string | undefined, content: string, delay: number, typing: number) {
    if (!agent || !channelId) return
    const ch = wsChannels.find((c) => c.id === channelId)
    steps.push({
      id: `${agent.id}-${cumulativeDelay}`,
      delayMs: cumulativeDelay + delay,
      typingMs: typing,
      channelId,
      channelName: ch?.name || "",
      agentId: agent.id,
      agentName: agent.name,
      agentAvatar: agent.avatar,
      content,
    })
    cumulativeDelay += delay
  }

  // 1. R&D lead summarizes (in R&D channel)
  if (rndLead) {
    const rndCh = channelForTeam(rndLead.teamId)
    addStep(
      rndLead,
      rndCh?.id,
      `Perfect. Based on our conversation, I'm going to write up the offer brief and loop in the rest of the team.\n\nYou'll hear from Marketing, Operations, and Finance in their channels over the next few minutes. Each of them will build their piece around the offer we just defined.`,
      1500, 1800
    )
  }

  // 2. Nova announces handoff in #team-leaders (with marker)
  if (chiefOfStaff && tlChannel) {
    addStep(
      chiefOfStaff,
      tlChannel.id,
      `[handoff-triggered] ${rndLead?.name || "R&D"} just finished the product discovery session with ${addressName}.\n\n@${marketingLead?.name || "Marketing"}, @${opsLead?.name || "Operations"}, @${financeLead?.name || "Finance"} — you're up. Each of you, take point in your channel and reach out directly. I'll be coordinating from here.`,
      2000, 1500
    )
  }

  // 3. Marketing lead in their channel
  if (marketingLead) {
    const mktCh = channelForTeam(marketingLead.teamId)
    addStep(
      marketingLead,
      mktCh?.id,
      `Hey ${addressName} 👋 Just got the offer brief from ${rndLead?.name || "R&D"} — I love the direction. I'm building out a go-to-market plan right now.\n\nHere's what I'm thinking:\n• Primary channel based on where your ideal customer already is\n• Content pillars that match the problem you're solving\n• A launch sequence that builds momentum, not just noise\n\nI'll have a draft ready for your review shortly. In the meantime, if you have brand voice preferences or reference accounts you admire, drop them here.`,
      3000, 2500
    )
  }

  // 4. Ops lead in their channel
  if (opsLead) {
    const opsCh = channelForTeam(opsLead.teamId)
    addStep(
      opsLead,
      opsCh?.id,
      `Hey ${addressName} 👋 Operations here. ${rndLead?.name || "R&D"} briefed me on the offer — solid. Here's what I need from you to make the back-end run smoothly:\n\n1. **Delivery process** — how does a customer get what they paid for?\n2. **Tooling** — any existing tools you want to keep using?\n3. **Handoffs** — who does what when a new customer comes in?\n\nWe'll build the automation around your answers. Reply here when you have 5 minutes.`,
      3000, 2500
    )
  }

  // 5. Finance lead in their channel
  if (financeLead) {
    const finCh = channelForTeam(financeLead.teamId)
    addStep(
      financeLead,
      finCh?.id,
      `Hey ${addressName} 👋 Finance checking in. Based on the offer ${rndLead?.name || "R&D"} and I just discussed, here's my recommendation:\n\n**Payment processing:** Stripe is the cleanest fit for most businesses — fast setup, global support, great dashboards. Whop is also strong if you're selling digital products or memberships. PayPal if your buyers demand it.\n\n**My recommendation:** Start with Stripe. I'll set up the account structure and invoice templates once you confirm.\n\nAnything I should know about your current financial setup? Existing tax entity, accountant, bookkeeping tool?`,
      3000, 2500
    )
  }

  // 6. Nova wraps with goal-setting in #team-leaders
  if (chiefOfStaff && tlChannel) {
    addStep(
      chiefOfStaff,
      tlChannel.id,
      `Every department is engaged with ${addressName} now. Before we move into execution, let's lock in what we're shooting for as a company.`,
      3000, 2000
    )

    // 7. Nova's goal proposal to user
    addStep(
      chiefOfStaff,
      tlChannel.id,
      `${addressName} — you've got a full team engaged now. Here's where we stand:\n\n${existingGoal ? `**Your goal:** ${existingGoal}` : "We still need to lock in a clear goal."}\n${existingScale ? `\n**Target:** ${existingScale}` : ""}\n${existingTimeline ? `\n**Timeline:** ${existingTimeline}` : ""}\n\nHere's what I recommend as the Q1 target:\n\n**Quarter 1:**\n• Ship the offer we just defined\n• Close first 3–5 customers\n• Systematize the delivery so it's repeatable\n\nReply with **"Looks good"** to lock it in, or tell me what you'd change. Once aligned, I'll translate this into department-level goals for every team lead.`,
      2500, 2000
    )
  }

  return Response.json({
    ok: true,
    steps,
    totalDurationMs: cumulativeDelay,
  })
}
