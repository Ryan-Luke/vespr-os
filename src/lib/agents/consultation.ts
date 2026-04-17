// Agent-to-agent consultation. One agent can ask another agent a question
// and get a response, without the human being in the loop. Used for
// cross-department knowledge sharing and collaborative decision-making.
//
// Depth is capped at 1 to prevent infinite consultation chains.

import { generateText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import {
  agents, agentSops, agentMemories, companyMemories, workspaces,
  agentBonds,
} from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { traitsToPromptStyle } from "@/lib/personality-presets"
import type { PersonalityTraits } from "@/lib/personality-presets"

export interface ConsultAgentParams {
  fromAgentId: string
  targetAgentName: string
  question: string
  workspaceId: string
  _consultationDepth?: number // internal: tracks recursion depth
}

export interface ConsultAgentResult {
  ok: boolean
  response?: string
  targetAgentName?: string
  error?: string
}

/**
 * Consult another agent by name. Builds their full system prompt
 * (personality, SOPs, memories) and generates a response.
 * Depth is capped at 1 to prevent infinite chains.
 */
export async function consultAgent(params: ConsultAgentParams): Promise<ConsultAgentResult> {
  const { fromAgentId, targetAgentName, question, workspaceId, _consultationDepth = 0 } = params

  // Cap depth to prevent infinite consultation chains
  if (_consultationDepth >= 1) {
    return {
      ok: false,
      error: "Consultation depth limit reached. Cannot consult another agent while already in a consultation.",
    }
  }

  // Look up target agent by name in the workspace
  const allAgents = await db.select().from(agents).where(eq(agents.workspaceId, workspaceId))
  const target = allAgents.find(
    (a) => a.name.toLowerCase() === targetAgentName.toLowerCase(),
  )

  if (!target) {
    return {
      ok: false,
      error: `Agent "${targetAgentName}" not found in this workspace. Available agents: ${allAgents.map((a) => a.name).join(", ")}`,
    }
  }

  // Build the target agent's system prompt (same pattern as chat route)
  const sops = await db.select().from(agentSops)
    .where(eq(agentSops.agentId, target.id))
    .orderBy(agentSops.sortOrder)

  const memories = await db.select().from(agentMemories)
    .where(eq(agentMemories.agentId, target.id))
    .orderBy(desc(agentMemories.importance))
    .limit(10)

  const sharedMemories = await db.select().from(companyMemories)
    .where(eq(companyMemories.workspaceId, workspaceId))
    .orderBy(desc(companyMemories.importance))
    .limit(8)

  const personalityStyle = traitsToPromptStyle(
    target.personality as PersonalityTraits,
    target.personalityPresetId ?? undefined,
    (target.personalityConfig as any) ?? null,
  )

  let systemPrompt = `You are ${target.name}, ${target.role}.${target.systemPrompt ? " " + target.systemPrompt : ""}
Your skills: ${(target.skills as string[]).join(", ")}
${personalityStyle}

You are being consulted by a colleague. Answer their question concisely and helpfully based on your expertise, SOPs, and memories. Keep your response focused and actionable.`

  if (sops.length > 0) {
    systemPrompt += `\n\nYour SOPs:\n${sops.map((s) => `### ${s.title}\n${s.content}`).join("\n\n")}`
  }
  if (memories.length > 0) {
    systemPrompt += `\n\nYour memories:\n${memories.map((m) => `- [${m.memoryType}] ${m.content}`).join("\n")}`
  }
  if (sharedMemories.length > 0) {
    systemPrompt += `\n\nCompany knowledge:\n${sharedMemories.map((m) => `- [${m.category}] ${m.title}: ${m.content}`).join("\n")}`
  }

  // Find the asking agent's name for context
  const [fromAgent] = await db.select().from(agents).where(eq(agents.id, fromAgentId)).limit(1)
  const fromName = fromAgent?.name ?? "A colleague"

  try {
    // BYOK: resolve workspace API key
    const [ws] = await db.select({ anthropicApiKey: workspaces.anthropicApiKey })
      .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
    const apiKey = ws?.anthropicApiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) return { ok: false, error: "No Anthropic API key configured" }
    const anthropic = createAnthropic({ apiKey })

    const result = await generateText({
      model: anthropic("claude-haiku-4-5"),
      system: systemPrompt,
      prompt: `${fromName} is asking you: ${question}`,
      maxOutputTokens: 1000,
    })

    // Track agent bond — consultations create/strengthen bonds between agents
    try {
      const existingBond = await db.select().from(agentBonds)
        .where(and(
          eq(agentBonds.agentAId, fromAgentId),
          eq(agentBonds.agentBId, target.id),
          eq(agentBonds.workspaceId, workspaceId)
        )).limit(1)

      if (existingBond.length > 0) {
        await db.update(agentBonds).set({
          workflowCount: existingBond[0].workflowCount + 1,
          updatedAt: new Date(),
        }).where(eq(agentBonds.id, existingBond[0].id))
      } else {
        await db.insert(agentBonds).values({
          workspaceId,
          agentAId: fromAgentId,
          agentBId: target.id,
          workflowCount: 1,
        })
      }
    } catch {} // bond tracking is best-effort

    return {
      ok: true,
      response: result.text,
      targetAgentName: target.name,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Consultation failed",
    }
  }
}
