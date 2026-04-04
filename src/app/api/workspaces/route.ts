import { db } from "@/lib/db"
import { workspaces } from "@/lib/db/schema"

export async function GET() {
  const all = await db.select().from(workspaces).orderBy(workspaces.createdAt)
  return Response.json(all)
}

export async function POST(req: Request) {
  const body = await req.json()
  const slug = (body.name || "workspace").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const [ws] = await db.insert(workspaces).values({
    name: body.name,
    slug,
    icon: body.icon || "🏢",
    description: body.description || null,
    businessType: body.businessType || "agency",
    industry: body.industry || null,
    website: body.website || null,
    businessProfile: body.businessProfile || {},
  }).returning()
  return Response.json(ws)
}
