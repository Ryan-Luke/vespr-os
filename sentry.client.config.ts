// Sentry client config — activated when @sentry/nextjs is installed and NEXT_PUBLIC_SENTRY_DSN is set.
try {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const Sentry = require("@sentry/nextjs")
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    })
  }
} catch {
  // @sentry/nextjs not installed — no-op
}
