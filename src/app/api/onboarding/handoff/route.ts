import { db } from "@/lib/db"
import { agents, teams, channels, messages, workspaces } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

// Triggers the PVD first-run handoff sequence:
// R&D wraps up → announces handoff in #team-leaders →
// Marketing lead reaches out in #marketing →
// Ops lead reaches out in #operations →
// Finance lead reaches out in #finance →
// Chief of Staff wraps with goal-setting message
//
// Called by the chat client when it detects the first user message in R&D
// after a fresh onboarding.
export async function POST(req: Request) {
  const { workspaceId } = await req.json() as { workspaceId: string }

  if (!workspaceId) {
    return Response.json({ error: "workspaceId required" }, { status: 400 })
  }

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
  if (!workspace) return Response.json({ error: "Workspace not found" }, { status: 404 })

  // Idempotency: check if we've already triggered handoff for this workspace
  // Marker: look for a Nova message containing "[handoff-triggered]"
  const wsTeams = await db.select().from(teams).where(eq(teams.workspaceId, workspaceId))
  const teamIds = wsTeams.map((t) => t.id)

  const wsChannels = await db.select().from(channels)
  const tlChannel = wsChannels.find((c) => c.name === "team-leaders")

  if (tlChannel) {
    const existing = await db.select().from(messages)
      .where(and(eq(messages.channelId, tlChannel.id)))
    const alreadyTriggered = existing.some((m) => m.content.includes("[handoff-triggered]"))
    if (alreadyTriggered) {
      return Response.json({ ok: true, skipped: true, reason: "Already triggered" })
    }
  }

  // Load all relevant agents
  const allAgents = await db.select().from(agents)
  const wsAgents = allAgents.filter((a) => a.teamId && teamIds.includes(a.teamId))
  const chiefOfStaff = allAgents.find((a) => a.role === "Chief of Staff")

  const teamLeads = wsAgents.filter((a) => a.isTeamLead)
  const addressName = workspace.ownerName || "boss"
  const bName = workspace.name

  // Helpers
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

  const now = Date.now()
  const handoffs: any[] = []

  // 1. R&D lead summarizes in their own channel
  if (rndLead) {
    const rndChannel = channelForTeam(rndLead.teamId)
    if (rndChannel) {
      handoffs.push({
        channelId: rndChannel.id,
        senderAgentId: rndLead.id,
        senderName: rndLead.name,
        senderAvatar: rndLead.avatar,
        content: `Perfect. Based on our conversation, I'm going to write up the offer brief and loop in the rest of the team.\n\nYou'll hear from Marketing, Operations, and Finance in their channels over the next few minutes. Each of them will build their piece around the offer we just defined.`,
        messageType: "text",
        createdAt: new Date(now + 2000),
      })
    }
  }

  // 2. Nova announces handoff in #team-leaders (includes the marker)
  if (tlChannel && chiefOfStaff) {
    handoffs.push({
      channelId: tlChannel.id,
      senderAgentId: chiefOfStaff.id,
      senderName: chiefOfStaff.name,
      senderAvatar: chiefOfStaff.avatar,
      content: `[handoff-triggered] ${rndLead?.name || "R&D"} just finished the product discovery session with ${addressName}.\n\n@${marketingLead?.name || "Marketing"}, @${opsLead?.name || "Operations"}, @${financeLead?.name || "Finance"} — you're up. Each of you, take point in your channel and reach out directly. I'll be coordinating from here.`,
      messageType: "text",
      createdAt: new Date(now + 4000),
    })
  }

  // 3. Marketing lead reaches out in their channel
  if (marketingLead) {
    const mktChannel = channelForTeam(marketingLead.teamId)
    if (mktChannel) {
      handoffs.push({
        channelId: mktChannel.id,
        senderAgentId: marketingLead.id,
        senderName: marketingLead.name,
        senderAvatar: marketingLead.avatar,
        content: `Hey ${addressName} 👋 Just got the offer brief from ${rndLead?.name || "R&D"} — I love the direction. I'm building out a go-to-market plan right now.\n\nHere's what I'm thinking:\n• Primary channel based on where your ideal customer already is\n• Content pillars that match the problem you're solving\n• A launch sequence that builds momentum, not just noise\n\nI'll have a draft ready for your review shortly. In the meantime, if you have brand voice preferences or reference accounts you admire, drop them here.`,
        messageType: "text",
        createdAt: new Date(now + 8000),
      })
    }
  }

  // 4. Ops lead reaches out in their channel
  if (opsLead) {
    const opsChannel = channelForTeam(opsLead.teamId)
    if (opsChannel) {
      handoffs.push({
        channelId: opsChannel.id,
        senderAgentId: opsLead.id,
        senderName: opsLead.name,
        senderAvatar: opsLead.avatar,
        content: `Hey ${addressName} 👋 Operations here. ${rndLead?.name || "R&D"} briefed me on the offer — solid. Here's what I need from you to make the back-end run smoothly:\n\n1. **Delivery process** — how does a customer get what they paid for?\n2. **Tooling** — any existing tools you want to keep using?\n3. **Handoffs** — who does what when a new customer comes in?\n\nWe'll build the automation around your answers. Reply here when you have 5 minutes.`,
        messageType: "text",
        createdAt: new Date(now + 12000),
      })
    }
  }

  // 5. Finance lead reaches out in their channel
  if (financeLead) {
    const finChannel = channelForTeam(financeLead.teamId)
    if (finChannel) {
      handoffs.push({
        channelId: finChannel.id,
        senderAgentId: financeLead.id,
        senderName: financeLead.name,
        senderAvatar: financeLead.avatar,
        content: `Hey ${addressName} 👋 Finance checking in. Based on the offer ${rndLead?.name || "R&D"} and I just discussed, here's my recommendation:\n\n**Payment processing:** Stripe is the cleanest fit for most businesses — fast setup, global support, great dashboards. Whop is also strong if you're selling digital products or memberships. PayPal if your buyers demand it.\n\n**My recommendation:** Start with Stripe. I'll set up the account structure and invoice templates once you confirm.\n\nAnything I should know about your current financial setup? Existing tax entity, accountant, bookkeeping tool?`,
        messageType: "text",
        createdAt: new Date(now + 16000),
      })
    }
  }

  // 6. Chief of Staff wraps with goal-setting
  if (chiefOfStaff && tlChannel) {
    handoffs.push({
      channelId: tlChannel.id,
      senderAgentId: chiefOfStaff.id,
      senderName: chiefOfStaff.name,
      senderAvatar: chiefOfStaff.avatar,
      content: `Great. Every department is engaged with ${addressName} now. I'm going to wrap this up by DMing them directly with a goal-setting exercise.`,
      messageType: "text",
      createdAt: new Date(now + 20000),
    })

    // And Nova messages the user directly (in team-leaders for visibility)
    const profile = (workspace.businessProfile ?? {}) as Record<string, unknown>
    const existingGoal = profile.goal as string | undefined
    const existingScale = profile.targetScale as string | undefined
    const existingTimeline = profile.timeline as string | undefined

    handoffs.push({
      channelId: tlChannel.id,
      senderAgentId: chiefOfStaff.id,
      senderName: chiefOfStaff.name,
      senderAvatar: chiefOfStaff.avatar,
      content: `${addressName} — you've got a full team engaged now. Before we move into execution, let's lock in what we're shooting for.\n\n${existingGoal ? `You told me your goal is: **${existingGoal}**` : "I need a clear goal we can all rally around."}\n${existingScale ? `\nTarget: **${existingScale}**` : ""}\n${existingTimeline ? `\nTimeline: **${existingTimeline}**` : ""}\n\nHere's what I recommend we turn this into as a company-level goal over the next 90 days:\n\n**Quarter 1 target:**\n• Ship the offer we just defined\n• Close first 3–5 customers\n• Systematize the delivery so it's repeatable\n\nReply with **"Looks good"** if you want to lock this in, or tell me what you'd change. Once aligned, I'll translate this into department-level goals for every team lead.`,
      messageType: "text",
      createdAt: new Date(now + 24000),
    })
  }

  if (handoffs.length > 0) {
    await db.insert(messages).values(handoffs)
  }

  return Response.json({
    ok: true,
    handoffCount: handoffs.length,
  })
}
