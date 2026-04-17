import { db } from "@/lib/db"
import { agents, messages, tasks } from "@/lib/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export async function GET() {
  const auth = await withAuth()
  const [allAgents, recentMessages, allTasks] = await Promise.all([
    db.select().from(agents).where(eq(agents.workspaceId, auth.workspace.id)),
    // Count messages from the last 24 hours
    db.select({ count: sql<number>`count(*)` }).from(messages)
      .where(sql`${messages.createdAt} > now() - interval '24 hours' AND ${messages.workspaceId} = ${auth.workspace.id}`),
    db.select().from(tasks).where(eq(tasks.workspaceId, auth.workspace.id)),
  ])

  const agentsWorking = allAgents.filter((a) => a.status === "working").length
  const agentsNeedAttention = allAgents
    .filter((a) => a.status === "error")
    .map((a) => ({
      name: a.name,
      issue: a.currentTask?.replace("Failed: ", "") || "Error state",
    }))

  const chiefOfStaff = allAgents.find((a) => a.role === "Chief of Staff")

  const tasksCompleted = allTasks.filter((t) => t.status === "done").length
  const tasksInProgress = allTasks.filter((t) => t.status === "in_progress").length

  return Response.json({
    unreadMessages: Number(recentMessages[0]?.count ?? 0),
    tasksCompleted,
    tasksInProgress,
    agentsWorking,
    agentsNeedAttention,
    chiefOfStaff: chiefOfStaff
      ? { name: chiefOfStaff.name, pixelAvatarIndex: chiefOfStaff.pixelAvatarIndex }
      : null,
  })
}
