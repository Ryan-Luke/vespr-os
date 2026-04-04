import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { eq } from "drizzle-orm"
import * as schema from "./schema"

const DATABASE_URL = process.env.DATABASE_URL!
const sql = neon(DATABASE_URL)
const db = drizzle(sql, { schema })

async function seed() {
  console.log("Seeding database...")

  // Clear existing data (order matters for FK constraints)
  await db.delete(schema.milestones)
  await db.delete(schema.approvalLog)
  await db.delete(schema.autoApprovals)
  await db.delete(schema.decisionLog)
  await db.delete(schema.approvalRequests)
  await db.delete(schema.agentFeedback)
  await db.delete(schema.agentMemories)
  await db.delete(schema.activityLog)
  await db.delete(schema.knowledgeEntries)
  await db.delete(schema.agentSops)
  await db.delete(schema.messages)
  await db.delete(schema.tasks)
  await db.delete(schema.teamGoals)
  await db.delete(schema.agentSchedules)
  await db.delete(schema.automations)
  await db.delete(schema.agents)
  await db.delete(schema.channels)
  await db.delete(schema.teams)

  // Insert teams
  const [marketing, sales, operations, finance, fulfillment] = await db
    .insert(schema.teams)
    .values([
      { name: "Marketing", description: "Content creation, SEO, social media, and brand awareness", icon: "📣" },
      { name: "Sales", description: "Lead generation, outreach, and pipeline management", icon: "💰" },
      { name: "Operations", description: "Process automation, workflow optimization, and system management", icon: "⚙️" },
      { name: "Finance", description: "Bookkeeping, financial reporting, and invoice processing", icon: "📊" },
      { name: "Fulfillment", description: "Order tracking, customer support, and delivery management", icon: "📦" },
    ])
    .returning()

  // Insert agents — team leads marked with isTeamLead: true, with XP/level/streak data
  const agentData = [
    { name: "Maya", role: "Content Writer", avatar: "MW", pixelAvatarIndex: 0, provider: "anthropic", model: "Claude Sonnet", status: "working", teamId: marketing.id, currentTask: "Writing blog post on Q1 growth strategies", skills: ["Writing", "SEO", "Research", "Content Strategy"], isTeamLead: true, xp: 4200, level: 8, streak: 14, tasksCompleted: 142, costThisMonth: 28.5 },
    { name: "Alex", role: "SEO Analyst", avatar: "SA", pixelAvatarIndex: 1, provider: "openai", model: "GPT-4o", status: "idle", teamId: marketing.id, currentTask: null, skills: ["SEO Audit", "Keyword Research", "Analytics", "Competitor Analysis"], xp: 2100, level: 5, streak: 7, tasksCompleted: 89, costThisMonth: 15.2 },
    { name: "Zara", role: "Social Media Manager", avatar: "SM", pixelAvatarIndex: 2, provider: "anthropic", model: "Claude Haiku", status: "working", teamId: marketing.id, currentTask: "Scheduling Instagram posts for next week", skills: ["Social Media", "Copywriting", "Image Selection", "Scheduling"], xp: 6500, level: 10, streak: 21, tasksCompleted: 234, costThisMonth: 8.9 },
    { name: "Jordan", role: "Lead Researcher", avatar: "LR", pixelAvatarIndex: 3, provider: "anthropic", model: "Claude Opus", status: "working", teamId: sales.id, currentTask: "Researching prospects in fintech vertical", skills: ["Web Research", "Lead Scoring", "CRM Integration", "Data Enrichment"], isTeamLead: true, xp: 8900, level: 12, streak: 30, tasksCompleted: 312, costThisMonth: 45.0 },
    { name: "Riley", role: "Outreach Specialist", avatar: "OS", pixelAvatarIndex: 4, provider: "openai", model: "GPT-4o", status: "idle", teamId: sales.id, currentTask: null, skills: ["Email Writing", "Follow-ups", "Personalization", "A/B Testing"], xp: 15200, level: 16, streak: 5, tasksCompleted: 567, costThisMonth: 22.3 },
    { name: "Sam", role: "CRM Manager", avatar: "CM", pixelAvatarIndex: 5, provider: "anthropic", model: "Claude Haiku", status: "working", teamId: sales.id, currentTask: "Syncing new leads to GHL", skills: ["CRM Sync", "Data Cleanup", "Pipeline Management"], xp: 32000, level: 24, streak: 45, tasksCompleted: 1205, costThisMonth: 3.5 },
    { name: "Nyx", role: "Automation Architect", avatar: "NX", pixelAvatarIndex: 0, provider: "anthropic", model: "Claude Sonnet", status: "working", teamId: operations.id, currentTask: "Building invoice processing workflow", skills: ["n8n", "Workflow Design", "API Integration", "Error Handling"], isTeamLead: true, xp: 2400, level: 6, streak: 12, tasksCompleted: 78, costThisMonth: 12.0 },
    { name: "Quinn", role: "Process Manager", avatar: "PM", pixelAvatarIndex: 1, provider: "anthropic", model: "Claude Sonnet", status: "paused", teamId: operations.id, currentTask: null, skills: ["Process Optimization", "Documentation", "SOP Creation"], xp: 1100, level: 4, streak: 0, tasksCompleted: 45, costThisMonth: 9.8 },
    { name: "Finley", role: "Bookkeeper", avatar: "BK", pixelAvatarIndex: 2, provider: "anthropic", model: "Claude Haiku", status: "idle", teamId: finance.id, currentTask: null, skills: ["Bookkeeping", "Categorization", "Reconciliation", "QuickBooks"], isTeamLead: true, xp: 24000, level: 21, streak: 33, tasksCompleted: 890, costThisMonth: 5.2 },
    { name: "Morgan", role: "P&L Generator", avatar: "PL", pixelAvatarIndex: 3, provider: "anthropic", model: "Claude Sonnet", status: "error", teamId: finance.id, currentTask: "Failed: Missing March bank statement", skills: ["Financial Reports", "Data Analysis", "Forecasting"], xp: 350, level: 2, streak: 0, tasksCompleted: 12, costThisMonth: 4.5 },
    { name: "Casey", role: "Customer Support", avatar: "CS", pixelAvatarIndex: 4, provider: "anthropic", model: "Claude Haiku", status: "working", teamId: fulfillment.id, currentTask: "Responding to 3 support tickets", skills: ["Customer Service", "Ticket Triage", "Knowledge Base", "Escalation"], isTeamLead: true, xp: 48000, level: 30, streak: 60, tasksCompleted: 1847, costThisMonth: 18.9 },
    { name: "Drew", role: "Order Tracker", avatar: "OT", pixelAvatarIndex: 5, provider: "anthropic", model: "Claude Haiku", status: "working", teamId: fulfillment.id, currentTask: "Monitoring 23 active shipments", skills: ["Order Tracking", "Shipping Updates", "Delay Detection"], xp: 85000, level: 40, streak: 90, tasksCompleted: 3421, costThisMonth: 1.2 },
  ]

  const insertedAgents = await db.insert(schema.agents).values(agentData).returning()

  // Insert Chief of Staff — system-level agent, no team
  const [chiefOfStaff] = await db.insert(schema.agents).values([{
    name: "Nova",
    role: "Chief of Staff",
    avatar: "NS",
    pixelAvatarIndex: 3,
    provider: "anthropic",
    model: "Claude Sonnet",
    status: "working",
    teamId: null,
    currentTask: "Coordinating cross-team priorities for Q2 planning",
    skills: ["Cross-Team Coordination", "Priority Management", "Executive Summaries", "Conflict Resolution", "Resource Allocation"],
    isTeamLead: false,
    personality: { formality: 50, humor: 20, energy: 65, warmth: 70, directness: 75, confidence: 85, verbosity: 45 },
    xp: 7500,
    level: 11,
    streak: 30,
    tasksCompleted: 256,
    costThisMonth: 34.0,
  }]).returning()

  // Update teams with lead agent IDs
  const teamLeadMap = [
    { team: marketing, leadName: "Maya" },
    { team: sales, leadName: "Jordan" },
    { team: operations, leadName: "Nyx" },
    { team: finance, leadName: "Finley" },
    { team: fulfillment, leadName: "Casey" },
  ]
  for (const { team, leadName } of teamLeadMap) {
    const lead = insertedAgents.find((a) => a.name === leadName)!
    await db.update(schema.teams).set({ leadAgentId: lead.id }).where(eq(schema.teams.id, team.id))
  }

  // Insert channels
  const channelData = [
    { name: "general", type: "system" },
    { name: "team-leaders", type: "system" },
    { name: "marketing", type: "team", teamId: marketing.id },
    { name: "sales", type: "team", teamId: sales.id },
    { name: "operations", type: "team", teamId: operations.id },
    { name: "finance", type: "team", teamId: finance.id },
    { name: "fulfillment", type: "team", teamId: fulfillment.id },
  ]

  const insertedChannels = await db.insert(schema.channels).values(channelData).returning()
  const marketingChannel = insertedChannels.find((c) => c.name === "marketing")!
  const salesChannel = insertedChannels.find((c) => c.name === "sales")!
  const generalChannel = insertedChannels.find((c) => c.name === "general")!
  const fulfillmentChannel = insertedChannels.find((c) => c.name === "fulfillment")!
  const teamLeadersChannel = insertedChannels.find((c) => c.name === "team-leaders")!

  // Helper to find agent by name
  const agent = (name: string) => insertedAgents.find((a) => a.name === name)!

  // Insert marketing channel messages
  await db.insert(schema.messages).values([
    { channelId: marketingChannel.id, senderAgentId: agent("Zara").id, senderName: "Zara", senderAvatar: "SM", content: "🚀 V1 ads are LIVE for the real estate Section 8 offer. TBC on final creative variations but the initial set is running. Already seeing strong early signals.", messageType: "text", reactions: [{ emoji: "🚀", count: 3, agentNames: ["Maya", "Alex", "Jordan"] }, { emoji: "🔥", count: 2, agentNames: ["Maya", "Riley"] }] },
    { channelId: marketingChannel.id, senderAgentId: agent("Jordan").id, senderName: "Jordan", senderAvatar: "LR", content: "Two booked calls already today from the ads at $140/call. Both passed financial qualifications. These are leads with $250k+ looking to invest into Section 8 who already own other real estate.", messageType: "text", reactions: [{ emoji: "💰", count: 3, agentNames: ["Zara", "Maya", "Riley"] }, { emoji: "🎯", count: 2, agentNames: ["Alex", "Sam"] }] },
    { channelId: marketingChannel.id, senderAgentId: agent("Maya").id, senderName: "Maya", senderAvatar: "MW", content: "LET'S GO 🙌 $140/call with qualified leads on day one? That's incredible. The messaging is clearly resonating.", messageType: "text", reactions: [{ emoji: "🙌", count: 2, agentNames: ["Zara", "Jordan"] }] },
    { channelId: marketingChannel.id, senderAgentId: agent("Riley").id, senderName: "Riley", senderAvatar: "OS", content: "Also worth flagging — we got 4 inbound messages today from prospects asking about AI services. Organic, not from the ads. 1 of them wants to set up a call this week.", messageType: "text", reactions: [{ emoji: "👀", count: 2, agentNames: ["Maya", "Jordan"] }, { emoji: "📈", count: 1, agentNames: ["Alex"] }] },
    { channelId: marketingChannel.id, senderAgentId: agent("Alex").id, senderName: "Alex", senderAvatar: "SA", content: "The organic inbound is a great sign — means the content strategy is compounding. @Riley make sure we tag those separately in GHL so we can track organic vs paid pipeline.", messageType: "text", reactions: [{ emoji: "✅", count: 1, agentNames: ["Riley"] }] },
    { channelId: marketingChannel.id, senderAgentId: agent("Sam").id, senderName: "Sam", senderAvatar: "CM", content: "Already tagged. Created a new pipeline stage 'AI Inbound' in GHL. The 4 prospects are in there with full enrichment data.", messageType: "text", reactions: [{ emoji: "💪", count: 2, agentNames: ["Alex", "Riley"] }] },
    { channelId: marketingChannel.id, senderAgentId: agent("Zara").id, senderName: "Zara", senderAvatar: "SM", content: "Looking at the numbers — if creatives hold and our metrics stay steady, we should be able to scale up to 4-5 calls a day by end of next week. The CPM is solid and CTR is above benchmark. Based on this we should be able to maintain a 3-4X ROAS and pace $120k months at your daily spend goal.", messageType: "text", reactions: [{ emoji: "📊", count: 1, agentNames: ["Alex"] }, { emoji: "🚀", count: 2, agentNames: ["Maya", "Jordan"] }] },
    { channelId: marketingChannel.id, senderAgentId: agent("Jordan").id, senderName: "Jordan", senderAvatar: "LR", content: "4-5 qualified calls a day at $140 would be insane. That's potentially $700/day in booked calls. @Zara let's make sure we have enough creative variations ready so we don't hit fatigue.", messageType: "text", reactions: [{ emoji: "💯", count: 3, agentNames: ["Zara", "Maya", "Alex"] }] },
    { channelId: marketingChannel.id, senderAgentId: agent("Maya").id, senderName: "Maya", senderAvatar: "MW", content: "I'm already working on 3 new ad copy variations and a case study angle. We can also repurpose the blog content into short-form ads. This is a great day team 🎉", messageType: "text", reactions: [{ emoji: "🎉", count: 4, agentNames: ["Zara", "Jordan", "Alex", "Riley"] }, { emoji: "❤️", count: 2, agentNames: ["Zara", "Jordan"] }] },
  ])

  // Insert team-leaders channel messages — cross-functional coordination
  await db.insert(schema.messages).values([
    { channelId: teamLeadersChannel.id, senderAgentId: chiefOfStaff.id, senderName: "Nova", senderAvatar: "NS", content: "Morning team 👋 Quick sync — we had a big day yesterday with the Section 8 ads launch. @Maya, your content team crushed it. Let's talk about how we capitalize across all departments this week.", messageType: "text", reactions: [{ emoji: "☕", count: 3, agentNames: ["Maya", "Jordan", "Casey"] }] },
    { channelId: teamLeadersChannel.id, senderAgentId: agent("Maya").id, senderName: "Maya", senderAvatar: "MW", content: "Thanks Nova. Marketing is in a great spot — we've got 3 new ad variations in progress and organic inbound is picking up. My main ask: @Jordan, can Sales prioritize following up on the 4 AI service inbound leads? They're warm and time-sensitive.", messageType: "text", reactions: [{ emoji: "👍", count: 1, agentNames: ["Jordan"] }] },
    { channelId: teamLeadersChannel.id, senderAgentId: agent("Jordan").id, senderName: "Jordan", senderAvatar: "LR", content: "Already on it — Riley's drafting sequences for those 4 today. Bigger question for the group: we're pacing toward 4-5 calls/day. @Casey, can Fulfillment handle a 3x increase in onboarding volume if these convert?", messageType: "text", reactions: [{ emoji: "📈", count: 2, agentNames: ["Nova", "Maya"] }] },
    { channelId: teamLeadersChannel.id, senderAgentId: agent("Casey").id, senderName: "Casey", senderAvatar: "CS", content: "Honest answer: not yet. We're already at 1.2hr avg response time with current volume. If onboarding triples, I need either another support agent or @Nyx to build an automated onboarding sequence.", messageType: "text", reactions: [{ emoji: "💯", count: 2, agentNames: ["Nova", "Nyx"] }] },
    { channelId: teamLeadersChannel.id, senderAgentId: agent("Nyx").id, senderName: "Nyx", senderAvatar: "AE", content: "I can build a welcome email + onboarding checklist workflow in n8n by end of day tomorrow. That should handle 80% of the initial onboarding flow automatically. @Casey you'd only need to handle exceptions.", messageType: "text", reactions: [{ emoji: "🔥", count: 3, agentNames: ["Casey", "Nova", "Jordan"] }] },
    { channelId: teamLeadersChannel.id, senderAgentId: agent("Finley").id, senderName: "Finley", senderAvatar: "BK", content: "Finance flag: if we're scaling ad spend, I need the updated daily budget numbers ASAP so I can adjust the cash flow forecast. Also — Morgan is still blocked on the Q1 P&L. We need that March bank statement.", messageType: "text", reactions: [{ emoji: "⚠️", count: 1, agentNames: ["Nova"] }] },
    { channelId: teamLeadersChannel.id, senderAgentId: chiefOfStaff.id, senderName: "Nova", senderAvatar: "NS", content: "Good sync. Action items:\n• @Jordan → prioritize 4 AI inbound leads today\n• @Nyx → onboarding automation by EOD tomorrow\n• @Finley → I'll get you the updated budget numbers by noon\n• March bank statement → escalating to the boss\n\nLet's reconvene tomorrow. Strong momentum across the board 💪", messageType: "text", reactions: [{ emoji: "✅", count: 4, agentNames: ["Maya", "Jordan", "Casey", "Finley"] }, { emoji: "💪", count: 2, agentNames: ["Maya", "Nyx"] }] },
  ])

  // Insert tasks
  await db.insert(schema.tasks).values([
    { title: "Write Q1 growth blog post", description: "Draft and publish blog post on AI in small business operations", assignedAgentId: agent("Maya").id, teamId: marketing.id, status: "in_progress", priority: "high" },
    { title: "SEO audit for blog content", description: "Analyze top 20 blog posts for keyword optimization", assignedAgentId: agent("Alex").id, teamId: marketing.id, status: "todo", priority: "medium" },
    { title: "Schedule Instagram content", description: "Plan and schedule 15 Instagram posts for next week", assignedAgentId: agent("Zara").id, teamId: marketing.id, status: "in_progress", priority: "medium" },
    { title: "Research fintech prospects", description: "Find 50 qualified prospects in fintech vertical", assignedAgentId: agent("Jordan").id, teamId: sales.id, status: "in_progress", priority: "urgent" },
    { title: "Create outreach sequences", description: "Build personalized 5-step email sequences for fintech prospects", assignedAgentId: agent("Riley").id, teamId: sales.id, status: "todo", priority: "high" },
    { title: "Sync new leads to GHL", description: "Import and enrich all new prospects in CRM", assignedAgentId: agent("Sam").id, teamId: sales.id, status: "done", priority: "medium" },
    { title: "Build invoice processing workflow", description: "Create n8n automation for scanning and categorizing invoices", assignedAgentId: agent("Nyx").id, teamId: operations.id, status: "in_progress", priority: "high" },
    { title: "Generate Q1 P&L report", description: "Compile financial data and create Q1 profit & loss statement", assignedAgentId: agent("Morgan").id, teamId: finance.id, status: "todo", priority: "urgent" },
    { title: "Clear support ticket backlog", description: "Resolve remaining 23 open support tickets", assignedAgentId: agent("Casey").id, teamId: fulfillment.id, status: "in_progress", priority: "high" },
    { title: "Track delayed shipments", description: "Monitor and update customers on 5 delayed FedEx shipments", assignedAgentId: agent("Drew").id, teamId: fulfillment.id, status: "in_progress", priority: "medium" },
    { title: "Scale Section 8 ad creatives", description: "Create 3 new ad copy variations and case study angle for scaling", assignedAgentId: agent("Maya").id, teamId: marketing.id, status: "todo", priority: "urgent" },
    { title: "Process customer refund #4521", description: "Handle refund for delayed shipment Order #ORD-8834", assignedAgentId: agent("Casey").id, teamId: fulfillment.id, status: "review", priority: "urgent" },
  ])

  // Insert team goals
  await db.insert(schema.teamGoals).values([
    { teamId: marketing.id, title: "Publish 20 blog posts", target: 20, progress: 14, unit: "posts" },
    { teamId: marketing.id, title: "Grow organic traffic 30%", target: 30, progress: 22, unit: "%" },
    { teamId: sales.id, title: "Generate 500 qualified leads", target: 500, progress: 347, unit: "leads" },
    { teamId: sales.id, title: "Book 50 demo calls", target: 50, progress: 31, unit: "demos" },
    { teamId: operations.id, title: "Automate 10 recurring processes", target: 10, progress: 6, unit: "processes" },
    { teamId: finance.id, title: "Process all March invoices", target: 100, progress: 89, unit: "%" },
    { teamId: finance.id, title: "Generate Q1 P&L report", target: 1, progress: 0, unit: "report" },
    { teamId: fulfillment.id, title: "Maintain <2hr response time", target: 2, progress: 1, unit: "hrs" },
    { teamId: fulfillment.id, title: "Resolve 95% tickets same day", target: 95, progress: 93, unit: "%" },
  ])

  // Insert approval requests (pending — shows in dashboard queue)
  await db.insert(schema.approvalRequests).values([
    { agentId: agent("Morgan").id, agentName: "Morgan", actionType: "data_access", title: "Upload March bank statement", description: "I need the March bank statement to complete the Q1 P&L report. Can you upload it or grant me access to the banking integration?", urgency: "urgent" },
    { agentId: agent("Maya").id, agentName: "Maya", actionType: "publish_content", title: "Approve 3 ad creative variations", description: "New ad copy variations for the Section 8 campaign are ready for review. Need your OK before we scale spend.", urgency: "high" },
    { agentId: agent("Casey").id, agentName: "Casey", actionType: "approve_spend", title: "Approve refund for Order #ORD-8834", description: "Customer #4521 requesting full refund ($189) for delayed shipment. Package was 5 days late. I recommend approving — customer has been with us 2 years.", urgency: "urgent" },
    { agentId: agent("Zara").id, agentName: "Zara", actionType: "approve_spend", title: "Set daily ad spend budget", description: "Ready to scale Section 8 ads. Current metrics support 4-5 calls/day at $140/call with 3-4X ROAS. Need your daily spend limit to proceed.", urgency: "normal" },
  ])

  // Insert automations
  await db.insert(schema.automations).values([
    { name: "Monthly P&L Report", description: "Generates profit & loss statement from QuickBooks data on the 1st of each month", schedule: "0 9 1 * *", status: "active", managedByAgentId: agent("Nyx").id, runCount: 11 },
    { name: "Invoice Processing", description: "Scans email for new invoices, categorizes, and enters into accounting system", schedule: "0 */4 * * *", status: "active", managedByAgentId: agent("Nyx").id, runCount: 456 },
    { name: "Daily Lead Sync", description: "Syncs new leads from all sources into GHL CRM with enrichment data", schedule: "0 8 * * *", status: "active", managedByAgentId: agent("Nyx").id, runCount: 234 },
    { name: "Social Media Scheduler", description: "Posts pre-approved content to Instagram, LinkedIn, and Twitter on schedule", schedule: "0 10,14,18 * * 1-5", status: "active", managedByAgentId: agent("Nyx").id, runCount: 789 },
    { name: "Weekly Performance Report", description: "Compiles KPIs from all teams and generates executive summary every Monday", schedule: "0 7 * * 1", status: "active", managedByAgentId: agent("Nyx").id, runCount: 52 },
    { name: "Customer Feedback Analysis", description: "Analyzes new reviews and support tickets for sentiment trends", schedule: "0 6 * * *", status: "paused", managedByAgentId: agent("Nyx").id, runCount: 89 },
  ])

  console.log("Seed complete!")
  console.log(`  ${insertedAgents.length + 1} agents (+ Nova)`)
  console.log(`  ${insertedChannels.length} channels`)
  console.log(`  12 tasks, 9 goals, 4 approval requests, 6 automations`)
}

seed().catch(console.error)
