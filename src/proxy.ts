import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session"

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/status",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/health",
  "/login",
  "/signup",
  "/reset-password",
  "/forgot-password",
]

const PUBLIC_PREFIXES = [
  "/api/public/",
  "/api/cron/",
  "/api/share-card/",
  "/t/",
  "/_next",
  "/assets",
  "/fonts",
]

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true
  // Static files
  if (pathname.includes(".") && !pathname.startsWith("/api/")) return true
  return false
}

function isCronRoute(pathname: string): boolean {
  return pathname.startsWith("/api/cron/")
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Billing webhook — Stripe signature verification, not session auth
  if (pathname === "/api/billing/webhook") {
    return NextResponse.next()
  }

  // OAuth callback — needs to be accessible during flow
  if (pathname.startsWith("/api/integrations/oauth/")) {
    return NextResponse.next()
  }

  // Invite acceptance — public (token-based auth)
  if (pathname.startsWith("/api/invites/accept") || pathname.startsWith("/invite/")) {
    return NextResponse.next()
  }

  // Public routes: pass through
  if (isPublicRoute(pathname) && !isCronRoute(pathname)) {
    return NextResponse.next()
  }

  // Cron routes: validate CRON_SECRET header
  if (isCronRoute(pathname)) {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get("authorization")
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 })
    }
    return NextResponse.next()
  }

  // All other routes: validate session cookie
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const session = await verifySessionCookie(cookie)

  if (!session) {
    // API routes: return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // Onboarding is special — new users need access after signup
    if (pathname.startsWith("/onboarding")) {
      // Check if they at least have a cookie (even if workspace isn't set up yet)
      const rawCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
      if (rawCookie) return NextResponse.next()
    }
    // Page routes: redirect to login
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Inject session info as headers for route handlers
  const response = NextResponse.next()
  response.headers.set("x-user-id", session.userId)
  response.headers.set("x-workspace-id", session.workspaceId)
  response.headers.set("x-user-role", session.role)
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
