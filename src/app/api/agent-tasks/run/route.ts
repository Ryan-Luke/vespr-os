import { runAgentTask } from "@/lib/agents/autonomous"

// POST /api/agent-tasks/run
// Trigger an autonomous agent task. The agent runs with its full context
// (personality, SOPs, memories) plus tools for posting to channels,
// creating documents, posting wins, handing off, and calling integrations.
//
// This endpoint is called by:
//   - Onboarding completion (kick off R&D)
//   - Handoff protocol (one agent triggers the next)
//   - Cron jobs
//   - Manual trigger from UI
export async function POST(req: Request) {
  const body = await req.json() as {
    agentId?: string
    channelId?: string
    workspaceId?: string
    prompt?: string
  }

  if (!body.agentId || !body.channelId || !body.workspaceId || !body.prompt) {
    return Response.json(
      { error: "agentId, channelId, workspaceId, and prompt are required" },
      { status: 400 },
    )
  }

  const result = await runAgentTask({
    agentId: body.agentId,
    channelId: body.channelId,
    workspaceId: body.workspaceId,
    prompt: body.prompt,
  })

  return Response.json(result)
}
