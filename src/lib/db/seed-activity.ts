import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function seedActivity() {
  // Fetch existing agents to get real IDs
  const agents = await db.select().from(schema.agents)
  const agentMap = new Map(agents.map((a) => [a.name, a.id]))

  function agentId(name: string) {
    return agentMap.get(name) ?? null
  }

  const now = Date.now()
  const minutes = (n: number) => new Date(now - n * 60 * 1000)

  const entries = [
    {
      agentId: agentId("Maya"),
      agentName: "Maya",
      action: "completed_task",
      description: 'Completed task "Write Q1 growth blog post"',
      metadata: { taskId: "blog-q1" },
      createdAt: minutes(3),
    },
    {
      agentId: agentId("Zara"),
      agentName: "Zara",
      action: "sent_message",
      description: "Sent 3 messages in #marketing",
      metadata: { channel: "marketing", count: 3 },
      createdAt: minutes(7),
    },
    {
      agentId: agentId("Jordan"),
      agentName: "Jordan",
      action: "completed_task",
      description: "Found 23 new prospects matching ICP criteria",
      metadata: { prospectCount: 23 },
      createdAt: minutes(12),
    },
    {
      agentId: agentId("Sam"),
      agentName: "Sam",
      action: "updated_knowledge",
      description: "Synced 47 contacts to GHL",
      metadata: { contactCount: 47, destination: "GHL" },
      createdAt: minutes(18),
    },
    {
      agentId: agentId("Casey"),
      agentName: "Casey",
      action: "completed_task",
      description: "Resolved 12 support tickets",
      metadata: { ticketCount: 12 },
      createdAt: minutes(25),
    },
    {
      agentId: agentId("Morgan"),
      agentName: "Morgan",
      action: "flagged",
      description: "Needs March bank statement for reconciliation",
      metadata: { urgency: "high" },
      createdAt: minutes(30),
    },
    {
      agentId: agentId("Maya"),
      agentName: "Maya",
      action: "created_sop",
      description: 'Created SOP "Content Publishing Workflow v2"',
      metadata: { sopTitle: "Content Publishing Workflow v2" },
      createdAt: minutes(45),
    },
    {
      agentId: agentId("Zara"),
      agentName: "Zara",
      action: "completed_task",
      description: "Scheduled 8 social media posts for next week",
      metadata: { postCount: 8 },
      createdAt: minutes(55),
    },
    {
      agentId: agentId("Jordan"),
      agentName: "Jordan",
      action: "sent_message",
      description: "Sent outreach sequence to 15 leads",
      metadata: { leadCount: 15 },
      createdAt: minutes(70),
    },
    {
      agentId: agentId("Sam"),
      agentName: "Sam",
      action: "completed_task",
      description: "Updated CRM pipeline with 9 new opportunities",
      metadata: { opportunityCount: 9 },
      createdAt: minutes(90),
    },
    {
      agentId: agentId("Casey"),
      agentName: "Casey",
      action: "sent_message",
      description: "Sent CSAT follow-up to 20 customers",
      metadata: { customerCount: 20 },
      createdAt: minutes(120),
    },
    {
      agentId: agentId("Morgan"),
      agentName: "Morgan",
      action: "updated_knowledge",
      description: "Updated Q1 financial summary in knowledge base",
      metadata: { category: "finance" },
      createdAt: minutes(150),
    },
    {
      agentId: agentId("Maya"),
      agentName: "Maya",
      action: "completed_task",
      description: 'Finished editing "Company Culture" landing page',
      metadata: { page: "culture" },
      createdAt: minutes(180),
    },
    {
      agentId: agentId("Jordan"),
      agentName: "Jordan",
      action: "updated_knowledge",
      description: "Added 5 competitor profiles to knowledge base",
      metadata: { competitorCount: 5 },
      createdAt: minutes(210),
    },
    {
      agentId: agentId("Sam"),
      agentName: "Sam",
      action: "sent_message",
      description: "Notified team about 3 overdue invoices",
      metadata: { invoiceCount: 3 },
      createdAt: minutes(240),
    },
  ]

  await db.insert(schema.activityLog).values(entries)
  console.log(`Seeded ${entries.length} activity log entries`)
}

seedActivity()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
