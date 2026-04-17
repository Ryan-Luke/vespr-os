// ── Structured Logger ─────────────────────────────────────
// Lightweight structured JSON logging for API routes and server code.
// No external dependencies — just structured console output.

type LogLevel = "info" | "warn" | "error"

interface LogContext {
  workspaceId?: string
  userId?: string
  agentId?: string
  route?: string
  [key: string]: unknown
}

interface Logger {
  info(msg: string, data?: Record<string, unknown>): void
  warn(msg: string, data?: Record<string, unknown>): void
  error(msg: string, data?: Record<string, unknown>, error?: unknown): void
}

function emit(level: LogLevel, context: LogContext, msg: string, data?: Record<string, unknown>, error?: unknown) {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    ...context,
    message: msg,
  }
  if (data && Object.keys(data).length > 0) {
    entry.data = data
  }
  if (error) {
    entry.error = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : String(error)
  }

  const output = JSON.stringify(entry)
  if (level === "error") {
    console.error(output)
  } else if (level === "warn") {
    console.warn(output)
  } else {
    console.log(output)
  }
}

/**
 * Create a structured logger bound to a request context.
 *
 * Usage:
 *   const log = createLogger({ route: "/api/agents", workspaceId: "ws-1" })
 *   log.info("Fetched agents", { count: 5 })
 *   log.error("Failed to fetch", {}, err)
 */
export function createLogger(context: LogContext = {}): Logger {
  return {
    info: (msg, data) => emit("info", context, msg, data),
    warn: (msg, data) => emit("warn", context, msg, data),
    error: (msg, data, error) => emit("error", context, msg, data, error),
  }
}

/**
 * Higher-order function that wraps a Next.js route handler with
 * automatic request/response logging (method, path, duration, status).
 *
 * Usage:
 *   export const GET = withRequestLogging(async (req) => {
 *     return Response.json({ ok: true })
 *   })
 */
export function withRequestLogging(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const start = Date.now()
    const url = new URL(req.url)
    const log = createLogger({ route: url.pathname })

    log.info("Request started", { method: req.method, path: url.pathname })

    try {
      const response = await handler(req)
      const duration = Date.now() - start
      log.info("Request completed", {
        method: req.method,
        path: url.pathname,
        status: response.status,
        durationMs: duration,
      })
      return response
    } catch (err) {
      const duration = Date.now() - start
      log.error("Request failed", {
        method: req.method,
        path: url.pathname,
        durationMs: duration,
      }, err)
      throw err
    }
  }
}
