import { db } from "@/lib/db"
import { channels } from "@/lib/db/schema"

export async function GET() {
  const allChannels = await db.select().from(channels)
  return Response.json(allChannels)
}
