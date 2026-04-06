import { db } from "@/lib/db"
import {
  agents, teams, teamGoals, channels, messages, tasks, agentSops, agentFeedback,
  activityLog, milestones, approvalLog, autoApprovals, decisionLog, agentSchedules,
  automations, knowledgeEntries, workspaces, approvalRequests, agentMemories,
  companyMemories, agentTraits, agentBonds, evolutionEvents, rosterUnlocks,
  trophyEvents, integrations,
} from "@/lib/db/schema"

/**
 * Wipes all business-scoped data in FK-respecting order.
 *
 * Most tables in this schema lack a workspaceId column, so data effectively
 * bleeds across workspaces. For a clean-slate experience (fresh onboarding,
 * demo reset), the only reliable option is to delete everything.
 *
 * ⚠️ Destructive. Used by onboarding POST and /api/reset.
 */
export async function wipeBusinessData() {
  await db.delete(messages)
  await db.delete(approvalRequests)
  await db.delete(approvalLog)
  await db.delete(autoApprovals)
  await db.delete(decisionLog)
  await db.delete(activityLog)
  await db.delete(agentFeedback)
  await db.delete(agentSops)
  await db.delete(agentSchedules)
  await db.delete(agentMemories)
  await db.delete(agentTraits)
  await db.delete(agentBonds)
  await db.delete(evolutionEvents)
  await db.delete(tasks)
  await db.delete(knowledgeEntries)
  await db.delete(companyMemories)
  await db.delete(automations)
  await db.delete(trophyEvents)
  await db.delete(milestones)
  await db.delete(rosterUnlocks)
  await db.delete(integrations)
  await db.delete(channels)
  await db.delete(teamGoals)
  await db.delete(agents)
  await db.delete(teams)
  await db.delete(workspaces)
}
