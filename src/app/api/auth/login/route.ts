import { cookies } from "next/headers"

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "businessos2026"
const SESSION_COOKIE = "bos_session"
const SESSION_TOKEN = "authenticated"

export async function POST(req: Request) {
  const { password } = await req.json() as { password: string }

  if (password === AUTH_PASSWORD) {
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, SESSION_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return Response.json({ ok: true })
  }

  return Response.json({ error: "Invalid password" }, { status: 401 })
}
