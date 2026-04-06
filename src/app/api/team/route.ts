import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

// GET /api/team - List all team members (no passwords, no secrets)
export async function GET() {
  const members = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    avatarEmoji: users.avatarEmoji,
    createdAt: users.createdAt,
    lastLoginAt: users.lastLoginAt,
  }).from(users).orderBy(desc(users.createdAt))

  return Response.json({ members })
}
