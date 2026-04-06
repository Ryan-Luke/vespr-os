import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session"

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/status",
  "/t/",
  "/api/public/",
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/fonts") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Verify signed session cookie
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const session = await verifySessionCookie(cookie)
  if (session) {
    return NextResponse.next()
  }

  // Not logged in — send to login (or signup if no users exist yet, handled by the login page)
  return NextResponse.redirect(new URL("/login", request.url))
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
