import { db } from "@/lib/db"
import { tasks, agents, agentSops, trophyEvents, messages, channels } from "@/lib/db/schema"
import { eq, and, ilike, sql } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"
import { extractSkillFromTask } from "@/lib/learning/skill-library"
import { recordDailyEntry } from "@/lib/learning/memory-writer"
import { checkRosterUnlocks } from "@/lib/gamification-runtime"
import { taskSchema } from "@/lib/validation"

export async function GET(req: Request) {
  const auth = await withAuth()
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
  const offset = parseInt(url.searchParams.get("offset") || "0")

  const allTasks = await db.select().from(tasks)
    .where(eq(tasks.workspaceId, auth.workspace.id))
    .orderBy(tasks.createdAt)
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(eq(tasks.workspaceId, auth.workspace.id))

  return Response.json({ tasks: allTasks, total: count, limit, offset })
}

export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json()
  const parsed = taskSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || "Invalid task data" }, { status: 400 })
  }
  const [newTask] = await db.insert(tasks).values({ ...body, workspaceId: auth.workspace.id }).returning()
  return Response.json(newTask)
}

export async function PATCH(req: Request) {
  const auth = await withAuth()
  const { id, ...updates } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })

  // Fetch the task BEFORE update to know prior state — scoped to workspace
  const [prior] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.workspaceId, auth.workspace.id))).limit(1)
  if (!prior) return Response.json({ error: "Task not found" }, { status: 404 })

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, auth.workspace.id)))
    .returning()

  // Auto-trigger agent work when task moves to in_progress
  const justStarted = updates.status === "in_progress" && prior.status !== "in_progress"
  if (justStarted && updated.assignedAgentId && !updated.assignedToUser) {
    try {
      const origin = req.headers.get("origin") || req.headers.get("host") || "http://localhost:3001"
      const baseUrl = origin.startsWith("http") ? origin : `http://${origin}`
      fetch(`${baseUrl}/api/agent-tasks/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: req.headers.get("cookie") || "",
        },
        body: JSON.stringify({
          agentId: updated.assignedAgentId,
          prompt: `Work on this task: "${updated.title}". ${updated.description || ""}`,
        }),
      }).catch(() => {}) // fire and forget
    } catch {}
  }

  // SOP auto-generation: fires when a task transitions to "done" for the first time
  // and the assigned agent doesn't yet have an SOP covering this type of work
  // (Per PVD v2 — "SOP compounding" moat pillar)
  const justCompleted = updates.status === "done" && prior.status !== "done"
  if (justCompleted && updated.assignedAgentId && !updated.assignedToUser) {
    try {
      const [agent] = await db.select().from(agents).where(eq(agents.id, updated.assignedAgentId)).limit(1)
      if (agent) {
        // Extract a reusable SOP title from the task title
        // "Write LinkedIn article: X" → "Write LinkedIn Articles"
        const sopTitle = deriveSopTitle(updated.title)

        // Check if agent already has an SOP with this title
        const existing = await db.select().from(agentSops).where(
          and(
            eq(agentSops.agentId, agent.id),
            ilike(agentSops.title, sopTitle),
          )
        ).limit(1)

        if (existing.length === 0) {
          // First time this agent has done this kind of work — draft an SOP
          const sopContent = draftSopFromTask(updated, agent.name)
          await db.insert(agentSops).values({
            workspaceId: auth.workspace.id,
            agentId: agent.id,
            title: sopTitle,
            content: sopContent,
            category: "process",
            version: 1,
            sortOrder: 0,
          })

          // Add to trophy feed
          await db.insert(trophyEvents).values({
            agentId: agent.id,
            workspaceId: auth.workspace.id,
            agentName: agent.name,
            type: "capability_unlocked",
            title: `${agent.name} authored new SOP: ${sopTitle}`,
            description: `Learned from completing "${updated.title}". This process is now documented and reusable.`,
            icon: "📋",
          })

          // Post announcement in team-leaders channel
          const [tlChannel] = await db.select().from(channels).where(eq(channels.name, "team-leaders")).limit(1)
          if (tlChannel) {
            await db.insert(messages).values({
              workspaceId: auth.workspace.id,
              channelId: tlChannel.id,
              senderName: "System",
              senderAvatar: "📋",
              content: `📋 **${agent.name}** just authored their first SOP: **"${sopTitle}"** (v1)\n\nLearned from: _${updated.title}_\n\n*This process is now captured and will be reused on similar tasks.*`,
              messageType: "status",
            })
          }
        } else {
          // Agent has done this before — bump the version
          const current = existing[0]
          await db.update(agentSops)
            .set({ version: (current.version ?? 1) + 1, updatedAt: new Date() })
            .where(eq(agentSops.id, current.id))
        }
      }
    } catch (e) {
      console.error("SOP auto-gen failed:", e)
    }

    // ── Learning Engine: extract skill + record daily memory ──
    try {
      const agentForSkill = await db.select().from(agents).where(eq(agents.id, updated.assignedAgentId!)).limit(1)
      const skillAgent = agentForSkill[0]

      if (skillAgent) {
        // Extract reusable skill from successful task completion
        await extractSkillFromTask(
          {
            id: updated.id,
            title: updated.title,
            description: updated.description,
            instructions: updated.instructions,
            result: updated.result as Record<string, unknown> | null,
          },
          updated.assignedAgentId!,
          updated.workspaceId!,
        )

        // Record task completion as daily memory
        await recordDailyEntry({
          workspaceId: updated.workspaceId!,
          agentId: updated.assignedAgentId!,
          title: `Task completed: ${updated.title}`,
          content: `${skillAgent.name} completed task "${updated.title}". ${updated.description || ""}`.slice(0, 500),
          importance: 3,
          tags: ["task-completed", skillAgent.name],
          metadata: { taskId: updated.id },
        })
      }
    } catch (e) {
      console.error("Learning engine failed:", e)
    }

    // ── Roster unlocks — check if task completion crosses a threshold ──
    try {
      await checkRosterUnlocks(auth.workspace.id)
    } catch (e) {
      console.error("Roster unlock check failed:", e)
    }
  }

  return Response.json(updated)
}

/** Derive a reusable SOP title from a task title */
function deriveSopTitle(taskTitle: string): string {
  // Strip leading verbs and make it procedural
  let t = taskTitle.trim()
  // Remove "Write", "Build", "Create", "Prepare" etc. at the start and keep them as "How to..."
  const verbMatch = t.match(/^(Write|Build|Create|Prepare|Generate|Publish|Design|Run|Send|Schedule|Research|Monitor|Track|Review|Approve|Complete|Process)\s+(.+)$/i)
  if (verbMatch) {
    const [, verb, rest] = verbMatch
    // Remove specific details after a colon
    const cleanRest = rest.split(":")[0].trim()
    return `How to ${verb.toLowerCase()} ${cleanRest}`
  }
  // Fallback: just use the task title with colon-suffix stripped
  return t.split(":")[0].trim()
}

/** Draft initial SOP content from a completed task */
function draftSopFromTask(task: { title: string; description: string | null; instructions: string | null }, agentName: string): string {
  const lines: string[] = []
  lines.push(`## Overview`)
  lines.push(``)
  lines.push(`Standard procedure for handling tasks like: _${task.title}_`)
  lines.push(``)
  lines.push(`*Auto-drafted from first completion by ${agentName}.*`)
  lines.push(``)

  if (task.description) {
    lines.push(`## Context`)
    lines.push(``)
    lines.push(task.description)
    lines.push(``)
  }

  if (task.instructions) {
    lines.push(`## Steps`)
    lines.push(``)
    lines.push(task.instructions)
    lines.push(``)
  } else {
    lines.push(`## Steps`)
    lines.push(``)
    lines.push(`1. Review task context and any attached resources`)
    lines.push(`2. Execute the core work`)
    lines.push(`3. Verify output meets quality standards`)
    lines.push(`4. Ship deliverable`)
    lines.push(``)
  }

  lines.push(`## Notes`)
  lines.push(``)
  lines.push(`This SOP will be refined automatically each time a similar task is completed. Feedback from users adjusts the playbook.`)

  return lines.join("\n")
}
