import { db } from "@/lib/db"
import {
  agents as agentsTable,
  channels as channelsTable,
  messages as messagesTable,
  tasks as tasksTable,
} from "@/lib/db/schema"
import { eq, sql, and } from "drizzle-orm"
import { withAuth } from "@/lib/auth/with-auth"

export const maxDuration = 30

// Build a natural standup message from DB data — no AI call needed
function buildStandupMessage(agent: {
  name: string
  currentTask: string | null
}, doneTasks: string[], inProgressTasks: string[], blockers: string[]): string {
  const yesterday = doneTasks.length > 0
    ? doneTasks.slice(0, 3).join(", ")
    : "Ramping up — nothing closed out yet"

  const today = inProgressTasks.length > 0
    ? inProgressTasks.slice(0, 3).join(", ")
    : agent.currentTask
      ? agent.currentTask
      : "Picking up new tasks shortly"

  const blockerLine = blockers.length > 0
    ? blockers.join("; ")
    : "None — all clear"

  return [
    "Morning standup \u{1F4CB}",
    `\u2705 Yesterday: ${yesterday}`,
    `\u{1F3AF} Today: ${today}`,
    `\u{1F6A7} Blockers: ${blockerLine}`,
  ].join("\n")
}

// POST with { agentId } — generate and post standup for one agent
// POST with no body — generate and post standups for ALL agents
export async function POST(req: Request) {
  const auth = await withAuth()
  const body = await req.json().catch(() => ({}))
  const { agentId } = body as { agentId?: string }

  const allAgents = await db.select().from(agentsTable).where(eq(agentsTable.workspaceId, auth.workspace.id))
  const allChannels = await db.select().from(channelsTable).where(eq(channelsTable.workspaceId, auth.workspace.id))

  // Determine which agents to process
  const targetAgents = agentId
    ? allAgents.filter((a) => a.id === agentId)
    : allAgents.filter((a) => a.teamId) // all agents that belong to a team

  if (targetAgents.length === 0) {
    return Response.json({ error: "No agents found" }, { status: 404 })
  }

  // Fetch all tasks in one query for efficiency
  const allTasks = await db.select().from(tasksTable)

  // Tasks completed in the last 24 hours
  const recentDone = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.status, "done"),
        sql`${tasksTable.completedAt} > now() - interval '24 hours'`
      )
    )

  const results: { agent: string; channel: string; message: string }[] = []

  for (const agent of targetAgents) {
    // Find the team channel for this agent
    const channel = allChannels.find((c) => c.teamId === agent.teamId && c.type === "team")
    if (!channel) continue

    // Tasks this agent completed in last 24h
    const doneTasks = recentDone
      .filter((t) => t.assignedAgentId === agent.id)
      .map((t) => t.title)

    // Tasks currently in progress for this agent
    const inProgressTasks = allTasks
      .filter((t) => t.assignedAgentId === agent.id && t.status === "in_progress")
      .map((t) => t.title)

    // Blocked tasks
    const blockers = allTasks
      .filter((t) => t.assignedAgentId === agent.id && t.blockedReason)
      .map((t) => `${t.title}: ${t.blockedReason}`)

    const content = buildStandupMessage(agent, doneTasks, inProgressTasks, blockers)

    // Save to the channel
    const [saved] = await db.insert(messagesTable).values({
      channelId: channel.id,
      senderAgentId: agent.id,
      senderName: agent.name,
      senderAvatar: agent.avatar,
      content,
      messageType: "standup",
      reactions: [],
      metadata: { standup: true, date: new Date().toISOString().split("T")[0] },
    }).returning()

    results.push({ agent: agent.name, channel: channel.name, message: content })
  }

  return Response.json({
    ok: true,
    count: results.length,
    results,
  })
}
