// Task retry & error recovery for agent tasks.
// Evaluates stuck or failed tasks and decides: requeue, fail, or ok.

export interface RetryableTask {
  id: string
  status: string
  retryCount: number
  maxRetries: number
  updatedAt: Date
  error?: string | null
}

export type RetryDecision = "requeue" | "fail" | "ok"

const STUCK_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Evaluate a task and decide what to do:
 *   "ok"      — task is running fine or already completed
 *   "requeue" — task is stuck and has retries left
 *   "fail"    — task is stuck and has exhausted retries
 */
export function evaluateTaskRetry(task: RetryableTask): RetryDecision {
  // Already completed or failed — nothing to do
  if (task.status === "completed" || task.status === "failed") {
    return "ok"
  }

  // Queued tasks are waiting — not stuck
  if (task.status === "queued") {
    return "ok"
  }

  // Running tasks — check if stuck (updatedAt older than threshold)
  if (task.status === "running") {
    const elapsed = Date.now() - task.updatedAt.getTime()
    if (elapsed < STUCK_THRESHOLD_MS) {
      return "ok" // still within acceptable time
    }

    // Stuck — check retry budget
    if (task.retryCount < task.maxRetries) {
      return "requeue"
    }

    return "fail"
  }

  // Interrupted tasks always requeue if budget allows
  if (task.status === "interrupted") {
    if (task.retryCount < task.maxRetries) {
      return "requeue"
    }
    return "fail"
  }

  return "ok"
}
