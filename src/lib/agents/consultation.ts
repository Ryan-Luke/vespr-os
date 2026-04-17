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
  agentBonds, agentThreads, agentThreadMessages, collaborationEvents,
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

// ── Multi-turn agent threads ─────────────────────────────────────────
// Persistent conversations between agents for coordination, negotiation,
// review, and escalation. Unlike single-shot consultation, threads retain
// history and allow multiple back-and-forth exchanges.

/**
 * Build a full system prompt for an agent in thread context.
 * Mirrors the pattern used in consultAgent but with thread awareness.
 */
async function buildThreadAgentPrompt(agentId: string, workspaceId: string): Promise<string> {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
  if (!agent) throw new Error(`Agent not found: ${agentId}`)

  const sops = await db.select().from(agentSops)
    .where(eq(agentSops.agentId, agentId))
    .orderBy(agentSops.sortOrder)

  const memories = await db.select().from(agentMemories)
    .where(eq(agentMemories.agentId, agentId))
    .orderBy(desc(agentMemories.importance))
    .limit(10)

  const sharedMemories = await db.select().from(companyMemories)
    .where(eq(companyMemories.workspaceId, workspaceId))
    .orderBy(desc(companyMemories.importance))
    .limit(8)

  const personalityStyle = traitsToPromptStyle(
    agent.personality as PersonalityTraits,
    agent.personalityPresetId ?? undefined,
    (agent.personalityConfig as any) ?? null,
  )

  let prompt = `You are ${agent.name}, ${agent.role}.${agent.systemPrompt ? " " + agent.systemPrompt : ""}
Your skills: ${(agent.skills as string[]).join(", ")}
${personalityStyle}

You are in a multi-turn collaboration thread with a colleague. Respond based on your expertise, SOPs, and memories. Be concise and actionable. When you reach agreement or resolution, say "RESOLVED:" followed by a summary.`

  if (sops.length > 0) {
    prompt += `\n\nYour SOPs:\n${sops.map(s => `### ${s.title}\n${s.content}`).join("\n\n")}`
  }
  if (memories.length > 0) {
    prompt += `\n\nYour memories:\n${memories.map(m => `- [${m.memoryType}] ${m.content}`).join("\n")}`
  }
  if (sharedMemories.length > 0) {
    prompt += `\n\nCompany knowledge:\n${sharedMemories.map(m => `- [${m.category}] ${m.title}: ${m.content}`).join("\n")}`
  }

  return prompt
}

/**
 * Start a persistent collaboration thread between two agents.
 * Creates the thread, posts the initial message, and generates
 * the target agent's first response.
 */
export async function startAgentThread(params: {
  workspaceId: string
  initiatorAgentId: string
  targetAgentName: string
  subject: string
  initialMessage: string
  type?: "coordination" | "negotiation" | "review" | "escalation"
  linkedTaskId?: string
}): Promise<{ threadId: string; response: string }> {
  const { workspaceId, initiatorAgentId, targetAgentName, subject, initialMessage, type, linkedTaskId } = params

  // Resolve target agent
  const allAgents = await db.select().from(agents).where(eq(agents.workspaceId, workspaceId))
  const target = allAgents.find(a => a.name.toLowerCase() === targetAgentName.toLowerCase())
  if (!target) throw new Error(`Agent "${targetAgentName}" not found in workspace`)

  const [initiator] = await db.select().from(agents).where(eq(agents.id, initiatorAgentId)).limit(1)
  if (!initiator) throw new Error("Initiator agent not found")

  // Create thread
  const [thread] = await db.insert(agentThreads).values({
    workspaceId,
    type: type ?? "coordination",
    subject,
    initiatorAgentId,
    participantAgentIds: [initiatorAgentId, target.id],
    linkedTaskId: linkedTaskId ?? null,
    status: "active",
    metadata: {},
  }).returning()

  // Create initial message from initiator
  await db.insert(agentThreadMessages).values({
    threadId: thread.id,
    senderAgentId: initiatorAgentId,
    content: initialMessage,
    messageType: "message",
  })

  // Generate response from target agent
  const [ws] = await db.select({ anthropicApiKey: workspaces.anthropicApiKey })
    .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
  const apiKey = ws?.anthropicApiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("No Anthropic API key configured")
  const anthropic = createAnthropic({ apiKey })

  const systemPrompt = await buildThreadAgentPrompt(target.id, workspaceId)

  const result = await generateText({
    model: anthropic("claude-haiku-4-5"),
    system: systemPrompt,
    prompt: `Thread subject: "${subject}"\n\n${initiator.name} says:\n${initialMessage}`,
    maxOutputTokens: 1000,
  })

  // Save target agent's response
  await db.insert(agentThreadMessages).values({
    threadId: thread.id,
    senderAgentId: target.id,
    content: result.text,
    messageType: "message",
  })

  // Log collaboration event
  await db.insert(collaborationEvents).values({
    workspaceId,
    eventType: "agent_consulted",
    sourceAgentId: initiatorAgentId,
    targetAgentId: target.id,
    threadId: thread.id,
    summary: `${initiator.name} started a ${type ?? "coordination"} thread with ${target.name}: "${subject}"`,
    metadata: { threadType: type ?? "coordination" },
  })

  // Track agent bond
  try {
    const existingBond = await db.select().from(agentBonds)
      .where(and(
        eq(agentBonds.agentAId, initiatorAgentId),
        eq(agentBonds.agentBId, target.id),
        eq(agentBonds.workspaceId, workspaceId),
      )).limit(1)

    if (existingBond.length > 0) {
      await db.update(agentBonds).set({
        workflowCount: existingBond[0].workflowCount + 1,
        updatedAt: new Date(),
      }).where(eq(agentBonds.id, existingBond[0].id))
    } else {
      await db.insert(agentBonds).values({
        workspaceId,
        agentAId: initiatorAgentId,
        agentBId: target.id,
        workflowCount: 1,
      })
    }
  } catch {} // bond tracking is best-effort

  return { threadId: thread.id, response: result.text }
}

