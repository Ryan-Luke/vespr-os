export async function GET() {
  try {
    const { db } = await import("@/lib/db")
    const { sql } = await import("drizzle-orm")
    await db.execute(sql`SELECT 1`)
    return Response.json({ status: "ok", timestamp: new Date().toISOString() })
  } catch {
    return Response.json({ status: "error", timestamp: new Date().toISOString() }, { status: 503 })
  }
}
