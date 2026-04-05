import { db } from "@/lib/db"
import { tasks, agents, agentSops, trophyEvents, messages, channels } from "@/lib/db/schema"
import { eq, and, ilike } from "drizzle-orm"

export async function GET() {
  const allTasks = await db.select().from(tasks).orderBy(tasks.createdAt)
  return Response.json(allTasks)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [newTask] = await db.insert(tasks).values(body).returning()
  return Response.json(newTask)
}

export async function PATCH(req: Request) {
  const { id, ...updates } = await req.json()
  if (!id) return Response.json({ error: "id required" }, { status: 400 })

  // Fetch the task BEFORE update to know prior state
  const [prior] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
  if (!prior) return Response.json({ error: "Task not found" }, { status: 404 })

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning()

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
