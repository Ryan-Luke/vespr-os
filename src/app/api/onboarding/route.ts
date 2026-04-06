import { db } from "@/lib/db"
import { agents, teams, channels, messages, tasks, agentSops, knowledgeEntries, workspaces } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { PERSONALITY_PRESETS } from "@/lib/personality-presets"
import { getStarterContent } from "@/lib/onboarding-starter-content"
import { ensureWorkflowInitialized } from "@/lib/workflow-engine"
import { seedPlaybooks } from "@/lib/seed-playbooks"

interface BusinessTemplate {
  id: string
  name: string
  description: string
  icon: string
  teams: {
    name: string
    icon: string
    description: string
    agents: {
      name: string
      role: string
      personalityPresetId: string
      skills: string[]
      isTeamLead?: boolean
      currentTask: string
    }[]
  }[]
}

// R&D team is the entry point for every business (per PVD). Always first in the template.
const RND_TEAM = {
  name: "Research & Development",
  icon: "🧪",
  description: "Product strategy, offer creation, and market research — the entry point for the business",
  agents: [
    { name: "Rory", role: "Head of R&D", personalityPresetId: "paul-graham", skills: ["Market Research", "Product Strategy", "ICP Definition", "Offer Design", "Competitive Analysis"], isTeamLead: true, currentTask: "Preparing initial product discovery session" },
  ],
}

