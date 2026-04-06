import { executeScheduledTasks } from "@/lib/agents/cron-executor"

// GET /api/cron/agent-schedules
// Called by Vercel Cron every 1-5 minutes. Checks agent_schedules for
// due jobs and runs them. Protected by CRON_SECRET to prevent external
// access.
export async function GET(req: Request) {
  // Verify the cron secret to prevent unauthorized access
  const authHeader = req.headers.get("authorization")
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await executeScheduledTasks()
  return Response.json(result)
}
