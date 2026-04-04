import { db } from "@/lib/db"
import { agents, teams, channels, messages, tasks, agentSops, agentFeedback, activityLog, milestones, approvalLog, autoApprovals, decisionLog, agentSchedules, automations, knowledgeEntries, workspaces } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { PERSONALITY_PRESETS } from "@/lib/personality-presets"
import { getStarterContent } from "@/lib/onboarding-starter-content"

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
    description: "Online store with marketing, sales, ops, fulfillment, and finance leads",
    icon: "🛒",
    teams: [
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
    description: "Client services with account management, creative, delivery, and growth leads",
    icon: "🏢",
    teams: [
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
    description: "Software company with product, engineering, growth, and customer success leads",
    icon: "💻",
    teams: [
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
    name: "Content Creator",
    description: "Personal brand with content, distribution, monetization, and community leads",
    icon: "🎬",
    teams: [
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
    description: "Knowledge business with client delivery, marketing, and operations leads",
    icon: "🎓",
    teams: [
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

  // Create a new workspace for this business (or re-use if name matches)
  const wsName = businessName?.trim() || template.name
  const slug = wsName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const [newWorkspace] = await db.insert(workspaces).values({
    name: wsName,
    slug,
    icon: template.icon,
    description: businessIdea || template.description,
    businessType: templateId === "ecommerce" ? "ecommerce" : templateId === "saas" ? "saas" : templateId === "agency" ? "agency" : templateId === "consulting" ? "consulting" : templateId === "content" ? "info_product" : "other",
    industry: null,
    website: null,
    businessProfile: {
      mission: businessIdea || undefined,
      icp: undefined,
      verticals: [],
      teamSize: teamSize || undefined,
      revenue: undefined,
      tools: existingTools ? existingTools.split(",").map((t) => t.trim()).filter(Boolean) : [],
    },
  }).returning()

  // Create teams scoped to this workspace
  const insertedTeams = await db.insert(teams).values(
    template.teams.map((t) => ({ workspaceId: newWorkspace.id, name: t.name, icon: t.icon, description: t.description }))
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

  return Response.json({
    success: true,
    workspaceId: newWorkspace.id,
    workspace: newWorkspace,
    teams: insertedTeams.length,
    agents: insertedAgents.length + 1, // +1 for CoS
    channels: insertedChannels.length,
  })
}
