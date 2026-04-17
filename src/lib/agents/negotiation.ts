// Negotiation Protocol. Structured proposal-response negotiation between
// agents. One agent proposes, another reviews. Max 4 rounds before
// auto-escalation to Nova (Chief of Staff).
//
// Uses the existing agent thread system for persistence. Each negotiation
// is a thread of type "negotiation" with structured parsing of responses.

import { generateText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import {
  agents, agentThreads, agentThreadMessages,
  collaborationEvents, workspaces,
} from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { startAgentThread, continueAgentThread } from "./consultation"

// ── Types ────────────────────────────────────────────────────────────

export type NegotiationStatus = "accepted" | "counter" | "rejected"

export type ProposalType = "strategy" | "budget" | "timeline" | "approach" | "content"

export interface NegotiationProposal {
  title: string
  description: string
  type: ProposalType
  details: Record<string, unknown>
}

// ── Constants ────────────────────────────────────────────────────────

const MAX_NEGOTIATION_ROUNDS = 4
const NOVA_AGENT_NAME = "Nova"

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Parse a negotiation response to extract the status.
 * Looks for "ACCEPTED:", "COUNTER:", or "REJECTED:" prefixes.
 * Falls back to "counter" if none found (ambiguous response).
 */
function parseNegotiationStatus(response: string): NegotiationStatus {
  const upper = response.toUpperCase()
  if (upper.startsWith("ACCEPTED:") || upper.includes("\nACCEPTED:")) return "accepted"
  if (upper.startsWith("REJECTED:") || upper.includes("\nREJECTED:")) return "rejected"
  if (upper.startsWith("COUNTER:") || upper.includes("\nCOUNTER:")) return "counter"

  // Check for keywords in the first 200 chars
  const head = upper.slice(0, 200)
  if (head.includes("I ACCEPT") || head.includes("AGREED") || head.includes("LOOKS GOOD")) return "accepted"
  if (head.includes("I REJECT") || head.includes("CANNOT ACCEPT") || head.includes("NOT VIABLE")) return "rejected"

  return "counter"
}

/**
 * Count the number of rounds (message pairs) in a negotiation thread.
 */
async function countRounds(threadId: string): Promise<number> {
  const msgs = await db.select({ id: agentThreadMessages.id })
    .from(agentThreadMessages)
    .where(eq(agentThreadMessages.threadId, threadId))

  // Each round is a pair of messages (proposal + response)
  return Math.floor(msgs.length / 2)
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Start a negotiation. The proposer sends a structured proposal to a
 * reviewer agent. The reviewer evaluates and responds with one of:
 * ACCEPTED, COUNTER, or REJECTED.
 *
 * Returns the thread ID, the reviewer's response, and the parsed status.
 */
export async function startNegotiation(params: {
  workspaceId: string
  proposerAgentId: string
  reviewerAgentName: string
  proposal: NegotiationProposal
  linkedTaskId?: string
}): Promise<{ threadId: string; reviewerResponse: string; status: NegotiationStatus }> {
  const { workspaceId, proposerAgentId, reviewerAgentName, proposal, linkedTaskId } = params

  // Build a structured initial message with negotiation instructions
  const proposalMessage = `**Proposal: ${proposal.title}**
Type: ${proposal.type}

${proposal.description}

Details:
${Object.entries(proposal.details).map(([k, v]) => `- ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n")}

Please evaluate this proposal and respond with one of:
- "ACCEPTED:" followed by your reasoning if you agree
- "COUNTER:" followed by your suggested modifications
- "REJECTED:" followed by your reasoning if this is not viable`

  // Use the existing startAgentThread which creates the thread,
  // posts the initial message, and generates the reviewer's response
  const { threadId, response } = await startAgentThread({
    workspaceId,
    initiatorAgentId: proposerAgentId,
    targetAgentName: reviewerAgentName,
    subject: `Negotiation: ${proposal.title}`,
    initialMessage: proposalMessage,
    type: "negotiation",
    linkedTaskId,
  })

  // Store proposal metadata on the thread
  await db.update(agentThreads).set({
    metadata: {
      proposalType: proposal.type,
      proposalTitle: proposal.title,
      roundCount: 1,
    },
  }).where(eq(agentThreads.id, threadId))

  const status = parseNegotiationStatus(response)

  // Log negotiation event
  await db.insert(collaborationEvents).values({
    workspaceId,
    eventType: "decision_made",
    sourceAgentId: proposerAgentId,
    threadId,
    summary: `Negotiation "${proposal.title}" — reviewer responded: ${status}`,
    metadata: { negotiationStatus: status, round: 1 },
  })

  // If accepted, resolve the thread
  if (status === "accepted") {
    await db.update(agentThreads).set({
      status: "resolved",
      resolution: `Proposal "${proposal.title}" accepted. ${response.slice(0, 300)}`,
      resolvedAt: new Date(),
    }).where(eq(agentThreads.id, threadId))
  }

  return { threadId, reviewerResponse: response, status }
}

/**
 * Respond to an ongoing negotiation. The proposer can accept the
 * reviewer's counter, submit a new counter, or withdraw.
 *
 * After MAX_NEGOTIATION_ROUNDS, auto-escalates to Nova.
 */
export async function respondToNegotiation(params: {
  threadId: string
  agentId: string
  response: string
  action: "accept" | "counter" | "withdraw"
}): Promise<{ otherAgentResponse: string; finalStatus: string }> {
  const { threadId, agentId, response, action } = params

  // Load thread to check status and round count
  const [thread] = await db.select().from(agentThreads)
    .where(eq(agentThreads.id, threadId)).limit(1)

  if (!thread) throw new Error("Negotiation thread not found")
  if (thread.status !== "active") {
    return { otherAgentResponse: "", finalStatus: thread.status! }
  }

  const rounds = await countRounds(threadId)

  // Handle withdrawal
  if (action === "withdraw") {
    await db.update(agentThreads).set({
      status: "resolved",
      resolution: `Proposal withdrawn by proposer. Reason: ${response.slice(0, 300)}`,
      resolvedAt: new Date(),
    }).where(eq(agentThreads.id, threadId))

    await db.insert(collaborationEvents).values({
      workspaceId: thread.workspaceId!,
      eventType: "decision_made",
      sourceAgentId: agentId,
      threadId,
      summary: `Negotiation withdrawn after ${rounds} rounds`,
    })

    return { otherAgentResponse: "", finalStatus: "withdrawn" }
  }

  // Handle acceptance
  if (action === "accept") {
    // Post the acceptance message
    await db.insert(agentThreadMessages).values({
      threadId,
      senderAgentId: agentId,
      content: `ACCEPTED: ${response}`,
      messageType: "approval",
    })

    await db.update(agentThreads).set({
      status: "resolved",
      resolution: `Agreement reached after ${rounds} rounds. ${response.slice(0, 300)}`,
      resolvedAt: new Date(),
    }).where(eq(agentThreads.id, threadId))

    await db.insert(collaborationEvents).values({
      workspaceId: thread.workspaceId!,
      eventType: "decision_made",
      sourceAgentId: agentId,
      threadId,
      summary: `Negotiation resolved — agreement reached after ${rounds} rounds`,
    })

    return { otherAgentResponse: "", finalStatus: "accepted" }
  }

  // Counter-proposal: check if we've hit the round limit
  if (rounds >= MAX_NEGOTIATION_ROUNDS) {
    // Auto-escalate to Nova
    await db.update(agentThreads).set({
      status: "escalated",
      metadata: {
        ...(thread.metadata as Record<string, unknown> || {}),
        escalatedAt: new Date().toISOString(),
        escalationReason: `Max ${MAX_NEGOTIATION_ROUNDS} rounds reached without agreement`,
      },
    }).where(eq(agentThreads.id, threadId))

    // Create escalation thread with Nova
    const escalationMessage = `A negotiation between agents has stalled after ${MAX_NEGOTIATION_ROUNDS} rounds.

Thread: "${thread.subject}"
Latest counter-proposal: ${response.slice(0, 500)}

Please review the negotiation history and make a decision or suggest a resolution.`

    let novaResponse = "Escalation created — awaiting Nova's review."
    try {
      const escalationResult = await startAgentThread({
        workspaceId: thread.workspaceId!,
        initiatorAgentId: agentId,
        targetAgentName: NOVA_AGENT_NAME,
        subject: `Escalation: ${thread.subject}`,
        initialMessage: escalationMessage,
        type: "escalation",
        linkedTaskId: thread.linkedTaskId ?? undefined,
      })
      novaResponse = escalationResult.response
    } catch {
      // Nova might not exist in the workspace — that's ok
    }

    await db.insert(collaborationEvents).values({
      workspaceId: thread.workspaceId!,
      eventType: "escalated",
      sourceAgentId: agentId,
      threadId,
      summary: `Negotiation "${thread.subject}" auto-escalated after ${MAX_NEGOTIATION_ROUNDS} rounds`,
    })

    return { otherAgentResponse: novaResponse, finalStatus: "escalated" }
  }

  // Submit counter-proposal and get response
  const counterMessage = `COUNTER: ${response}`
  const { response: otherResponse } = await continueAgentThread({
    threadId,
    senderAgentId: agentId,
    message: counterMessage,
    messageType: "proposal",
  })

  // Update round count in metadata
  await db.update(agentThreads).set({
    metadata: {
      ...(thread.metadata as Record<string, unknown> || {}),
      roundCount: rounds + 1,
    },
  }).where(eq(agentThreads.id, threadId))

  // Parse the new response
  const newStatus = parseNegotiationStatus(otherResponse)

  await db.insert(collaborationEvents).values({
    workspaceId: thread.workspaceId!,
    eventType: "decision_made",
    sourceAgentId: agentId,
    threadId,
    summary: `Negotiation round ${rounds + 1}: reviewer responded "${newStatus}"`,
    metadata: { negotiationStatus: newStatus, round: rounds + 1 },
  })

  // If the other agent accepted, resolve
  if (newStatus === "accepted") {
    await db.update(agentThreads).set({
      status: "resolved",
      resolution: `Agreement reached in round ${rounds + 1}. ${otherResponse.slice(0, 300)}`,
      resolvedAt: new Date(),
    }).where(eq(agentThreads.id, threadId))
  }

  return { otherAgentResponse: otherResponse, finalStatus: newStatus }
}

// Re-export for tests
export { parseNegotiationStatus, MAX_NEGOTIATION_ROUNDS }
