import { withAuth } from "@/lib/auth/with-auth"
import { listTemplateSummaries } from "@/lib/templates"

export async function GET() {
  await withAuth()
  const summaries = listTemplateSummaries()
  return Response.json(summaries)
}
