// Sentry server config — activated when @sentry/nextjs is installed and SENTRY_DSN is set.
try {
  if (process.env.SENTRY_DSN) {
    const Sentry = require("@sentry/nextjs")
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    })
  }
} catch {
  // @sentry/nextjs not installed — no-op
}
