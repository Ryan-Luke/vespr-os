import { db } from "@/lib/db"
import { agents, messages, tasks, knowledgeEntries } from "@/lib/db/schema"
import { ilike, or } from "drizzle-orm"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")

  if (!q || q.trim().length === 0) {
    return Response.json({ agents: [], messages: [], tasks: [], knowledge: [] })
  }

  const pattern = `%${q}%`

  const [agentResults, messageResults, taskResults, knowledgeResults] =
    await Promise.all([
      db
        .select()
        .from(agents)
        .where(or(ilike(agents.name, pattern), ilike(agents.role, pattern))),
      db
        .select()
        .from(messages)
        .where(
          or(
            ilike(messages.content, pattern),
            ilike(messages.senderName, pattern)
          )
        )
        .limit(5),
      db
        .select()
        .from(tasks)
        .where(
          or(ilike(tasks.title, pattern), ilike(tasks.description, pattern))
        )
        .limit(5),
      db
        .select()
        .from(knowledgeEntries)
        .where(
          or(
            ilike(knowledgeEntries.title, pattern),
            ilike(knowledgeEntries.content, pattern)
          )
        )
        .limit(5),
    ])

  return Response.json({
    agents: agentResults,
    messages: messageResults,
    tasks: taskResults,
    knowledge: knowledgeResults,
  })
}
