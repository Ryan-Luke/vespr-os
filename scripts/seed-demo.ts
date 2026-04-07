// Seed a rich demo state with a template AI automation agency.
// Shows the full R&D → Marketing flow with realistic conversations,
// documents, wins, team-leader coordination, and phase progress.
//
// Usage: set -a && source .env.local && set +a && npx tsx scripts/seed-demo.ts

import { db } from "../src/lib/db"
import { wipeBusinessData } from "../src/lib/db/wipe"
import {
  workspaces, teams, agents, channels, messages, knowledgeEntries,
  companyMemories, trophyEvents, teamGoals, activityLog, workflowPhaseRuns,
  handoffEvents,
} from "../src/lib/db/schema"
import { eq } from "drizzle-orm"
import { ensureWorkflowInitialized, upsertPhaseOutput } from "../src/lib/workflow-engine"

async function main() {
  console.log("Wiping existing data...")
  await wipeBusinessData()

  // ── Create workspace ────────────────────────────────────
  console.log("Creating workspace...")
  const [ws] = await db.insert(workspaces).values({
    name: "ScaleForce AI",
    slug: "scaleforce-ai",
    icon: "⚡",
    description: "AI automation agency helping 7-9 figure companies deploy AI employees across sales, ops, and marketing",
    businessType: "agency",
    ownerName: "Luke",
    businessProfile: {
      mission: "Replace 80% of repetitive team work with AI agents that actually execute",
      icp: "Founders and CEOs of info/coaching businesses doing $2.5M-$4M annually",
      goal: "$100K MRR in 6 months",
      tools: ["GoHighLevel", "n8n", "Claude", "Slack"],
    },
  }).returning()

  // ── Create teams ────────────────────────────────────────
  console.log("Creating teams...")
  const [rdTeam] = await db.insert(teams).values({ workspaceId: ws.id, name: "Research & Development", icon: "🔬", description: "Product discovery, offer validation, market research" }).returning()
  const [mktTeam] = await db.insert(teams).values({ workspaceId: ws.id, name: "Marketing", icon: "📣", description: "Go-to-market strategy, content, ads, lead generation" }).returning()
  const [salesTeam] = await db.insert(teams).values({ workspaceId: ws.id, name: "Sales", icon: "💰", description: "Outreach, pipeline, closing" }).returning()
  const [opsTeam] = await db.insert(teams).values({ workspaceId: ws.id, name: "Operations", icon: "⚙️", description: "Systems, automations, tool management" }).returning()
  const [finTeam] = await db.insert(teams).values({ workspaceId: ws.id, name: "Finance", icon: "📊", description: "Revenue tracking, invoicing, bookkeeping" }).returning()

  // ── Create agents ───────────────────────────────────────
  console.log("Creating agents...")
  const [nova] = await db.insert(agents).values({
    name: "Nova", role: "Chief of Staff", avatar: "NV", pixelAvatarIndex: 3,
    provider: "anthropic", model: "Claude Sonnet", status: "working",
    skills: ["Cross-Team Coordination", "Priority Management", "Executive Summaries"],
    personality: { formality: 50, humor: 20, energy: 65, warmth: 70, directness: 75, confidence: 85, verbosity: 45 },
    isTeamLead: false, autonomyLevel: "full_auto",
  }).returning()

  const [rory] = await db.insert(agents).values({
    name: "Rory", role: "Head of R&D", avatar: "RY", pixelAvatarIndex: 0,
    provider: "anthropic", model: "Claude Haiku", status: "working", teamId: rdTeam.id,
    skills: ["Market Research", "Offer Architecture", "Competitive Analysis", "Pricing Strategy"],
    personality: { formality: 30, humor: 40, energy: 70, warmth: 65, directness: 80, confidence: 75, verbosity: 50 },
    isTeamLead: true, autonomyLevel: "supervised",
  }).returning()

  const [maya] = await db.insert(agents).values({
    name: "Maya", role: "Head of Marketing", avatar: "MY", pixelAvatarIndex: 1,
    provider: "anthropic", model: "Claude Haiku", status: "working", teamId: mktTeam.id,
    skills: ["Content Strategy", "Paid Ads", "SEO", "Social Media", "Copywriting"],
    personality: { formality: 35, humor: 50, energy: 80, warmth: 75, directness: 65, confidence: 70, verbosity: 55 },
    isTeamLead: true, autonomyLevel: "supervised",
  }).returning()

  const [jordan] = await db.insert(agents).values({
    name: "Jordan", role: "Head of Sales", avatar: "JD", pixelAvatarIndex: 2,
    provider: "anthropic", model: "Claude Haiku", status: "idle", teamId: salesTeam.id,
    skills: ["Outbound", "Pipeline Management", "Closing", "CRM"],
    personality: { formality: 40, humor: 30, energy: 75, warmth: 60, directness: 85, confidence: 80, verbosity: 40 },
    isTeamLead: true, autonomyLevel: "supervised",
  }).returning()

  const [nyx] = await db.insert(agents).values({
    name: "Nyx", role: "Head of Operations", avatar: "NX", pixelAvatarIndex: 4,
    provider: "anthropic", model: "Claude Haiku", status: "idle", teamId: opsTeam.id,
    skills: ["Workflow Design", "Tool Integration", "n8n", "API Management"],
    personality: { formality: 45, humor: 25, energy: 60, warmth: 55, directness: 70, confidence: 75, verbosity: 35 },
    isTeamLead: true, autonomyLevel: "supervised",
  }).returning()

  const [finley] = await db.insert(agents).values({
    name: "Finley", role: "Head of Finance", avatar: "FN", pixelAvatarIndex: 5,
    provider: "anthropic", model: "Claude Haiku", status: "idle", teamId: finTeam.id,
    skills: ["Bookkeeping", "Revenue Tracking", "Invoicing", "Cash Flow"],
    personality: { formality: 55, humor: 15, energy: 50, warmth: 50, directness: 75, confidence: 70, verbosity: 30 },
    isTeamLead: true, autonomyLevel: "supervised",
  }).returning()

  // Update team leads
  await db.update(teams).set({ leadAgentId: rory.id }).where(eq(teams.id, rdTeam.id))
  await db.update(teams).set({ leadAgentId: maya.id }).where(eq(teams.id, mktTeam.id))
  await db.update(teams).set({ leadAgentId: jordan.id }).where(eq(teams.id, salesTeam.id))
  await db.update(teams).set({ leadAgentId: nyx.id }).where(eq(teams.id, opsTeam.id))
  await db.update(teams).set({ leadAgentId: finley.id }).where(eq(teams.id, finTeam.id))

  // ── Create channels ─────────────────────────────────────
  console.log("Creating channels...")
  const [tlCh] = await db.insert(channels).values({ name: "team-leaders", type: "system" }).returning()
  const [winsCh] = await db.insert(channels).values({ name: "wins", type: "system" }).returning()
  const [wcCh] = await db.insert(channels).values({ name: "watercooler", type: "system" }).returning()
  const [rdCh] = await db.insert(channels).values({ name: "research-&-development", type: "team", teamId: rdTeam.id }).returning()
  const [mktCh] = await db.insert(channels).values({ name: "marketing", type: "team", teamId: mktTeam.id }).returning()
  const [salesCh] = await db.insert(channels).values({ name: "sales", type: "team", teamId: salesTeam.id }).returning()
  const [opsCh] = await db.insert(channels).values({ name: "operations", type: "team", teamId: opsTeam.id }).returning()
  const [finCh] = await db.insert(channels).values({ name: "finance", type: "team", teamId: finTeam.id }).returning()
  await db.insert(channels).values({ name: "delivery", type: "team" })

  // Helper to post a message with a delay between created_at timestamps
  let msgTime = Date.now() - 3600000 // Start 1 hour ago
  function msg(channelId: string, agentId: string | null, name: string, avatar: string, content: string) {
    msgTime += 45000 // 45 seconds between messages
    return {
      channelId,
      senderAgentId: agentId,
      senderUserId: agentId ? null : "user",
      senderName: name,
      senderAvatar: avatar,
      content,
      messageType: "text" as const,
      createdAt: new Date(msgTime),
    }
  }

  // ── Seed R&D channel conversation ───────────────────────
  console.log("Seeding R&D conversation...")
  const rdMsgs = [
    msg(rdCh.id, rory.id, "Rory", "RY", "Hey Luke. Rory here, your Head of R&D.\n\nI'm going to help you define and validate your offer. We'll work through four things together:\n\n1. Who are we selling to?\n2. What problem do we solve?\n3. What's the offer?\n4. What's the price point?\n\nOnce we nail this, I'll hand it off to Marketing to build the go-to-market. Ready when you are."),
    msg(rdCh.id, null, "You", "YO", "Ready. We're building an AI automation agency targeting info/coaching businesses doing $2.5M-$4M annually."),
    msg(rdCh.id, rory.id, "Rory", "RY", "Solid starting point. Let me push on this. When you say info/coaching businesses at that revenue level, who's the actual buyer? Is it the founder directly? A COO? An ops person?\n\nAnd what's their team size look like? That matters for how we position the offer."),
    msg(rdCh.id, null, "You", "YO", "Founder is the buyer 90% of the time. They have 10-15 team members, $40K-$80K monthly payroll. They're in growth mode, scaling ad spend and hiring setters/VAs."),
    msg(rdCh.id, rory.id, "Rory", "RY", "That's specific. I like it. Founders at $2.5M-$4M with 10-15 people means they're past the scrappy phase but drowning in operational complexity. They're hiring humans to solve problems that AI could handle.\n\nLet me validate the math: at $40K-$80K payroll, if we can replace even 30% of that with AI agents, we're saving them $12K-$24K/month. That's the ROI story.\n\n🔒 Phase 1: Target Customer - LOCKED\n\nProgress: 1 of 4 foundational pieces locked.\n\nNext up: What problem are we solving for them? What's keeping these founders up at night?"),
    msg(rdCh.id, null, "You", "YO", "They're spending too much time managing people and processes. Every new client means hiring another VA or setter. They can't scale without adding headcount. And quality drops as the team grows because the founder can't be everywhere."),
    msg(rdCh.id, rory.id, "Rory", "RY", "That's the classic scaling trap. Revenue goes up but profit stays flat because every dollar of growth requires a dollar of labor. The founder becomes a manager instead of a strategist.\n\nThe deeper pain: they KNOW AI exists but don't know how to implement it without breaking what already works. They've maybe tried ChatGPT or hired a freelancer but nothing stuck.\n\n🔒 Phase 2: Problem - LOCKED\n\nProgress: 2 of 4 locked.\n\nNow the offer. What exactly are we selling them? Is this done-for-you implementation? A platform? Coaching on how to do it themselves?"),
    msg(rdCh.id, null, "You", "YO", "Done-for-you AI deployment. We audit their operations, identify the highest-leverage automation opportunities, build and deploy AI agents that handle sales outreach, client onboarding, content creation, and internal ops. 90-day engagement."),
    msg(rdCh.id, rory.id, "Rory", "RY", "A 90-day DFY engagement is clean. Let me pressure-test the scope. If you're covering sales, onboarding, content, AND ops in 90 days, that's ambitious. Most agencies I've seen either go narrow (just sales automation) or long (6-month retainer).\n\nWhat makes 90 days realistic for your model? Do you have a standardized deployment framework or is each client custom?\n\nThis matters for pricing because custom = higher price but harder to scale."),
    msg(rdCh.id, null, "You", "YO", "We have a standardized framework. Week 1-2 is audit, week 3-6 is build and deploy the core agents, week 7-12 is optimization and training the team to manage them. We use n8n + Claude + GHL as the stack for every client."),
    msg(rdCh.id, rory.id, "Rory", "RY", "Standardized stack with a repeatable framework. That's scalable. The n8n + Claude + GHL combo covers most of what these founders need without custom dev work.\n\n🔒 Phase 3: Offer - LOCKED\n\nProgress: 3 of 4 locked. One more.\n\nPricing. At your target market ($2.5M-$4M businesses), what are you thinking? And let me run the unit economics to make sure it works for your $100K MRR goal."),
    msg(rdCh.id, null, "You", "YO", "$5K setup + $3K/month ongoing retainer. The setup covers the audit and initial deployment. The retainer covers optimization, monitoring, and expanding the AI team."),
    msg(rdCh.id, rory.id, "Rory", "RY", "Let me check the math. At $5K setup + $3K/month:\n- To hit $100K MRR you need ~33 active retainer clients ($3K x 33 = $99K)\n- Plus setup fees flowing in from new clients\n- At a 90-day engagement, you need to close ~3-4 new clients per month to grow\n- Your CAC needs to stay under $2K to keep margins healthy\n\nThe pricing works IF you can close consistently. The ROI story is strong: they're paying $3K/month but saving $12K-$24K in labor. That's a 4-8x return.\n\n🔒 Phase 4: Pricing - LOCKED\n\nAll 4 foundational pieces are locked. I'm going to build your Business Overview doc now. Give me a minute."),
    msg(rdCh.id, rory.id, "Rory", "RY", "Done. I just put together your Business Overview doc. Check it out under My Business in the sidebar.\n\nIt covers your target customer, the problem, the offer, pricing logic, competitive landscape, unfair advantage, go-to-market direction, key metrics, and next steps.\n\nTake a look and let me know what you think. When you're ready, say 'approved' and I'll hand this off to Marketing."),
    msg(rdCh.id, null, "You", "YO", "This looks solid. Approved. Send it to Marketing."),
    msg(rdCh.id, rory.id, "Rory", "RY", "Handed off to Marketing. Maya's picking it up now. Check the team-leaders channel to see the coordination.\n\nNice work on this, Luke. The positioning is sharp. Now let's go sell it."),
  ]
  await db.insert(messages).values(rdMsgs)

  // ── Seed team-leaders conversation ──────────────────────
  console.log("Seeding team-leaders conversation...")
  const tlMsgs = [
    msg(tlCh.id, nova.id, "Nova", "NV", `@Rory, Luke just launched ScaleForce AI. I need you to run product discovery. Head to your channel and walk them through defining the offer. Everyone else, stand by.`),
    msg(tlCh.id, rory.id, "Rory", "RY", "On it. Heading to #research-&-development now to get started with Luke."),
    msg(tlCh.id, rory.id, "Rory", "RY", "**Handoff to Marketing**\n\nProduct definition is complete. Here's what we locked in:\n\n- **Target:** Founders/CEOs of info/coaching businesses, $2.5M-$4M/year, 10-15 team members\n- **Problem:** Can't scale without adding headcount. AI exists but they don't know how to implement it.\n- **Offer:** 90-day DFY AI deployment (audit, build, optimize). Standardized n8n + Claude + GHL stack.\n- **Price:** $5K setup + $3K/month retainer. 4-8x ROI for the client.\n\nBusiness Overview doc is in My Business. Maya, you're up. Build the go-to-market."),
    msg(tlCh.id, maya.id, "Maya", "MY", "Got the handoff. Business overview looks sharp. The positioning around replacing headcount with AI agents is strong.\n\nReaching out to Luke in #marketing now to talk budget and channel strategy."),
    msg(tlCh.id, nova.id, "Nova", "NV", "Good. Maya's on marketing strategy. Jordan, start thinking about the outbound motion. We'll need a pipeline plan once Maya has the messaging locked.\n\nNyx, we'll need you for the website/funnel build once marketing picks the tool. Stand by."),
    msg(tlCh.id, jordan.id, "Jordan", "JD", "Standing by. Already thinking about the cold outreach angle. The payroll savings hook is going to hit hard in DMs."),
    msg(tlCh.id, nyx.id, "Nyx", "NX", "Ready when you need me. I'll prep a comparison of GHL funnels vs Vercel for the landing page."),
  ]
  await db.insert(messages).values(tlMsgs)

  // ── Seed marketing channel ──────────────────────────────
  console.log("Seeding marketing conversation...")
  const mktMsgs = [
    msg(mktCh.id, maya.id, "Maya", "MY", "Hey Luke. Maya here, Head of Marketing. I just reviewed the business overview from R&D. Love the positioning.\n\nBefore I build the go-to-market plan, I need to understand your budget and channel preferences.\n\nAre you going organic (time investment), paid (ad spend), or hiring an agency to run it? And what's the budget look like?"),
    msg(mktCh.id, null, "You", "YO", "Mix of organic and paid. I've got $5K/month for ad spend to start. I'm already posting on Instagram and LinkedIn. Want to scale that up and add paid ads."),
    msg(mktCh.id, maya.id, "Maya", "MY", "$5K/month in ad spend with organic on IG and LinkedIn is a solid starting point. Here's my initial thinking:\n\n**Organic (free, time investment):**\n- LinkedIn: 3 posts/week. Thought leadership on AI replacing headcount. The payroll math angle is gold.\n- Instagram: Daily stories + 3 Reels/week. Behind-the-scenes of AI agents working. Before/after client results.\n\n**Paid ($5K/month):**\n- Meta Ads: $3.5K targeting coaching/info product founders. Lead magnet: free AI audit calculator.\n- LinkedIn Ads: $1.5K targeting CEOs at $2M+ companies. Direct to call booking.\n\nHow does that split feel? And do you want me to bring in a copywriter to start on the messaging?"),
    msg(mktCh.id, null, "You", "YO", "That split works. Yes, bring in the copywriter. And I want the landing page up within a week."),
    msg(mktCh.id, maya.id, "Maya", "MY", "On it. I'll coordinate with Nyx in ops for the landing page build. For the copy, I'll draft the core messaging angles this week:\n\n1. Hero: \"Your AI team is ready. Deploy in 90 days.\"\n2. Pain: \"Every hire costs $5K/month. Every AI agent costs $500.\"\n3. Proof: Case study framework (before/after payroll numbers)\n\nI'll have a Marketing Strategy doc ready for you to review by end of week. In the meantime, I'm setting up the content calendar."),
  ]
  await db.insert(messages).values(mktMsgs)

  // ── Seed wins channel ───────────────────────────────────
  console.log("Seeding wins...")
  const winMsgs = [
    msg(winsCh.id, rory.id, "Rory", "RY", "🏆 **Business Overview Complete**\nScaleForce AI's offer is locked. Target customer, problem, offer, and pricing all validated. Doc is live under My Business."),
    msg(winsCh.id, nova.id, "Nova", "NV", "🎯 **Marketing is Now Active**\nMaya picked up the handoff from R&D and is building the go-to-market plan. Budget locked at $5K/month paid + organic on IG and LinkedIn."),
    msg(winsCh.id, maya.id, "Maya", "MY", "📣 **Content Strategy Defined**\nLinkedIn 3x/week, Instagram daily stories + 3 Reels/week, Meta Ads $3.5K, LinkedIn Ads $1.5K. Copy angles drafted."),
  ]
  await db.insert(messages).values(winMsgs)

  // ── Seed trophy events ──────────────────────────────────
  await db.insert(trophyEvents).values([
    { agentId: rory.id, agentName: "Rory", type: "milestone", title: "Business Overview Complete", description: "All 4 foundational pieces locked and documented", icon: "🏆" },
    { agentId: maya.id, agentName: "Maya", type: "milestone", title: "Marketing Strategy Defined", description: "Channel strategy, budget allocation, and copy angles set", icon: "📣" },
  ])

  // ── Seed Business Overview document ─────────────────────
  console.log("Creating Business Overview doc...")
  await db.insert(knowledgeEntries).values({
    title: "Business Overview: ScaleForce AI",
    content: `## Executive Summary

ScaleForce AI is a done-for-you AI automation agency that deploys AI agents across sales, operations, marketing, and client onboarding for info/coaching businesses doing $2.5M-$4M annually. We replace 30-50% of repetitive team work with AI agents that actually execute, saving founders $12K-$24K/month in labor costs while improving quality and speed.

## The Problem

Founders at the $2.5M-$4M level are trapped in a scaling paradox: every new client requires hiring another VA, setter, or ops person. Revenue grows but profit stays flat because each dollar of growth demands a dollar of labor. The founder becomes a full-time manager instead of a strategist.

They know AI exists. They've tried ChatGPT. Maybe hired a freelancer to "build some automations." But nothing stuck because there's no system. No framework. No team that understands both the AI and the business operations.

The cost of inaction: $144K-$288K per year in unnecessary labor spend. Plus the opportunity cost of the founder's time spent managing instead of growing.

## Target Customer

Founders and CEOs of info/coaching businesses doing $2.5M-$4M annually. 10-15 team members. $40K-$80K monthly payroll. They're in growth mode: scaling ad spend, hiring setters and VAs, launching new offers. The CEO is the primary decision-maker 90% of the time. When ops people come in first (20-30%), they're validators researching on the founder's behalf, not independent buyers.

## The Offer

90-day done-for-you AI deployment:
- **Week 1-2:** Operations audit. Map every workflow, identify the highest-leverage automation opportunities.
- **Week 3-6:** Build and deploy AI agents for sales outreach, client onboarding, content creation, and internal ops.
- **Week 7-12:** Optimize performance, train the team to manage the AI agents, expand coverage.

Standardized tech stack: n8n (workflow automation) + Claude (AI reasoning) + GoHighLevel (CRM, email, SMS). Same stack for every client. Proven. Repeatable. Scalable.

## Pricing Logic

$5,000 setup + $3,000/month ongoing retainer.

Setup covers the audit and initial deployment. Retainer covers optimization, monitoring, and expanding the AI team.

ROI justification: Client saves $12K-$24K/month in labor. They pay $3K/month. That's a 4-8x return. The setup fee pays for itself in month one.

At $3K/month retainer, hitting $100K MRR requires 33 active clients. At 3-4 new clients per month, that's achievable in 10-12 months. CAC needs to stay under $2K.

## Competitive Landscape

- **Freelancers on Upwork:** Cheap ($50-100/hr) but no framework. Custom everything. Breaks when the freelancer disappears.
- **Traditional agencies (Accenture, Deloitte):** Enterprise pricing, 6+ month timelines, not built for info/coaching businesses.
- **AI SaaS tools (Jasper, Copy.ai):** Point solutions for content only. Don't cover ops, sales, or onboarding.
- **Other AI agencies:** Most focus on chatbots or one vertical. Few offer full-stack deployment across departments.

The gap: nobody is offering a standardized, full-stack AI deployment specifically for info/coaching founders at the $2.5M-$4M level with a 90-day timeline and a proven tech stack.

## Unfair Advantage

1. **Standardized stack:** n8n + Claude + GHL works for 90% of use cases. No custom dev. Repeatable.
2. **Speed:** 90 days from audit to full deployment. Most competitors take 6+ months.
3. **Founder understands the market:** Luke runs in this space. Knows the pain points firsthand.
4. **Compound SOPs:** Every deployment makes the next one faster. The agency gets sharper over time.

## Go-To-Market Direction

**First 90 days:**
- Organic: LinkedIn (3x/week thought leadership) + Instagram (daily stories + 3 Reels/week)
- Paid: Meta Ads ($3.5K/month) + LinkedIn Ads ($1.5K/month)
- Lead magnet: Free AI audit calculator
- Conversion: Strategy call booking via Instagram DMs and LinkedIn
- Outbound: Jordan (Sales) running targeted cold DMs to founders who post about hiring pain

## Key Metrics

1. Monthly Recurring Revenue (MRR) - target $100K
2. Active retainer clients - target 33
3. New clients per month - target 3-4
4. Customer Acquisition Cost (CAC) - keep under $2K
5. Client retention rate - target 85%+ at month 4
6. Average payroll savings per client - track and use for case studies
7. Content engagement rate (LinkedIn + IG)
8. Strategy calls booked per week

## Next Steps

1. Marketing to build landing page and launch ads (Maya leading)
2. Sales to build outbound motion targeting coaching founders (Jordan leading)
3. Operations to set up the client delivery framework (Nyx leading)
4. Finance to set up Stripe and build the invoice template (Finley leading)`,
    category: "business",
    tags: ["business-overview", "phase:product"],
    createdByName: "Rory",
    createdByAgentId: rory.id,
  })

  // ── Seed company memories ───────────────────────────────
  console.log("Seeding company memories...")
  await db.insert(companyMemories).values([
    { category: "fact", title: "Target customer", content: "Founders/CEOs of info/coaching businesses doing $2.5M-$4M annually, 10-15 team members, $40K-$80K monthly payroll", importance: 0.9, source: "agent", sourceAgentId: rory.id },
    { category: "fact", title: "Core problem", content: "Can't scale without adding headcount. Every new client means hiring another VA or setter. Quality drops as team grows.", importance: 0.9, source: "agent", sourceAgentId: rory.id },
    { category: "fact", title: "Offer", content: "90-day DFY AI deployment: audit (2 weeks), build (4 weeks), optimize (6 weeks). n8n + Claude + GHL stack.", importance: 0.9, source: "agent", sourceAgentId: rory.id },
    { category: "fact", title: "Pricing", content: "$5K setup + $3K/month retainer. 4-8x ROI for the client.", importance: 0.9, source: "agent", sourceAgentId: rory.id },
    { category: "fact", title: "Revenue goal", content: "$100K MRR in 6 months. Requires 33 active retainer clients at $3K each.", importance: 0.8, source: "agent", sourceAgentId: rory.id },
    { category: "fact", title: "Marketing budget", content: "$5K/month ad spend. $3.5K Meta, $1.5K LinkedIn. Plus organic on IG and LinkedIn.", importance: 0.8, source: "agent", sourceAgentId: maya.id },
  ])

  // ── Seed workflow state ─────────────────────────────────
  console.log("Setting workflow state...")
  await ensureWorkflowInitialized(ws.id)

  // Mark all 4 product definition outputs as provided
  await upsertPhaseOutput(ws.id, "product", "target_customer", { status: "provided", value: "Info/coaching founders, $2.5M-$4M/year, 10-15 team members", sourceType: "company_memory" })
  await upsertPhaseOutput(ws.id, "product", "problem_solved", { status: "provided", value: "Can't scale without adding headcount. AI exists but no framework to implement it.", sourceType: "company_memory" })
  await upsertPhaseOutput(ws.id, "product", "offer_sketch", { status: "provided", value: "90-day DFY AI deployment. Audit, build, optimize. n8n + Claude + GHL stack.", sourceType: "company_memory" })
  await upsertPhaseOutput(ws.id, "product", "price_range", { status: "provided", value: "$5K setup + $3K/month retainer. 4-8x ROI.", sourceType: "company_memory" })

  // Record gate approval and advance to research phase
  const { recordPhaseGate, advancePhase } = await import("../src/lib/workflow-engine")
  await recordPhaseGate(ws.id, "product", "approved", "Business overview approved by founder")
  await advancePhase(ws.id)

  // ── Seed handoff event ──────────────────────────────────
  await db.insert(handoffEvents).values({
    workspaceId: ws.id,
    fromAgentId: rory.id, fromAgentName: "Rory",
    toAgentId: maya.id, toAgentName: "Maya",
    toDepartment: "Marketing",
    summary: "Product definition complete. All 4 pillars locked. Business Overview doc created.",
    nextSteps: "Build go-to-market strategy. Define channels, budget, messaging. Create landing page.",
  })

  // ── Seed department goals ───────────────────────────────
  console.log("Setting department goals...")
  await db.insert(teamGoals).values([
    { teamId: rdTeam.id, title: "Complete Business Overview", target: 1, progress: 1, unit: "documents", status: "completed" },
    { teamId: mktTeam.id, title: "Launch landing page", target: 1, progress: 0, unit: "pages", status: "active" },
    { teamId: mktTeam.id, title: "Define content calendar", target: 1, progress: 0, unit: "calendars", status: "active" },
    { teamId: salesTeam.id, title: "Build outbound pipeline", target: 50, progress: 0, unit: "prospects", status: "active" },
  ])

  // ── Seed activity log ───────────────────────────────────
  console.log("Seeding activity log...")
  await db.insert(activityLog).values([
    { agentId: rory.id, agentName: "Rory", action: "created_document", description: 'Created "Business Overview: ScaleForce AI"' },
    { agentId: rory.id, agentName: "Rory", action: "milestone", description: "🏆 Business Overview Complete" },
    { agentId: rory.id, agentName: "Rory", action: "handoff", description: "Handed off to Marketing" },
    { agentId: maya.id, agentName: "Maya", action: "milestone", description: "📣 Marketing is Now Active" },
    { agentId: maya.id, agentName: "Maya", action: "set_goal", description: "Set goal: Launch landing page (1 pages)" },
    { agentId: jordan.id, agentName: "Jordan", action: "set_goal", description: "Set goal: Build outbound pipeline (50 prospects)" },
  ])

  // ── Seed playbooks ──────────────────────────────────────
  console.log("Seeding playbooks...")
  try {
    const { seedPlaybooks } = await import("../src/lib/seed-playbooks")
    const count = await seedPlaybooks()
    console.log(`  Seeded ${count} playbooks`)
  } catch {
    console.log("  Playbook seeding skipped (files not found)")
  }

  console.log("\n✅ Demo seeded successfully!")
  console.log(`Workspace: ${ws.name} (${ws.id})`)
  console.log(`Teams: 5 | Agents: 6 | Channels: 9`)
  console.log(`Messages: ${rdMsgs.length + tlMsgs.length + mktMsgs.length + winMsgs.length}`)
  console.log(`Phase: research (product definition complete)`)
  console.log(`\nChannels with activity:`)
  console.log(`  #team-leaders: Nova coordinating, R&D handoff, team standing by`)
  console.log(`  #research-&-development: Full R&D conversation (16 messages)`)
  console.log(`  #marketing: Maya asking about budget and strategy`)
  console.log(`  #wins: 3 celebrations`)
  console.log(`  Others: Empty (ready for future work)`)
}

main().then(() => process.exit(0)).catch((e) => { console.error("FAILED:", e); process.exit(1) })
