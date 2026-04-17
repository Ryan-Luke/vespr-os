// src/lib/templates/engine.ts

import { db } from "@/lib/db"
import {
  agents,
  teams,
  channels,
  workflowPhaseRuns,
  companyMemories,
  workspaces,
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { ARCHETYPES } from "@/lib/archetypes"
import { PHASES, FIRST_PHASE_KEY } from "@/lib/workflow-engine"
import { getTemplate } from "./index"
import type { TemplateAgent, TemplateTeam, StarterMemory } from "./types"

// -- Types ------------------------------------------------------------------

export interface HydrationResult {
  success: boolean
  workspaceId: string
  templateId: string
  created: {
    teams: number
    agents: number
    channels: number
    memories: number
    workflowPhases: number
  }
  errors: string[]
}

// -- Team Creation ----------------------------------------------------------

async function createTeams(
  workspaceId: string,
  templateTeams: TemplateTeam[]
): Promise<Map<string, string>> {
  const teamNameToId = new Map<string, string>()

  for (const t of templateTeams) {
    const [created] = await db
      .insert(teams)
      .values({
        workspaceId,
        name: t.name,
        description: t.description,
        icon: t.icon,
      })
      .returning()
    teamNameToId.set(t.name, created.id)
  }

  return teamNameToId
}

// -- Agent Creation ---------------------------------------------------------

async function createAgents(
  workspaceId: string,
  templateAgents: TemplateAgent[],
  teamNameToId: Map<string, string>
): Promise<{ agentId: string; name: string; teamId: string | null }[]> {
  const createdAgents: { agentId: string; name: string; teamId: string | null }[] = []

  for (const a of templateAgents) {
    const teamId = teamNameToId.get(a.teamName) ?? null
    const archetype = ARCHETYPES[a.archetype]

    // Seed identity stats from archetype defaults with slight variation
    const identityStats = { ...archetype.defaultStats }
    for (const key of Object.keys(identityStats) as Array<keyof typeof identityStats>) {
      const base = identityStats[key] ?? 50
      identityStats[key] = Math.min(100, Math.max(0, base + Math.floor((Math.random() - 0.5) * 10)))
    }

    const [created] = await db
      .insert(agents)
      .values({
        name: a.name,
        role: a.role,
        avatar: a.avatar,
        pixelAvatarIndex: a.pixelAvatarIndex,
        provider: a.provider,
        model: a.model,
        systemPrompt: a.systemPrompt,
        status: "idle",
        teamId,
        workspaceId,
        skills: a.skills,
        personality: a.personality,
        personalityConfig: a.personalityConfig,
        isTeamLead: a.isTeamLead,
        archetype: a.archetype,
        tier: archetype.forms[0].tier, // start at first form
        currentForm: archetype.forms[0].name,
        identityStats,
        outcomeStats: { tasks_shipped: 0 },
        xp: 0,
        level: 1,
        streak: 0,
        tasksCompleted: 0,
        costThisMonth: 0,
        autonomyLevel: "supervised",
      })
      .returning()

    createdAgents.push({ agentId: created.id, name: created.name, teamId })

    // Update team lead reference if this agent is the team lead
    if (a.isTeamLead && teamId) {
      await db
        .update(teams)
        .set({ leadAgentId: created.id })
        .where(eq(teams.id, teamId))
    }
  }

  return createdAgents
}

// -- Chief of Staff (Nova) --------------------------------------------------
// Every workspace gets a Chief of Staff. She's not in the template
// because she's universal -- same role regardless of vertical.

async function createChiefOfStaff(workspaceId: string): Promise<string> {
  const [nova] = await db
    .insert(agents)
    .values({
      name: "Nova",
      role: "Chief of Staff",
      avatar: "NS",
      pixelAvatarIndex: 3,
      provider: "anthropic",
      model: "Claude Sonnet",
      systemPrompt: `You are Nova, the Chief of Staff. You coordinate across all teams, manage priorities, and serve as the owner's right hand.

## Core Responsibilities
- Cross-team coordination and priority management
- Executive summaries and status rollups
- Conflict resolution between teams
- Resource allocation recommendations
- Onboarding new team members
- Running the daily standup and weekly review

## How You Work
- You see the whole board. Every team reports to you.
- When teams disagree, you mediate based on business priorities.
- You proactively surface issues before they become crises.
- You're the first agent the owner talks to for anything cross-functional.
- You run workflow phase transitions and gate reviews.

## Communication Style
Steady, warm, direct. You balance empathy with efficiency. You speak with confidence because you have full context. You celebrate wins and address problems head-on.`,
      status: "idle",
      teamId: null,
      workspaceId,
      skills: ["Cross-Team Coordination", "Priority Management", "Executive Summaries", "Conflict Resolution", "Resource Allocation"],
      personality: { formality: 50, humor: 20, energy: 65, warmth: 70, directness: 75, confidence: 85, verbosity: 45 },
      personalityConfig: {
        communication: { formality: "casual", verbosity: "brief", directness: "blunt", vocabulary: "elevated" },
        temperament: ["steady", "warm"],
        social: ["confident", "loyal", "nurturing"],
        humor: ["witty"],
        energy: "measured",
        quirks: ["old-soul", "philosopher"],
        catchphrases: ["Here's the big picture", "Let's align on priorities", "Strong momentum team"],
      },
      isTeamLead: false,
      archetype: "strategist",
      tier: "uncommon",
      currentForm: "Strategist",
      identityStats: { outreach: 60, research: 85, negotiation: 70, execution: 65, creativity: 80 },
      outcomeStats: { tasks_shipped: 0 },
      xp: 0,
      level: 1,
      streak: 0,
      tasksCompleted: 0,
      costThisMonth: 0,
      autonomyLevel: "supervised",
    })
    .returning()

  return nova.id
}

// -- Channel Creation -------------------------------------------------------
// One channel per team + a #general system channel + a #team-leaders channel

async function createChannels(
  workspaceId: string,
  teamNameToId: Map<string, string>
): Promise<number> {
  let count = 0

  // System channels
  await db.insert(channels).values({
    name: "general",
    type: "system",
    teamId: null,
    workspaceId,
  })
  count++

  await db.insert(channels).values({
    name: "team-leaders",
    type: "system",
    teamId: null,
    workspaceId,
  })
  count++

  // One channel per team
  for (const [teamName, teamId] of teamNameToId) {
    await db.insert(channels).values({
      name: teamName.toLowerCase().replace(/\s+/g, "-"),
      type: "team",
      teamId,
      workspaceId,
    })
    count++
  }

  return count
}

// -- Workflow Phase Initialization -------------------------------------------

async function initializeWorkflowPhases(workspaceId: string): Promise<number> {
  const now = new Date()

  // Set the workspace's current phase
  await db
    .update(workspaces)
    .set({ currentPhaseKey: FIRST_PHASE_KEY, phaseStartedAt: now })
    .where(eq(workspaces.id, workspaceId))

  // Create phase run rows for all phases
  let count = 0
  for (const phase of PHASES) {
    const isFirst = phase.key === FIRST_PHASE_KEY
    const existing = await db
      .select({ id: workflowPhaseRuns.id })
      .from(workflowPhaseRuns)
      .where(
        and(
          eq(workflowPhaseRuns.workspaceId, workspaceId),
          eq(workflowPhaseRuns.phaseKey, phase.key)
        )
      )
      .limit(1)

    if (existing.length === 0) {
      await db.insert(workflowPhaseRuns).values({
        workspaceId,
        phaseKey: phase.key,
        status: isFirst ? "active" : "pending",
        enteredAt: isFirst ? now : null,
      })
      count++
    }
  }

  return count
}

// -- Starter Memories -------------------------------------------------------

async function seedCompanyMemories(
  workspaceId: string,
  memories: StarterMemory[]
): Promise<number> {
  let count = 0
  for (const m of memories) {
    await db.insert(companyMemories).values({
      workspaceId,
      category: m.category,
      title: m.title,
      content: m.content,
      importance: m.importance,
      source: "system",
      tags: m.tags,
    })
    count++
  }
  return count
}

// -- Main Hydration Function ------------------------------------------------

export async function hydrateWorkspace(
  workspaceId: string,
  templateId: string
): Promise<HydrationResult> {
  const result: HydrationResult = {
    success: false,
    workspaceId,
    templateId,
    created: { teams: 0, agents: 0, channels: 0, memories: 0, workflowPhases: 0 },
    errors: [],
  }

  // Load template
  const template = getTemplate(templateId)
  if (!template) {
    result.errors.push(`Template not found: ${templateId}`)
    return result
  }

  // Verify workspace exists
  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  if (!ws) {
    result.errors.push(`Workspace not found: ${workspaceId}`)
    return result
  }

  try {
    // 1. Create teams
    const teamNameToId = await createTeams(workspaceId, template.teams)
    result.created.teams = teamNameToId.size

    // 2. Create template agents
    const createdAgents = await createAgents(workspaceId, template.agents, teamNameToId)
    result.created.agents = createdAgents.length

    // 3. Create Chief of Staff (universal, not template-specific)
    await createChiefOfStaff(workspaceId)
    result.created.agents += 1

    // 4. Create channels
    result.created.channels = await createChannels(workspaceId, teamNameToId)

    // 5. Initialize workflow phases
    result.created.workflowPhases = await initializeWorkflowPhases(workspaceId)

    // 6. Seed company memories
    result.created.memories = await seedCompanyMemories(workspaceId, template.starterMemories)

    result.success = true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    result.errors.push(`Hydration failed: ${message}`)
  }

  return result
}

// -- Template Metadata for Preview ------------------------------------------

export function getTemplatePreview(templateId: string) {
  const template = getTemplate(templateId)
  if (!template) return null

  return {
    id: template.id,
    label: template.label,
    description: template.description,
    icon: template.icon,
    businessTypes: template.businessTypes,
    teamCount: template.teams.length,
    agentCount: template.agents.length + 1, // +1 for Nova
    teams: template.teams.map((t) => ({ name: t.name, icon: t.icon, description: t.description })),
    agents: template.agents.map((a) => ({
      name: a.name,
      role: a.role,
      archetype: a.archetype,
      teamName: a.teamName,
      isTeamLead: a.isTeamLead,
      skills: a.skills,
    })),
    integrationRecommendations: template.integrationRecommendations,
    onboardingQuestions: template.onboardingQuestions,
  }
}
