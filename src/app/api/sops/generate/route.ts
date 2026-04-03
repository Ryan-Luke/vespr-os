import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agentSops, agents, tasks } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const maxDuration = 30

export async function POST(req: Request) {
  const { taskId } = await req.json() as { taskId: string }

  // Load the task and assigned agent
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 })
  if (!task.assignedAgentId) return Response.json({ error: "No agent assigned" }, { status: 400 })

  const [agent] = await db.select().from(agents).where(eq(agents.id, task.assignedAgentId)).limit(1)
  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 })

  // Check if an SOP already exists for this type of work
  const existingSops = await db.select().from(agentSops)
    .where(eq(agentSops.agentId, agent.id))

  const similarSop = existingSops.find((s) =>
    s.title.toLowerCase().includes(task.title.toLowerCase().split(" ").slice(0, 3).join(" "))
  )

  // Generate or update the SOP
  const result = await generateText({
    model: anthropic("claude-haiku-4-5"),
    system: `You are a process documentation expert. Create a clear, actionable SOP (Standard Operating Procedure) based on a completed task.

The SOP should include:
1. A clear title
2. Step-by-step instructions (numbered)
3. Quality criteria (what "done well" looks like)
4. Escalation rules (when to ask for help)

Keep it practical and specific. Use markdown formatting. Be concise — no fluff.`,
    prompt: similarSop
      ? `Update this existing SOP based on the latest task execution:\n\nExisting SOP:\n${similarSop.content}\n\nLatest task: "${task.title}"\nDescription: ${task.description || "N/A"}\nResult: ${task.result ? JSON.stringify(task.result) : "Completed successfully"}\n\nImprove the SOP based on this execution — add any missing steps, refine quality criteria, and increment the version.`
      : `Create a new SOP for the following completed task:\n\nTask: "${task.title}"\nDescription: ${task.description || "N/A"}\nAgent role: ${agent.role}\nAgent skills: ${(agent.skills as string[]).join(", ")}\nResult: ${task.result ? JSON.stringify(task.result) : "Completed successfully"}\n\nDocument the process so it can be repeated consistently.`,
    maxOutputTokens: 800,
  })

  if (similarSop) {
    // Update existing SOP
    await db.update(agentSops)
      .set({
        content: result.text,
        version: similarSop.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(agentSops.id, similarSop.id))

    return Response.json({
      action: "updated",
      sopId: similarSop.id,
      version: similarSop.version + 1,
      title: similarSop.title,
    })
  } else {
    // Create new SOP
    const [newSop] = await db.insert(agentSops).values({
      agentId: agent.id,
      title: `SOP: ${task.title}`,
      content: result.text,
      category: "process",
      version: 1,
    }).returning()

    return Response.json({
      action: "created",
      sopId: newSop.id,
      version: 1,
      title: newSop.title,
    })
  }
}
