import { db } from "@/lib/db"
import { agents } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const allAgents = await db.select().from(agents)
  return Response.json(allAgents)
}

export async function POST(req: Request) {
  const body = await req.json()
  const [newAgent] = await db.insert(agents).values(body).returning()
  return Response.json(newAgent)
}
