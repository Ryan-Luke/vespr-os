import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "fs"
import { join, relative } from "path"

/**
 * Auth coverage audit — verifies that every API route that should be
 * protected actually imports `withAuth` from the auth module.
 *
 * Routes exempt from auth:
 * - auth/* (login, signup, status, logout — public by definition)
 * - cron/* (server-to-server, protected by cron secret)
 * - public/* (intentionally public endpoints)
 * - billing/webhook (Stripe webhook, verified by signature)
 * - invites/accept (public invite acceptance flow)
 */

// Routes that are intentionally unauthenticated
const EXEMPT_PATTERNS = [
  "auth/login",
  "auth/signup",
  "auth/status",
  "auth/logout",
  "cron/",
  "public/",
  "billing/webhook",
  "invites/accept",
  "integrations/oauth/", // OAuth flow uses PKCE state + cookies, not withAuth
  "share-card/", // OG image routes — intentionally public for social sharing
  "auth/forgot-password", // Public — anyone can request a password reset
  "auth/reset-password", // Public — token-based auth, not session-based
  "health/", // Public — monitoring/uptime checks
]

function isExempt(routePath: string): boolean {
  return EXEMPT_PATTERNS.some((pattern) => routePath.includes(pattern))
}

function findRouteFiles(dir: string): string[] {
  const results: string[] = []

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir)
    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (entry === "route.ts" || entry === "route.tsx") {
        results.push(fullPath)
      }
    }
  }

  walk(dir)
  return results
}

describe("API route auth coverage", () => {
  const apiDir = join(process.cwd(), "src", "app", "api")
  const routeFiles = findRouteFiles(apiDir)

  it("finds API route files", () => {
    expect(routeFiles.length).toBeGreaterThan(0)
  })

  // Filter to non-exempt routes
  const protectedRoutes = routeFiles.filter((file) => {
    const rel = relative(apiDir, file)
    return !isExempt(rel)
  })

  it("has protected routes to check", () => {
    expect(protectedRoutes.length).toBeGreaterThan(0)
  })

  for (const routeFile of protectedRoutes) {
    const rel = relative(apiDir, routeFile)

    it(`${rel} imports withAuth`, () => {
      const content = readFileSync(routeFile, "utf8")
      const hasWithAuth = content.includes("withAuth")
      // Some routes use manual session verification (verifySessionCookie).
      // This is an acceptable alternative to withAuth.
      const hasManualAuth = content.includes("verifySessionCookie")
      expect(
        hasWithAuth || hasManualAuth,
        `Route ${rel} does not import withAuth or verifySessionCookie — it may be missing auth protection.`,
      ).toBe(true)
    })
  }
})
