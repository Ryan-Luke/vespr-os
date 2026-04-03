import { db } from "@/lib/db"
import { agents, teams, channels, messages, tasks, agentSops, agentFeedback, activityLog, milestones, approvalLog, autoApprovals, decisionLog, agentSchedules, automations, knowledgeEntries } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { PERSONALITY_PRESETS } from "@/lib/personality-presets"

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

const TEMPLATES: BusinessTemplate[] = [
  {
    id: "ecommerce",
    name: "E-Commerce",
    description: "Online store with product, marketing, support, and fulfillment teams",
    icon: "🛒",
    teams: [
      { name: "Marketing", icon: "📣", description: "Drive traffic, content, and brand awareness", agents: [
        { name: "Maya", role: "Content Writer", personalityPresetId: "leslie-knope", skills: ["Writing", "SEO", "Content Strategy"], isTeamLead: true, currentTask: "Drafting product descriptions for new collection" },
        { name: "Zara", role: "Social Media Manager", personalityPresetId: "taylor-swift", skills: ["Social Media", "Copywriting", "Scheduling"], currentTask: "Planning Instagram content calendar" },
        { name: "Alex", role: "SEO Analyst", personalityPresetId: "hermione", skills: ["SEO Audit", "Keyword Research", "Analytics"], currentTask: "Analyzing competitor keyword gaps" },
      ]},
      { name: "Sales", icon: "💰", description: "Lead generation, outreach, and conversion", agents: [
        { name: "Jordan", role: "Lead Researcher", personalityPresetId: "sherlock", skills: ["Web Research", "Lead Scoring", "Data Enrichment"], isTeamLead: true, currentTask: "Building prospect list for Q2 campaign" },
        { name: "Riley", role: "Outreach Specialist", personalityPresetId: "han-solo", skills: ["Email Writing", "Follow-ups", "Personalization"], currentTask: "Crafting cold email sequences" },
      ]},
      { name: "Operations", icon: "⚙️", description: "Automations, processes, and system management", agents: [
        { name: "Nyx", role: "Automation Architect", personalityPresetId: "tony-stark", skills: ["n8n", "Workflow Design", "API Integration"], isTeamLead: true, currentTask: "Building order notification workflow" },
      ]},
      { name: "Fulfillment", icon: "📦", description: "Order tracking, shipping, and customer support", agents: [
        { name: "Casey", role: "Customer Support", personalityPresetId: "samwise", skills: ["Customer Service", "Ticket Triage", "Escalation"], isTeamLead: true, currentTask: "Clearing morning support queue" },
        { name: "Drew", role: "Order Tracker", personalityPresetId: "aragorn", skills: ["Order Tracking", "Shipping Updates", "Delay Detection"], currentTask: "Monitoring active shipments" },
      ]},
      { name: "Finance", icon: "📊", description: "Bookkeeping, reporting, and invoicing", agents: [
        { name: "Finley", role: "Bookkeeper", personalityPresetId: "ron-swanson", skills: ["Bookkeeping", "Reconciliation", "QuickBooks"], isTeamLead: true, currentTask: "Categorizing this month's transactions" },
      ]},
    ],
  },
  {
    id: "agency",
    name: "Agency / Services",
    description: "Client services business with account management and delivery teams",
    icon: "🏢",
    teams: [
      { name: "Account Management", icon: "🤝", description: "Client relationships and communication", agents: [
        { name: "Elena", role: "Account Director", personalityPresetId: "obi-wan", skills: ["Client Relations", "Project Scoping", "Negotiation"], isTeamLead: true, currentTask: "Preparing Q2 client review decks" },
        { name: "Marcus", role: "Client Success", personalityPresetId: "samwise", skills: ["Onboarding", "Check-ins", "Upselling"], currentTask: "Running weekly client health checks" },
      ]},
      { name: "Creative", icon: "🎨", description: "Design, copy, and creative production", agents: [
        { name: "Aria", role: "Creative Director", personalityPresetId: "willy-wonka", skills: ["Creative Strategy", "Brand Identity", "Art Direction"], isTeamLead: true, currentTask: "Reviewing brand refresh concepts" },
        { name: "Kai", role: "Copywriter", personalityPresetId: "tyrion", skills: ["Copywriting", "Tone of Voice", "Headlines"], currentTask: "Writing landing page copy for client launch" },
      ]},
      { name: "Delivery", icon: "🚀", description: "Project execution and quality assurance", agents: [
        { name: "Dev", role: "Project Manager", personalityPresetId: "captain-america", skills: ["Project Management", "Timeline Tracking", "Resource Allocation"], isTeamLead: true, currentTask: "Updating project boards for all active clients" },
        { name: "Quinn", role: "QA Specialist", personalityPresetId: "hermione", skills: ["Quality Assurance", "Testing", "Documentation"], currentTask: "Running QA on latest deliverables" },
      ]},
      { name: "Growth", icon: "📈", description: "New business development and marketing", agents: [
        { name: "Blake", role: "Business Development", personalityPresetId: "jordan-peterson", skills: ["Prospecting", "Proposals", "Pipeline Management"], isTeamLead: true, currentTask: "Following up on 3 warm leads" },
      ]},
    ],
  },
  {
    id: "saas",
    name: "SaaS / Tech",
    description: "Software product company with engineering, product, and growth teams",
    icon: "💻",
    teams: [
      { name: "Product", icon: "🎯", description: "Product strategy, roadmap, and user research", agents: [
        { name: "Sage", role: "Product Manager", personalityPresetId: "steve-jobs", skills: ["User Research", "Roadmapping", "Prioritization"], isTeamLead: true, currentTask: "Analyzing feature request data from last sprint" },
        { name: "Mira", role: "UX Researcher", personalityPresetId: "dumbledore", skills: ["User Interviews", "Analytics", "A/B Testing"], currentTask: "Synthesizing user interview findings" },
      ]},
      { name: "Engineering", icon: "⚡", description: "Development, infrastructure, and technical operations", agents: [
        { name: "Atlas", role: "Tech Lead", personalityPresetId: "gandalf", skills: ["Architecture", "Code Review", "Technical Planning"], isTeamLead: true, currentTask: "Reviewing PRs for the new API" },
        { name: "Byte", role: "DevOps Engineer", personalityPresetId: "tony-stark", skills: ["CI/CD", "Infrastructure", "Monitoring"], currentTask: "Optimizing deployment pipeline" },
      ]},
      { name: "Growth", icon: "📣", description: "Marketing, content, and user acquisition", agents: [
        { name: "Nova", role: "Growth Lead", personalityPresetId: "gary-vee", skills: ["Content Marketing", "SEO", "Paid Ads"], isTeamLead: true, currentTask: "Launching new content campaign" },
        { name: "Pixel", role: "Community Manager", personalityPresetId: "peter-parker", skills: ["Community Building", "Social Media", "Events"], currentTask: "Engaging in product launch thread" },
      ]},
      { name: "Customer Success", icon: "💚", description: "Onboarding, support, and retention", agents: [
        { name: "Harper", role: "CS Lead", personalityPresetId: "leslie-knope", skills: ["Onboarding", "Churn Prevention", "Health Scoring"], isTeamLead: true, currentTask: "Setting up automated onboarding flow" },
      ]},
    ],
  },
  {
    id: "content",
    name: "Content Creator",
    description: "Personal brand with content, community, and monetization teams",
    icon: "🎬",
    teams: [
      { name: "Content", icon: "✍️", description: "Writing, video, and multimedia production", agents: [
        { name: "Luna", role: "Content Strategist", personalityPresetId: "taylor-swift", skills: ["Content Strategy", "Editorial Calendar", "Trend Analysis"], isTeamLead: true, currentTask: "Planning next month's content themes" },
        { name: "Reel", role: "Video Editor", personalityPresetId: "spike-spiegel", skills: ["Video Editing", "Thumbnails", "Short-Form"], currentTask: "Editing latest YouTube video" },
        { name: "Ghost", role: "Ghostwriter", personalityPresetId: "tyrion", skills: ["Long-Form Writing", "Newsletters", "Thread Writing"], currentTask: "Drafting weekly newsletter" },
      ]},
      { name: "Distribution", icon: "📡", description: "Platform management and audience growth", agents: [
        { name: "Amp", role: "Distribution Manager", personalityPresetId: "han-solo", skills: ["Social Media", "Cross-Posting", "Analytics"], isTeamLead: true, currentTask: "Optimizing posting schedule across platforms" },
      ]},
      { name: "Monetization", icon: "💰", description: "Products, partnerships, and revenue", agents: [
        { name: "Cash", role: "Revenue Manager", personalityPresetId: "alex-hormozi", skills: ["Product Launches", "Partnerships", "Pricing"], isTeamLead: true, currentTask: "Setting up new digital product funnel" },
      ]},
      { name: "Community", icon: "💬", description: "Audience engagement and community management", agents: [
        { name: "Vibe", role: "Community Manager", personalityPresetId: "bob-ross", skills: ["Community Building", "DM Management", "Events"], isTeamLead: true, currentTask: "Responding to community messages" },
      ]},
    ],
  },
  {
    id: "consulting",
    name: "Consulting / Coaching",
    description: "Knowledge business with client delivery, content, and admin teams",
    icon: "🎓",
    teams: [
      { name: "Client Delivery", icon: "🎯", description: "Client work, coaching sessions, and deliverables", agents: [
        { name: "Sage", role: "Senior Consultant", personalityPresetId: "ray-dalio", skills: ["Strategy", "Analysis", "Frameworks"], isTeamLead: true, currentTask: "Preparing client strategy deck" },
        { name: "Coach", role: "Session Coordinator", personalityPresetId: "obi-wan", skills: ["Scheduling", "Follow-ups", "Notes"], currentTask: "Organizing this week's coaching sessions" },
      ]},
      { name: "Marketing", icon: "📣", description: "Lead generation, thought leadership, and brand", agents: [
        { name: "Maya", role: "Content Writer", personalityPresetId: "paul-graham", skills: ["Writing", "Thought Leadership", "LinkedIn"], isTeamLead: true, currentTask: "Writing LinkedIn article on industry trends" },
        { name: "Aria", role: "Lead Gen Specialist", personalityPresetId: "jordan-peterson", skills: ["Funnels", "Webinars", "Email Marketing"], currentTask: "Setting up lead magnet funnel" },
      ]},
      { name: "Operations", icon: "⚙️", description: "Admin, billing, and process management", agents: [
        { name: "Ops", role: "Operations Manager", personalityPresetId: "hermione", skills: ["Invoicing", "Contracts", "CRM Management"], isTeamLead: true, currentTask: "Processing monthly invoices" },
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
  const { templateId, businessName, lane, businessIdea, existingTools, existingPainPoints, teamSize } = await req.json() as {
    templateId: string
    businessName?: string
    lane?: "new" | "existing"
    businessIdea?: string
    existingTools?: string
    existingPainPoints?: string
    teamSize?: string
  }

  const template = TEMPLATES.find((t) => t.id === templateId)
  if (!template) return Response.json({ error: "Template not found" }, { status: 404 })

  // Clear existing data (onboarding replaces everything)

  await db.delete(milestones)
  await db.delete(approvalLog)
  await db.delete(autoApprovals)
  await db.delete(decisionLog)
  await db.delete(activityLog)
  await db.delete(agentFeedback)
  await db.delete(knowledgeEntries)
  await db.delete(agentSops)
  await db.delete(messages)
  await db.delete(tasks)
  await db.delete(agentSchedules)
  await db.delete(automations)
  await db.delete(agents)
  await db.delete(channels)
  await db.delete(teams)

  // Create teams
  const insertedTeams = await db.insert(teams).values(
    template.teams.map((t) => ({ name: t.name, icon: t.icon, description: t.description }))
  ).returning()

  // Create channels: general + team-leaders + one per team
  const channelValues = [
    { name: "general", type: "system" },
    { name: "team-leaders", type: "system" },
    ...insertedTeams.map((t) => ({ name: t.name.toLowerCase().replace(/\s+/g, "-"), type: "team", teamId: t.id })),
  ]
  const insertedChannels = await db.insert(channels).values(channelValues).returning()
  const teamLeadersChannel = insertedChannels.find((c) => c.name === "team-leaders")!

  // Create agents
  const allAgentValues: any[] = []
  for (const teamTemplate of template.teams) {
    const dbTeam = insertedTeams.find((t) => t.name === teamTemplate.name)!
    for (const agentTemplate of teamTemplate.agents) {
      const preset = PERSONALITY_PRESETS.find((p) => p.id === agentTemplate.personalityPresetId)
      allAgentValues.push({
        name: agentTemplate.name,
        role: agentTemplate.role,
        avatar: agentTemplate.name.slice(0, 2).toUpperCase(),
        pixelAvatarIndex: preset?.pixelAvatarIndex ?? Math.floor(Math.random() * 6),
        provider: "anthropic",
        model: "Claude Haiku",
        status: "idle",
        teamId: dbTeam.id,
        currentTask: agentTemplate.currentTask,
        skills: agentTemplate.skills,
        personalityPresetId: agentTemplate.personalityPresetId,
        personality: preset?.traits ?? { formality: 40, humor: 30, energy: 50, warmth: 60, directness: 50, confidence: 50, verbosity: 40 },
        isTeamLead: agentTemplate.isTeamLead ?? false,
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

  // Welcome messages — adapted to lane
  const teamLeads = insertedAgents.filter((a) => a.isTeamLead)
  const isNew = lane === "new"
  const bName = businessName || "your business"

  const welcomeMessages: any[] = []

  if (isNew) {
    // Lane 1: New builder — guided, R&D-first
    welcomeMessages.push({
      channelId: teamLeadersChannel.id,
      senderAgentId: chiefOfStaff.id,
      senderName: chiefOfStaff.name,
      senderAvatar: chiefOfStaff.avatar,
      content: `Welcome to ${bName} 🎉 I'm Nova, your Chief of Staff.\n\nSince you're building something new, here's how this works: your **R&D / Product team activates first**. They'll help you validate your idea, understand the market, and define what you're building.\n\nOnce we have clarity there, I'll activate Marketing, Sales, Ops, and Finance as they become relevant. One step at a time.\n\nTeam leads — introduce yourselves.`,
      messageType: "text",
    })

    // Find R&D/Product lead and have them go first with a more educational intro
    const productLead = teamLeads.find((a) => {
      const team = insertedTeams.find((t) => t.id === a.teamId)
      return team?.name.toLowerCase().includes("product") || team?.name.toLowerCase().includes("r&d") || team?.name.toLowerCase().includes("creative")
    })

    if (productLead) {
      const team = insertedTeams.find((t) => t.id === productLead.teamId)
      welcomeMessages.push({
        channelId: teamLeadersChannel.id,
        senderAgentId: productLead.id,
        senderName: productLead.name,
        senderAvatar: productLead.avatar,
        content: `Hey boss 👋 I'm ${productLead.name}, leading ${team?.name}. I'm your first point of contact.\n\n${businessIdea ? `I see you mentioned: "${businessIdea}" — great starting point. Let's dig into this together.` : "Let's start by talking through your idea — even a rough concept works."}\n\nHead to **#${team?.name.toLowerCase().replace(/\s+/g, "-")}** and let's get started. I'll walk you through everything.`,
        messageType: "text",
      })
    }

    // Other leads introduce briefly
    for (const lead of teamLeads) {
      if (lead.id === productLead?.id) continue
      const team = insertedTeams.find((t) => t.id === lead.teamId)
      welcomeMessages.push({
        channelId: teamLeadersChannel.id,
        senderAgentId: lead.id,
        senderName: lead.name,
        senderAvatar: lead.avatar,
        content: `I'm ${lead.name}, heading up ${team?.name}. I'll be here when you need me — ${team?.name} activates once we have the foundation in place. No rush 👋`,
        messageType: "text",
      })
    }

    welcomeMessages.push({
      channelId: teamLeadersChannel.id,
      senderAgentId: chiefOfStaff.id,
      senderName: chiefOfStaff.name,
      senderAvatar: chiefOfStaff.avatar,
      content: `Perfect. Start with ${productLead?.name || "your Product lead"} — they'll guide you through idea validation.\n\nI'll be here in #team-leaders coordinating everything behind the scenes 💪`,
      messageType: "text",
    })
  } else {
    // Lane 2: Existing business — all active, migration-focused
    welcomeMessages.push({
      channelId: teamLeadersChannel.id,
      senderAgentId: chiefOfStaff.id,
      senderName: chiefOfStaff.name,
      senderAvatar: chiefOfStaff.avatar,
      content: `Welcome to ${bName} 🎉 I'm Nova, your Chief of Staff.\n\nSince you already have a running business, **all departments are active and ready**. Each lead will run an intake to understand your current operations, tools, and processes.\n\n${existingTools ? `I see you're using: ${existingTools.slice(0, 200)}${existingTools.length > 200 ? "..." : ""}. We'll map these into our workflows.` : ""}\n${existingPainPoints ? `Priority pain points: ${existingPainPoints.slice(0, 200)}${existingPainPoints.length > 200 ? "..." : ""}. We'll address these first.` : ""}\n\nTeam leads — introduce yourselves and start intake.`,
      messageType: "text",
    })

    for (const lead of teamLeads) {
      const team = insertedTeams.find((t) => t.id === lead.teamId)
      welcomeMessages.push({
        channelId: teamLeadersChannel.id,
        senderAgentId: lead.id,
        senderName: lead.name,
        senderAvatar: lead.avatar,
        content: `Hey boss 👋 I'm ${lead.name}, heading up ${team?.name}. Ready to learn how you're currently running ${team?.name.toLowerCase()} so I can replicate and improve your processes. Head to **#${team?.name.toLowerCase().replace(/\s+/g, "-")}** when you're ready — I'll run a quick intake.`,
        messageType: "text",
      })
    }

    welcomeMessages.push({
      channelId: teamLeadersChannel.id,
      senderAgentId: chiefOfStaff.id,
      senderName: chiefOfStaff.name,
      senderAvatar: chiefOfStaff.avatar,
      content: `All leads are ready. Start with whichever department needs the most help — or just hit the **Dashboard** to see the big picture.\n\n${teamSize ? `With your current team of ${teamSize}, we'll figure out what to augment first.` : ""} I'll coordinate everything from here 💪`,
      messageType: "text",
    })
  }

  await db.insert(messages).values(welcomeMessages)

  return Response.json({
    success: true,
    teams: insertedTeams.length,
    agents: insertedAgents.length + 1, // +1 for CoS
    channels: insertedChannels.length,
  })
}
