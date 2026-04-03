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
  await db.delete(schema.activityLog)
  await db.delete(schema.knowledgeEntries)
  await db.delete(schema.agentSops)
  await db.delete(schema.messages)
  await db.delete(schema.tasks)
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

  // Insert agents — team leads marked with isTeamLead: true
  const agentData = [
    { name: "Maya", role: "Content Writer", avatar: "MW", pixelAvatarIndex: 0, provider: "anthropic", model: "Claude Sonnet", status: "working", teamId: marketing.id, currentTask: "Writing blog post on Q1 growth strategies", skills: ["Writing", "SEO", "Research", "Content Strategy"], isTeamLead: true, tasksCompleted: 142, costThisMonth: 28.5 },
    { name: "Alex", role: "SEO Analyst", avatar: "SA", pixelAvatarIndex: 1, provider: "openai", model: "GPT-4o", status: "idle", teamId: marketing.id, currentTask: null, skills: ["SEO Audit", "Keyword Research", "Analytics", "Competitor Analysis"], tasksCompleted: 89, costThisMonth: 15.2 },
    { name: "Zara", role: "Social Media Manager", avatar: "SM", pixelAvatarIndex: 2, provider: "anthropic", model: "Claude Haiku", status: "working", teamId: marketing.id, currentTask: "Scheduling Instagram posts for next week", skills: ["Social Media", "Copywriting", "Image Selection", "Scheduling"], tasksCompleted: 234, costThisMonth: 8.9 },
    { name: "Jordan", role: "Lead Researcher", avatar: "LR", pixelAvatarIndex: 3, provider: "anthropic", model: "Claude Opus", status: "working", teamId: sales.id, currentTask: "Researching prospects in fintech vertical", skills: ["Web Research", "Lead Scoring", "CRM Integration", "Data Enrichment"], isTeamLead: true, tasksCompleted: 312, costThisMonth: 45.0 },
    { name: "Riley", role: "Outreach Specialist", avatar: "OS", pixelAvatarIndex: 4, provider: "openai", model: "GPT-4o", status: "idle", teamId: sales.id, currentTask: null, skills: ["Email Writing", "Follow-ups", "Personalization", "A/B Testing"], tasksCompleted: 567, costThisMonth: 22.3 },
    { name: "Sam", role: "CRM Manager", avatar: "CM", pixelAvatarIndex: 5, provider: "custom", model: "n8n Workflow", status: "working", teamId: sales.id, currentTask: "Syncing new leads to GHL", skills: ["CRM Sync", "Data Cleanup", "Pipeline Management"], tasksCompleted: 1205, costThisMonth: 3.5 },
    { name: "Nyx", role: "Automation Architect", avatar: "NX", pixelAvatarIndex: 0, provider: "anthropic", model: "Claude Sonnet", status: "working", teamId: operations.id, currentTask: "Building invoice processing workflow", skills: ["n8n", "Workflow Design", "API Integration", "Error Handling"], isTeamLead: true, tasksCompleted: 78, costThisMonth: 12.0 },
    { name: "Quinn", role: "Process Manager", avatar: "PM", pixelAvatarIndex: 1, provider: "anthropic", model: "Claude Sonnet", status: "paused", teamId: operations.id, currentTask: null, skills: ["Process Optimization", "Documentation", "SOP Creation"], tasksCompleted: 45, costThisMonth: 9.8 },
    { name: "Finley", role: "Bookkeeper", avatar: "BK", pixelAvatarIndex: 2, provider: "custom", model: "n8n Workflow", status: "idle", teamId: finance.id, currentTask: null, skills: ["Bookkeeping", "Categorization", "Reconciliation", "QuickBooks"], isTeamLead: true, tasksCompleted: 890, costThisMonth: 5.2 },
    { name: "Morgan", role: "P&L Generator", avatar: "PL", pixelAvatarIndex: 3, provider: "anthropic", model: "Claude Sonnet", status: "error", teamId: finance.id, currentTask: "Failed: Missing March bank statement", skills: ["Financial Reports", "Data Analysis", "Forecasting"], tasksCompleted: 12, costThisMonth: 4.5 },
    { name: "Casey", role: "Customer Support", avatar: "CS", pixelAvatarIndex: 4, provider: "anthropic", model: "Claude Haiku", status: "working", teamId: fulfillment.id, currentTask: "Responding to 3 support tickets", skills: ["Customer Service", "Ticket Triage", "Knowledge Base", "Escalation"], isTeamLead: true, tasksCompleted: 1847, costThisMonth: 18.9 },
    { name: "Drew", role: "Order Tracker", avatar: "OT", pixelAvatarIndex: 5, provider: "custom", model: "Webhook Agent", status: "working", teamId: fulfillment.id, currentTask: "Monitoring 23 active shipments", skills: ["Order Tracking", "Shipping Updates", "Delay Detection"], tasksCompleted: 3421, costThisMonth: 1.2 },
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

  console.log("Seed complete!")
  console.log(`  ${insertedAgents.length} agents`)
  console.log(`  ${insertedChannels.length} channels`)
  console.log(`  12 tasks`)
}

seed().catch(console.error)
