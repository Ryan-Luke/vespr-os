/**
 * Skill Library — Voyager-style skill extraction from successful tasks.
 *
 * When an agent completes a task successfully:
 * 1. Extract the procedure/approach used
 * 2. Check for duplicates (Jaccard similarity)
 * 3. If duplicate (>=0.8): increment successCount
 * 4. If similar (0.5-0.8): merge descriptions
 * 5. If new: create new skill entry
 *
 * Skills are injected into agent context when mature (successCount >= 2)
 * and the task prompt matches triggerConditions.
 */

import { db } from "@/lib/db"
import { skills } from "@/lib/db/schema"
import { eq, and, gte } from "drizzle-orm"

// ── Types ────────────────────────────────────────────────────

export interface TaskForSkill {
  id: string
  title: string
  description?: string | null
  instructions?: string | null
  result?: Record<string, unknown> | null
}

// ── Jaccard Similarity ───────────────────────────────────────

/**
 * Compute Jaccard similarity between two strings.
 * Tokenizes on word boundaries and compares overlap.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 1),
    )

  const setA = tokenize(a)
  const setB = tokenize(b)

  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection++
  }

  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

// ── Skill Extraction ─────────────────────────────────────────

/**
 * Extract a reusable skill from a completed task.
 * Handles dedup, merging, and creation automatically.
 */
export async function extractSkillFromTask(
  task: TaskForSkill,
  agentId: string,
  workspaceId: string,
): Promise<{ action: "created" | "incremented" | "merged"; skillId: string } | null> {
  // Build skill name and description from the task
  const skillName = deriveSkillName(task.title)
  const skillDescription = buildSkillDescription(task)
  const skillPattern = buildSkillPattern(task)
  const triggerConditions = extractTriggerConditions(task.title)

  // Fetch existing skills for this agent in this workspace
  const existingSkills = await db
    .select()
    .from(skills)
    .where(
      and(
        eq(skills.workspaceId, workspaceId),
        eq(skills.agentId, agentId),
      ),
    )

  // Check for duplicates / similar skills
  let bestMatch: { skill: typeof existingSkills[0]; similarity: number } | null = null

  for (const existing of existingSkills) {
    const nameSim = jaccardSimilarity(skillName, existing.name)
    const descSim = jaccardSimilarity(skillDescription, existing.description)
    const combinedSim = nameSim * 0.4 + descSim * 0.6

    if (!bestMatch || combinedSim > bestMatch.similarity) {
      bestMatch = { skill: existing, similarity: combinedSim }
    }
  }

  // Duplicate (>=0.8): just increment success count
  if (bestMatch && bestMatch.similarity >= 0.8) {
    await db
      .update(skills)
      .set({
        successCount: bestMatch.skill.successCount + 1,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(skills.id, bestMatch.skill.id))

    return { action: "incremented", skillId: bestMatch.skill.id }
  }

  // Similar (0.5-0.8): merge descriptions
  if (bestMatch && bestMatch.similarity >= 0.5) {
    const mergedDescription = `${bestMatch.skill.description}\n\nAlternative approach from "${task.title}":\n${skillDescription}`
    const mergedTriggers = [
      ...new Set([
        ...(bestMatch.skill.triggerConditions || []),
        ...triggerConditions,
      ]),
    ]

    await db
      .update(skills)
      .set({
        description: mergedDescription,
        triggerConditions: mergedTriggers,
        successCount: bestMatch.skill.successCount + 1,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(skills.id, bestMatch.skill.id))

    return { action: "merged", skillId: bestMatch.skill.id }
  }

  // New skill — create it
  const [created] = await db
    .insert(skills)
    .values({
      workspaceId,
      agentId,
      name: skillName,
      description: skillDescription,
      pattern: skillPattern,
      triggerConditions,
      successCount: 1,
      importance: 3,
    })
    .returning()

  return { action: "created", skillId: created.id }
}

// ── Skill Retrieval ──────────────────────────────────────────

/**
 * Get relevant skills for a task prompt.
 * Only returns mature skills (successCount >= 2).
 * Matches against triggerConditions using word overlap.
 */
export async function getRelevantSkills(
  agentId: string,
  workspaceId: string,
  taskPrompt: string,
): Promise<Array<{ name: string; description: string; pattern: string }>> {
  const matureSkills = await db
    .select()
    .from(skills)
    .where(
      and(
        eq(skills.workspaceId, workspaceId),
        eq(skills.agentId, agentId),
        gte(skills.successCount, 2),
      ),
    )

  if (matureSkills.length === 0) return []

  // Score each skill against the task prompt
  const scored = matureSkills
    .map((skill) => {
      // Check trigger conditions for match
      const triggerMatch = (skill.triggerConditions || []).some((trigger) => {
        const words = trigger.toLowerCase().split(/\s+/)
        const promptLower = taskPrompt.toLowerCase()
        return words.some((w) => w.length > 2 && promptLower.includes(w))
      })

      // Also check name/description similarity
      const nameSim = jaccardSimilarity(taskPrompt, skill.name)
      const descSim = jaccardSimilarity(taskPrompt, skill.description)

      const score = triggerMatch ? 1.0 : Math.max(nameSim, descSim)
      return { skill, score }
    })
    .filter((s) => s.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // max 3 skills per prompt

  return scored.map((s) => ({
    name: s.skill.name,
    description: s.skill.description,
    pattern: s.skill.pattern,
  }))
}

// ── Helpers ──────────────────────────────────────────────────

function deriveSkillName(taskTitle: string): string {
  // Remove specific details after colons and trailing punctuation
  const clean = taskTitle.split(":")[0].trim().replace(/[.!?]+$/, "")
  // Limit to 60 chars
  return clean.length > 60 ? clean.slice(0, 57) + "..." : clean
}

function buildSkillDescription(task: TaskForSkill): string {
  const parts: string[] = [`Task: ${task.title}`]
  if (task.description) parts.push(`Context: ${task.description.slice(0, 200)}`)
  if (task.instructions) parts.push(`Approach: ${task.instructions.slice(0, 200)}`)
  return parts.join("\n")
}

function buildSkillPattern(task: TaskForSkill): string {
  const steps: string[] = []
  steps.push(`1. Understand the task: "${task.title}"`)

  if (task.description) {
    steps.push(`2. Review context: ${task.description.slice(0, 150)}`)
  }

  if (task.instructions) {
    steps.push(`3. Follow instructions: ${task.instructions.slice(0, 300)}`)
  } else {
    steps.push(`3. Execute core work based on task requirements`)
  }

  steps.push(`4. Verify output quality`)
  steps.push(`5. Deliver result`)

  return steps.join("\n")
}

function extractTriggerConditions(taskTitle: string): string[] {
  // Extract key words/phrases that would trigger this skill
  const words = taskTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)

  // Take the most distinctive words (skip very common verbs)
  const commonVerbs = new Set(["write", "create", "make", "build", "prepare", "generate", "send", "this", "that", "with", "from"])
  const distinctive = words.filter((w) => !commonVerbs.has(w))

  return distinctive.slice(0, 5)
}