const TEMPLATES: BusinessTemplate[] = [
  {
    id: "ecommerce",
    name: "E-Commerce",
    description: "Online store with R&D, marketing, sales, ops, fulfillment, and finance leads",
    icon: "🛒",
    teams: [
      RND_TEAM,
      { name: "Marketing", icon: "📣", description: "Drive traffic, content, and brand awareness", agents: [
        { name: "Maya", role: "Head of Marketing", personalityPresetId: "leslie-knope", skills: ["Content Strategy", "SEO", "Paid Ads", "Social Media", "Brand"], isTeamLead: true, currentTask: "Developing go-to-market strategy" },
      ]},
      { name: "Sales", icon: "💰", description: "Lead generation, outreach, and conversion", agents: [
        { name: "Jordan", role: "Head of Sales", personalityPresetId: "sherlock", skills: ["Lead Generation", "Outreach", "Pipeline Management", "CRM", "Closing"], isTeamLead: true, currentTask: "Building initial sales pipeline" },
      ]},
      { name: "Operations", icon: "⚙️", description: "Automations, processes, and system management", agents: [
        { name: "Nyx", role: "Head of Operations", personalityPresetId: "tony-stark", skills: ["Workflow Design", "Automation", "Process Optimization", "Systems"], isTeamLead: true, currentTask: "Mapping core business processes" },
      ]},
      { name: "Fulfillment", icon: "📦", description: "Order tracking, shipping, and customer support", agents: [
        { name: "Casey", role: "Head of Fulfillment", personalityPresetId: "samwise", skills: ["Customer Support", "Order Management", "Shipping", "Quality Control"], isTeamLead: true, currentTask: "Setting up fulfillment workflows" },
      ]},
      { name: "Finance", icon: "📊", description: "Bookkeeping, reporting, and invoicing", agents: [
        { name: "Finley", role: "Head of Finance", personalityPresetId: "ron-swanson", skills: ["Bookkeeping", "Financial Reporting", "Budgeting", "Invoicing"], isTeamLead: true, currentTask: "Setting up financial tracking" },
      ]},
    ],
  },
  {
    id: "agency",
    name: "Agency / Services",
    description: "Client services with R&D, account management, creative, delivery, and growth leads",
    icon: "🏢",
    teams: [
      RND_TEAM,
      { name: "Account Management", icon: "🤝", description: "Client relationships and communication", agents: [
        { name: "Elena", role: "Account Director", personalityPresetId: "obi-wan", skills: ["Client Relations", "Project Scoping", "Negotiation", "Retention"], isTeamLead: true, currentTask: "Preparing client onboarding process" },
      ]},
      { name: "Creative", icon: "🎨", description: "Design, copy, and creative production", agents: [
        { name: "Aria", role: "Creative Director", personalityPresetId: "willy-wonka", skills: ["Creative Strategy", "Brand Identity", "Copywriting", "Art Direction"], isTeamLead: true, currentTask: "Defining creative standards and templates" },
      ]},
      { name: "Delivery", icon: "🚀", description: "Project execution and quality assurance", agents: [
        { name: "Dev", role: "Head of Delivery", personalityPresetId: "captain-america", skills: ["Project Management", "Timeline Tracking", "QA", "Resource Allocation"], isTeamLead: true, currentTask: "Building project delivery framework" },
      ]},
      { name: "Growth", icon: "📈", description: "New business development and marketing", agents: [
        { name: "Blake", role: "Head of Growth", personalityPresetId: "alex-hormozi", skills: ["Prospecting", "Proposals", "Pipeline Management", "Content Marketing"], isTeamLead: true, currentTask: "Developing new business strategy" },
      ]},
    ],
  },
  {
    id: "saas",
    name: "SaaS / Tech",
    description: "Software company with R&D, product, engineering, growth, and customer success leads",
    icon: "💻",
    teams: [
      RND_TEAM,
      { name: "Product", icon: "🎯", description: "Product strategy, roadmap, and user research", agents: [
        { name: "Sage", role: "Head of Product", personalityPresetId: "steve-jobs", skills: ["User Research", "Roadmapping", "Prioritization", "Product Strategy"], isTeamLead: true, currentTask: "Defining product vision and roadmap" },
      ]},
      { name: "Engineering", icon: "⚡", description: "Development, infrastructure, and technical operations", agents: [
        { name: "Atlas", role: "Head of Engineering", personalityPresetId: "gandalf", skills: ["Architecture", "Code Review", "Technical Planning", "DevOps"], isTeamLead: true, currentTask: "Setting up technical architecture" },
      ]},
      { name: "Growth", icon: "📣", description: "Marketing, content, and user acquisition", agents: [
        { name: "Blaze", role: "Head of Growth", personalityPresetId: "gary-vee", skills: ["Content Marketing", "SEO", "Paid Ads", "Community Building"], isTeamLead: true, currentTask: "Developing acquisition strategy" },
      ]},
      { name: "Customer Success", icon: "💚", description: "Onboarding, support, and retention", agents: [
        { name: "Harper", role: "Head of Customer Success", personalityPresetId: "leslie-knope", skills: ["Onboarding", "Churn Prevention", "Support", "Health Scoring"], isTeamLead: true, currentTask: "Designing customer onboarding flow" },
      ]},
    ],
  },
  {
    id: "content",
    name: "Content Creator / Info Product",
    description: "Personal brand with R&D, content, distribution, monetization, and community leads",
    icon: "🎬",
    teams: [
      RND_TEAM,
      { name: "Content", icon: "✍️", description: "Writing, video, and multimedia production", agents: [
        { name: "Luna", role: "Head of Content", personalityPresetId: "taylor-swift", skills: ["Content Strategy", "Writing", "Video", "Editorial Calendar"], isTeamLead: true, currentTask: "Planning content strategy and themes" },
      ]},
      { name: "Distribution", icon: "📡", description: "Platform management and audience growth", agents: [
        { name: "Amp", role: "Head of Distribution", personalityPresetId: "han-solo", skills: ["Social Media", "Cross-Posting", "Analytics", "Growth Hacking"], isTeamLead: true, currentTask: "Mapping distribution channels and schedule" },
      ]},
      { name: "Monetization", icon: "💰", description: "Products, partnerships, and revenue", agents: [
        { name: "Cash", role: "Head of Revenue", personalityPresetId: "alex-hormozi", skills: ["Product Launches", "Partnerships", "Pricing", "Funnels"], isTeamLead: true, currentTask: "Designing monetization strategy" },
      ]},
      { name: "Community", icon: "💬", description: "Audience engagement and community management", agents: [
        { name: "Vibe", role: "Head of Community", personalityPresetId: "bob-ross", skills: ["Community Building", "DM Management", "Events", "Moderation"], isTeamLead: true, currentTask: "Setting up community engagement plan" },
      ]},
    ],
  },
  {
    id: "consulting",
    name: "Consulting / Coaching",
    description: "Knowledge business with R&D, client delivery, marketing, and operations leads",
    icon: "🎓",
    teams: [
      RND_TEAM,
      { name: "Client Delivery", icon: "🎯", description: "Client work, coaching sessions, and deliverables", agents: [
        { name: "Sage", role: "Head of Client Delivery", personalityPresetId: "ray-dalio", skills: ["Strategy", "Analysis", "Frameworks", "Coaching", "Presentations"], isTeamLead: true, currentTask: "Building client delivery framework" },
      ]},
      { name: "Marketing", icon: "📣", description: "Lead generation, thought leadership, and brand", agents: [
        { name: "Maya", role: "Head of Marketing", personalityPresetId: "paul-graham", skills: ["Thought Leadership", "Content Marketing", "Funnels", "Email"], isTeamLead: true, currentTask: "Developing thought leadership strategy" },
      ]},
      { name: "Operations", icon: "⚙️", description: "Admin, billing, and process management", agents: [
        { name: "Iris", role: "Head of Operations", personalityPresetId: "hermione", skills: ["Invoicing", "Contracts", "CRM Management", "Scheduling"], isTeamLead: true, currentTask: "Setting up operational systems" },
      ]},
    ],
  },
  {
    id: "service",
    name: "Service-Based",
    description: "Done-for-you services (agencies, freelancing, local services) with R&D, sales, delivery, and ops leads",
    icon: "🛠️",
    teams: [
      RND_TEAM,
      { name: "Sales", icon: "💰", description: "Lead generation, discovery calls, and closing", agents: [
        { name: "Jordan", role: "Head of Sales", personalityPresetId: "alex-hormozi", skills: ["Lead Generation", "Discovery Calls", "Proposals", "Closing"], isTeamLead: true, currentTask: "Building sales pipeline" },
      ]},
      { name: "Delivery", icon: "🚀", description: "Client work execution and project management", agents: [
        { name: "Dev", role: "Head of Delivery", personalityPresetId: "captain-america", skills: ["Project Management", "Client Management", "Quality Control", "Deliverables"], isTeamLead: true, currentTask: "Setting up delivery framework" },
      ]},
      { name: "Operations", icon: "⚙️", description: "Admin, invoicing, and systems", agents: [
        { name: "Nyx", role: "Head of Operations", personalityPresetId: "tony-stark", skills: ["Process Design", "Invoicing", "Contracts", "Automation"], isTeamLead: true, currentTask: "Building operational systems" },
      ]},
      { name: "Finance", icon: "📊", description: "Bookkeeping, billing, and cash flow", agents: [
        { name: "Finley", role: "Head of Finance", personalityPresetId: "ron-swanson", skills: ["Bookkeeping", "Invoicing", "Cash Flow", "Budgeting"], isTeamLead: true, currentTask: "Setting up financial tracking" },
      ]},
    ],
  },
  {
    id: "brick_and_mortar",
    name: "Brick & Mortar",
    description: "Physical location business with R&D, marketing, operations, staff, and finance leads",
    icon: "🏪",
    teams: [
      RND_TEAM,
      { name: "Marketing", icon: "📣", description: "Local marketing, foot traffic, and brand", agents: [
        { name: "Maya", role: "Head of Marketing", personalityPresetId: "leslie-knope", skills: ["Local SEO", "Social Media", "Community Events", "Promotions"], isTeamLead: true, currentTask: "Building local marketing plan" },
      ]},
      { name: "Operations", icon: "⚙️", description: "Daily operations, inventory, and vendor management", agents: [
        { name: "Nyx", role: "Head of Operations", personalityPresetId: "tony-stark", skills: ["Inventory", "Scheduling", "Vendor Management", "Process Design"], isTeamLead: true, currentTask: "Mapping daily operations" },
      ]},
      { name: "Staff", icon: "👥", description: "Hiring, training, and team management", agents: [
        { name: "Aria", role: "Head of Staff", personalityPresetId: "leslie-knope", skills: ["Hiring", "Training", "Scheduling", "Performance Management"], isTeamLead: true, currentTask: "Setting up team systems" },
      ]},
      { name: "Finance", icon: "📊", description: "Bookkeeping, POS, and cash flow", agents: [
        { name: "Finley", role: "Head of Finance", personalityPresetId: "ron-swanson", skills: ["Bookkeeping", "POS Systems", "Cash Flow", "Tax Prep"], isTeamLead: true, currentTask: "Setting up financial tracking" },
      ]},
    ],
  },
]