/**
 * Continue a multi-turn agent thread. Sends a message from one agent
 * and generates a response from the other participant.
 */
export async function continueAgentThread(params: {
  threadId: string
  senderAgentId: string
  message: string
  messageType?: string
}): Promise<{ response: string }> {
  const { threadId, senderAgentId, message, messageType } = params

  // Load thread
  const [thread] = await db.select().from(agentThreads)
    .where(eq(agentThreads.id, threadId)).limit(1)
  if (!thread) throw new Error("Thread not found")
  if (thread.status !== "active") throw new Error("Thread is not active")

  // Save the incoming message
  await db.insert(agentThreadMessages).values({
    threadId,
    senderAgentId,
    content: message,
    messageType: messageType ?? "message",
  })

  // Determine who should respond (the other participant)
  const participantIds = thread.participantAgentIds as string[]
  const responderId = participantIds.find(id => id !== senderAgentId)
  if (!responderId) throw new Error("No other participant found in thread")

  // Load recent messages for context (last 10)
  const recentMessages = await db.select().from(agentThreadMessages)
    .where(eq(agentThreadMessages.threadId, threadId))
    .orderBy(desc(agentThreadMessages.createdAt))
    .limit(10)

  // Resolve agent names for context
  const allParticipants = await db.select().from(agents)
    .where(eq(agents.workspaceId, thread.workspaceId!))

  const agentNameMap: Record<string, string> = {}
  for (const a of allParticipants) agentNameMap[a.id] = a.name

  // Build conversation history
  const history = recentMessages.reverse().map(m =>
    `${agentNameMap[m.senderAgentId] ?? "Unknown"}: ${m.content}`,
  ).join("\n\n")

  // Generate response
  const [ws] = await db.select({ anthropicApiKey: workspaces.anthropicApiKey })
    .from(workspaces).where(eq(workspaces.id, thread.workspaceId!)).limit(1)
  const apiKey = ws?.anthropicApiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("No Anthropic API key configured")
  const anthropic = createAnthropic({ apiKey })

  const systemPrompt = await buildThreadAgentPrompt(responderId, thread.workspaceId!)

  const result = await generateText({
    model: anthropic("claude-haiku-4-5"),
    system: systemPrompt,
    prompt: `Thread subject: "${thread.subject}"\n\nConversation so far:\n${history}`,
    maxOutputTokens: 1000,
  })

  // Save response
  await db.insert(agentThreadMessages).values({
    threadId,
    senderAgentId: responderId,
    content: result.text,
    messageType: "message",
  })

  // Auto-resolve if the response contains "RESOLVED:"
  if (result.text.includes("RESOLVED:")) {
    const resolutionSummary = result.text.split("RESOLVED:")[1]?.trim() || result.text
    await db.update(agentThreads).set({
      status: "resolved",
      resolution: resolutionSummary,
      resolvedAt: new Date(),
    }).where(eq(agentThreads.id, threadId))

    await db.insert(collaborationEvents).values({
      workspaceId: thread.workspaceId!,
      eventType: "decision_made",
      sourceAgentId: responderId,
      threadId,
      summary: `Thread "${thread.subject}" resolved: ${resolutionSummary.slice(0, 200)}`,
    })
  }

  return { response: result.text }
}
