// ── Sentry Error Reporting ────────────────────────────────
// Abstraction layer for error tracking. Install @sentry/nextjs
// and set SENTRY_DSN to activate. Until then, falls back to console.

type SeverityLevel = "fatal" | "error" | "warning" | "info" | "debug"

interface CaptureContext {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  user?: { id?: string; email?: string }
  level?: SeverityLevel
}

let SentrySDK: any = null

export function initSentry() {
  if (process.env.SENTRY_DSN) {
    try {
      SentrySDK = require("@sentry/nextjs")
      SentrySDK.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
      })
    } catch {
      console.warn("[sentry] @sentry/nextjs not installed. Install it to enable error tracking.")
    }
  }
}

export function captureException(error: unknown, context?: CaptureContext): void {
  if (SentrySDK) {
    SentrySDK.captureException(error, {
      tags: context?.tags,
      extra: context?.extra,
      user: context?.user,
      level: context?.level,
    })
    return
  }
  console.error("[error]", error)
}

export function captureMessage(msg: string, level: SeverityLevel = "info"): void {
  if (SentrySDK) {
    SentrySDK.captureMessage(msg, level)
    return
  }
  if (level === "error" || level === "fatal") console.error(`[${level}]`, msg)
  else if (level === "warning") console.warn(`[${level}]`, msg)
  else console.log(`[${level}]`, msg)
}