export async function GET() {
  return Response.json({ templates: TEMPLATES.map(({ id, name, description, icon, teams }) => ({
    id, name, description, icon,
    teamCount: teams.length,
    agentCount: teams.reduce((sum, t) => sum + t.agents.length, 0),
  }))})
}

export async function POST(req: Request) {
  const body = await req.json() as {
    templateId: string
    businessName?: string
    lane?: "new" | "existing"
    businessIdea?: string
    existingTools?: string
    existingPainPoints?: string
    teamSize?: string
    // New fields per PVD onboarding flow
    ownerName?: string
    businessDescription?: string
    businessGoal?: string
    mission?: string
    targetScale?: string
    timeline?: string
    competitors?: Array<{ label: string; url: string }>
    anthropicApiKey?: string
  }
  const { templateId, businessName, lane, businessIdea, existingTools, existingPainPoints, teamSize, ownerName, businessDescription, businessGoal, mission, targetScale, timeline, competitors, anthropicApiKey } = body

  const template = TEMPLATES.find((t) => t.id === templateId)
  if (!template) return Response.json({ error: "Template not found" }, { status: 404 })

  // Single-tenant per deploy: refuse to create a second workspace.
  // Re-running onboarding would stack duplicate workspaces, teams, channels,
  // and agents on top of the existing ones. If the user wants to start over,
  // they must hit /reset first (owner-gated, destructive).
  const existing = await db.select({ id: workspaces.id }).from(workspaces).limit(1)
  if (existing.length > 0) {
    return Response.json(
      { error: "A workspace already exists for this deploy. Use /reset to start over." },
      { status: 409 }
    )
  }

  // Create a new workspace for this business
  const wsName = businessName?.trim() || template.name
  const slug = wsName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6)

  const businessTypeMap: Record<string, string> = {
    ecommerce: "ecommerce",
    saas: "saas",
    agency: "agency",
    consulting: "consulting",
    content: "info_product",
    service: "agency",
    brick_and_mortar: "brick_and_mortar",
  }

  const [newWorkspace] = await db.insert(workspaces).values({
    name: wsName,
    slug,
    icon: template.icon,
    description: businessDescription || businessIdea || template.description,
    businessType: businessTypeMap[templateId] || "other",
    industry: null,
    website: null,
    ownerName: ownerName || null,
    anthropicApiKey: anthropicApiKey || null,
    businessProfile: {
      mission: mission || businessIdea || undefined,
      icp: undefined,
      verticals: [],
      teamSize: teamSize || undefined,
      revenue: undefined,
      tools: existingTools ? existingTools.split(",").map((t) => t.trim()).filter(Boolean) : [],
      goal: businessGoal || undefined,
      targetScale: targetScale || undefined,
      timeline: timeline || undefined,
      competitors: competitors || [],
    },
  }).returning()

  // Create teams scoped to this workspace
  const insertedTeams = await db.insert(teams).values(
    template.teams.map((t) => ({ workspaceId: newWorkspace.id, name: t.name, icon: t.icon, description: t.description }))
  ).returning()

  // Create channels. System channels (wins, watercooler, team-leaders) exist
  // for EVERY business type. Core department channels (marketing, operations,
  // finance, delivery/fulfillment, sales) are always present even if the
  // template names the team differently (Growth instead of Marketing, etc).
  //
  // Each template's teams generate their own channels. After that, we check
  // which core channels are missing and add them as standalone channels.

  const teamChannelNames = insertedTeams.map((t) => t.name.toLowerCase().replace(/\s+/g, "-"))

  // Helper: check if a core department channel already exists from the template
  function hasChannel(keywords: string[]) {
    return teamChannelNames.some((name) =>
      keywords.some((kw) => name.includes(kw)),
    )
  }

  // Core department channels that should always exist. Each entry has the
  // channel name to create and the keywords to check in existing team names.
  const CORE_CHANNELS: { name: string; keywords: string[] }[] = [
    { name: "marketing", keywords: ["marketing", "growth", "content", "distribution"] },
    { name: "operations", keywords: ["operations", "ops"] },
    { name: "finance", keywords: ["finance", "monetization"] },
    { name: "sales", keywords: ["sales", "account-management"] },
    { name: "delivery", keywords: ["delivery", "fulfillment", "client-delivery", "customer-success"] },
  ]

  const missingCoreChannels = CORE_CHANNELS
    .filter((core) => !hasChannel(core.keywords))
    .map((core) => ({ name: core.name, type: "team" as const }))

  const channelValues = [
    { name: "team-leaders", type: "system" as const },
    { name: "wins", type: "system" as const },
    { name: "watercooler", type: "system" as const },
    ...insertedTeams.map((t) => ({ name: t.name.toLowerCase().replace(/\s+/g, "-"), type: "team" as const, teamId: t.id })),
    ...missingCoreChannels,
  ]
  const insertedChannels = await db.insert(channels).values(channelValues).returning()
  const teamLeadersChannel = insertedChannels.find((c) => c.name === "team-leaders")!

  // Create agents. Team leads get unique pixel avatars round-robin across
  // the available sprites so every department head is visually distinct.
  // Nova (Chief of Staff, inserted below) reserves index 3, so leads draw
  // from [0, 1, 2, 4, 5] and wrap if there are more leads than sprites.
  // Non-lead agents keep their preset-assigned or random index.
  const LEAD_SPRITE_POOL = [0, 1, 2, 4, 5]
  let leadSpriteCursor = 0
  const allAgentValues: any[] = []
  for (const teamTemplate of template.teams) {
    const dbTeam = insertedTeams.find((t) => t.name === teamTemplate.name)!
    for (const agentTemplate of teamTemplate.agents) {
      const preset = PERSONALITY_PRESETS.find((p) => p.id === agentTemplate.personalityPresetId)
      const isLead = agentTemplate.isTeamLead ?? false
      const pixelAvatarIndex = isLead
        ? LEAD_SPRITE_POOL[leadSpriteCursor++ % LEAD_SPRITE_POOL.length]
        : (preset?.pixelAvatarIndex ?? Math.floor(Math.random() * 6))
      allAgentValues.push({
        name: agentTemplate.name,
        role: agentTemplate.role,
        avatar: agentTemplate.name.slice(0, 2).toUpperCase(),
        pixelAvatarIndex,
        provider: "anthropic",
        model: "Claude Haiku",
        status: "idle",
        teamId: dbTeam.id,
        currentTask: agentTemplate.currentTask,
        skills: agentTemplate.skills,
        personalityPresetId: agentTemplate.personalityPresetId,
        personality: preset?.traits ?? { formality: 40, humor: 30, energy: 50, warmth: 60, directness: 50, confidence: 50, verbosity: 40 },
        isTeamLead: isLead,
        autonomyLevel: "supervised",
        tasksCompleted: 0,
        costThisMonth: 0,
      })
    }
  }
  const insertedAgents = await db.insert(agents).values(allAgentValues).returning()

  // Create Chief of Staff
  const [chiefOfStaff] = await db.insert(agents).values([{
    name: "Nova",
    role: "Chief of Staff",
    avatar: "NS",
    pixelAvatarIndex: 3,
    provider: "anthropic",
    model: "Claude Sonnet",
    status: "working",
    teamId: null,
    currentTask: "Getting your business set up",
    skills: ["Cross-Team Coordination", "Priority Management", "Executive Summaries"],
    personality: { formality: 50, humor: 20, energy: 65, warmth: 70, directness: 75, confidence: 85, verbosity: 45 },
    isTeamLead: false,
    autonomyLevel: "full_auto",
    tasksCompleted: 0,
    costThisMonth: 0,
  }]).returning()

  // Update teams with lead agent IDs

  for (const teamTemplate of template.teams) {
    const lead = teamTemplate.agents.find((a) => a.isTeamLead)
    if (lead) {
      const dbTeam = insertedTeams.find((t) => t.name === teamTemplate.name)!
      const dbAgent = insertedAgents.find((a) => a.name === lead.name && a.teamId === dbTeam.id)!
      await db.update(teams).set({ leadAgentId: dbAgent.id }).where(eq(teams.id, dbTeam.id))
    }
  }

  // ── First-Run Flow per PVD ─────────────────────────────────
  // Sequence: R&D lead greets user in R&D channel → coordinates in #team-leaders
  // → each dept lead reaches out in their own channel → Nova wraps with goals
  const teamLeads = insertedAgents.filter((a) => a.isTeamLead)
  const bName = businessName || "your business"
  const addressName = ownerName || "boss"

  // Find R&D lead and R&D channel
  const rndLead = teamLeads.find((a) => {
    const team = insertedTeams.find((t) => t.id === a.teamId)
    return team?.name.toLowerCase().includes("research") || team?.name.toLowerCase().includes("r&d")
  })
  const rndChannel = rndLead
    ? insertedChannels.find((c) => c.teamId === rndLead.teamId)
    : null

  // Context summary for agents to reference
  const ctx: string[] = []
  if (businessDescription) ctx.push(`What they do: ${businessDescription}`)
  if (businessGoal) ctx.push(`Goal: ${businessGoal}`)
  if (targetScale) ctx.push(`Target: ${targetScale}`)
  if (timeline) ctx.push(`Timeline: ${timeline}`)
  if (competitors && competitors.length > 0) ctx.push(`Competitors they're watching: ${competitors.map((c) => c.label).join(", ")}`)
  const ctxLine = ctx.length > 0 ? `\n\nHere's what I know so far:\n${ctx.map((c) => `• ${c}`).join("\n")}` : ""

  const welcomeMessages: any[] = []

  // 1. R&D lead reaches out DIRECTLY in R&D channel — the entry point
  if (rndLead && rndChannel) {
    welcomeMessages.push({
      channelId: rndChannel.id,
      senderAgentId: rndLead.id,
      senderName: rndLead.name,
      senderAvatar: rndLead.avatar,
      content: `Hey ${addressName} 👋 I'm ${rndLead.name}, your Head of R&D. Welcome to ${bName} — excited to build this with you.${ctxLine}\n\nI'm going to walk you through defining your first product. We'll answer four questions together:\n\n1. **Who are we selling to?** Your ideal customer\n2. **What problem do we solve?**\n3. **What's the offer?**\n4. **What's the price point?**\n\nOnce we have clarity on this, I'll loop in Marketing, Ops, and Finance to build out the rest of the plan. Reply when you're ready and we'll dig in.`,
      messageType: "text",
    })
  }

  // 2. Nova announces in #team-leaders that R&D is engaging user first
  welcomeMessages.push({
    channelId: teamLeadersChannel.id,
    senderAgentId: chiefOfStaff.id,
    senderName: chiefOfStaff.name,
    senderAvatar: chiefOfStaff.avatar,
    content: `Team — ${addressName} just launched **${bName}**. ${rndLead ? `@${rndLead.name} is running the initial product discovery in #${rndChannel?.name}.` : "We're getting set up."} Everyone else, stand by — I'll coordinate handoffs as R&D wraps up the offer definition. Let's make this count.`,
    messageType: "text",
  })

  // 3. Each other dept lead posts a brief intro in their OWN channel
  //    Per PVD: each lead reaches out directly to user in their channel
  for (const lead of teamLeads) {
    if (lead.id === rndLead?.id) continue
    const team = insertedTeams.find((t) => t.id === lead.teamId)
    const deptChannel = insertedChannels.find((c) => c.teamId === team?.id)
    if (!deptChannel || !team) continue

    welcomeMessages.push({
      channelId: deptChannel.id,
      senderAgentId: lead.id,
      senderName: lead.name,
      senderAvatar: lead.avatar,
      content: `Hey ${addressName} 👋 I'm ${lead.name}, your ${lead.role}. Welcome to ${bName}.\n\n${rndLead ? `I'm standing by — ${rndLead.name} is walking you through the product discovery first. Once we have the offer locked in, I'll reach out here with a plan for ${team.name.toLowerCase()}.` : `I'll reach out here once we're ready to activate ${team.name.toLowerCase()}.`}`,
      messageType: "text",
    })
  }

  await db.insert(messages).values(welcomeMessages)

  // Seed starter content based on business type (knowledge, SOPs, user tasks)
  const starter = getStarterContent(newWorkspace.businessType)

  if (starter.knowledgeEntries.length > 0) {
    await db.insert(knowledgeEntries).values(
      starter.knowledgeEntries.map((k) => ({
        title: k.title,
        content: k.content,
        category: k.category,
        tags: k.tags,
        createdByAgentId: chiefOfStaff.id,
        createdByName: "Nova",
      }))
    )
  }

  if (starter.sops.length > 0) {
    // Match SOPs to appropriate agents by roleHint (fallback: first team lead)
    const sopValues = starter.sops.map((sop, i) => {
      let ownerAgent = insertedAgents.find((a) => {
        if (!sop.roleHint) return false
        return a.role.toLowerCase().includes(sop.roleHint.toLowerCase())
      })
      if (!ownerAgent) ownerAgent = insertedAgents.find((a) => a.isTeamLead) || insertedAgents[0]
      return {
        agentId: ownerAgent.id,
        title: sop.title,
        content: sop.content,
        category: sop.category,
        sortOrder: i,
        version: 1,
      }
    })
    await db.insert(agentSops).values(sopValues)
  }

  if (starter.userTasks.length > 0) {
    await db.insert(tasks).values(
      starter.userTasks.map((t) => ({
        title: t.title,
        description: t.description,
        priority: t.priority,
        assignedToUser: true,
        status: "todo",
        instructions: t.instructions || null,
        requirement: t.requirement ? { ...t.requirement, fulfilled: false } : null,
      }))
    )
  }

  // Workflow Engine (BLA-63): set the new workspace to Phase 1 (Product
  // Definition). Downstream phase progress is tracked in workflow_phase_runs.
  await ensureWorkflowInitialized(newWorkspace.id)

  // Seed playbooks in the background. Don't await. This reads 38 files
  // and inserts them into the DB which can take 10+ seconds. The workspace
  // is fully functional without them. They'll be there by the time the
  // user finishes their first R&D conversation.
  seedPlaybooks().catch(() => {})

  return Response.json({
    success: true,
    workspaceId: newWorkspace.id,
    workspace: newWorkspace,
    teams: insertedTeams.length,
    agents: insertedAgents.length + 1, // +1 for CoS
    channels: insertedChannels.length,
    // Entry-point channel for first-run — user lands here per PVD
    entryChannelId: rndChannel?.id ?? null,
    entryChannelName: rndChannel?.name ?? null,
    rndLeadName: rndLead?.name ?? null,
  })
}
