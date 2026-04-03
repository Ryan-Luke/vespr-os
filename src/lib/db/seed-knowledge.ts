import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

const entries = [
  {
    title: "Section 8 Real Estate Offer — ICP & Positioning",
    content: `## Ideal Customer Profile\n\n- Investors with **$250k+** looking to invest into Section 8\n- Already own other real estate properties\n- Looking for passive income through government-backed rental programs\n\n## Value Proposition\n\n- Turnkey Section 8 investment properties\n- Pre-qualified tenants with guaranteed government rent payments\n- Full property management included\n\n## Key Messaging\n\n- Focus on passive income and government-backed security\n- Lead with ROI numbers and cash flow projections\n- Differentiate from traditional real estate with the Section 8 stability angle\n\n## Pricing\n\n- Calls booked at **$140/call**\n- Targeting **3-4X ROAS** on ad spend\n\n> See also: [[V1 Ad Campaign Performance]], [[GHL Pipeline Setup]]`,
    category: "campaigns",
    tags: ["section-8", "real-estate", "ICP", "ads"],
    linkedEntries: [] as string[], // will be patched after insert
    createdByName: "Maya",
    createdByAgentId: null as string | null,
  },
  {
    title: "V1 Ad Campaign Performance",
    content: `## Launch Status\n\n**Date:** April 2, 2026\n**Status:** ✅ Live and performing\n\n## Day 1 Metrics\n\n| Metric | Value |\n|--------|-------|\n| Booked calls | 2 |\n| Cost per call | $140 |\n| Financial qualification | Both passed ($250k+) |\n| Organic inbound | 4 messages |\n| Call requests | 1 this week |\n\n## Projections\n\n- Scale to **4-5 calls/day** by end of next week\n- CPM solid, CTR above benchmark\n- Expecting **3-4X ROAS** at target daily spend\n- Pacing **$120k/month** at daily spend goal\n\n## Creative Pipeline\n\n- [x] V1 creatives running\n- [ ] 3 new ad copy variations (Maya working on these)\n- [ ] Case study angle in development\n- [ ] Need more variations to prevent fatigue at scale\n\n> See also: [[Section 8 Real Estate Offer — ICP & Positioning]]`,
    category: "campaigns",
    tags: ["section-8", "ads", "performance", "metrics"],
    linkedEntries: [] as string[],
    createdByName: "Zara",
    createdByAgentId: null as string | null,
  },
  {
    title: "GHL Pipeline Setup",
    content: `## Pipeline Stages\n\n1. **New Lead**\n2. **AI Inbound** (organic — separate from paid)\n3. **Qualified**\n4. **Call Booked**\n5. **Call Completed**\n6. **Proposal Sent**\n7. **Closed Won**\n8. **Closed Lost**\n\n## Tags System\n\n- **Source:** paid, organic, referral\n- **Campaign:** section-8, fintech, ai-services\n- **Qualification:** financial-qualified, needs-review\n\n## Automations\n\n- New lead → auto-enrichment with company data\n- Call booked → Slack notification to sales channel\n- 48hr no-response → follow-up sequence triggered\n\n> See also: [[Section 8 Real Estate Offer — ICP & Positioning]], [[Fintech Outreach Campaign]]`,
    category: "processes",
    tags: ["GHL", "CRM", "pipeline", "automation"],
    linkedEntries: [] as string[],
    createdByName: "Sam",
    createdByAgentId: null as string | null,
  },
  {
    title: "Content Strategy — Q2 2026",
    content: `## Cadence\n\n- **Blog:** 5 posts/week\n- **Instagram:** 15 posts/week (carousel + stories)\n- **LinkedIn:** 3 posts/week\n\n## Focus Areas\n\n1. AI in small business *(primary)*\n2. Section 8 real estate investing\n3. Business automation case studies\n\n## SEO Targets\n\n| Keyword | Volume | Competition |\n|---------|--------|-------------|\n| business automation | 3x higher than expected | Medium |\n| AI for small business | Growing 40% MoM | Low |\n| Section 8 investing | Low competition | High intent |\n\n## Content Repurposing Flow\n\n\`\`\`\nBlog Post\n  ├── 5 Instagram carousel slides\n  ├── 3 LinkedIn posts\n  ├── Short-form ad creatives (top performers)\n  └── Monthly LinkedIn series\n\`\`\`\n\n## Sprint Progress\n\n- **14/20** blog posts published\n- Organic traffic up **22%** toward 30% goal`,
    category: "campaigns",
    tags: ["content", "SEO", "blog", "social-media"],
    linkedEntries: [] as string[],
    createdByName: "Maya",
    createdByAgentId: null as string | null,
  },
  {
    title: "Fintech Outreach Campaign",
    content: `## Target\n\n- **Vertical:** Fintech companies\n- **ICP:** Series A to Series C, 50-500 employees\n\n## Status\n\n- ✅ 23 qualified prospects identified\n- ✅ All added to GHL with enrichment data\n- ✅ 5-step personalized email sequences drafted\n- ⏳ Awaiting owner approval on sequences\n\n## Results\n\n| Metric | Value |\n|--------|-------|\n| Prospects found | 23 |\n| Opened email #1 | 8 (35% open rate) |\n| Replied | 3 |\n| Next step | Follow up with remaining 15 |\n\n## A/B Testing\n\n- Testing 5 subject line variants\n- Currently in review stage`,
    category: "campaigns",
    tags: ["fintech", "outreach", "email", "B2B"],
    linkedEntries: [] as string[],
    createdByName: "Jordan",
    createdByAgentId: null as string | null,
  },
  {
    title: "Customer Support SLAs",
    content: `## Response Time\n\n- **Target:** < 2 hours\n- **Current:** 1.2 hours ✅\n\n## Resolution Rate\n\n- **Target:** 95% same-day\n- **Current:** 93% *(working toward goal)*\n\n## Escalation Matrix\n\n| Issue Type | Handler | Escalation |\n|-----------|---------|------------|\n| General inquiry | Casey | — |\n| Refund < $100 | Casey (auto-approve) | — |\n| Refund > $100 | Casey | → Owner approval |\n| Shipping delay | Drew → Casey | — |\n| Technical issue | Casey | → Operations |\n\n## Active Issues\n\n- Customer #4521: requesting $189 refund (delayed shipment)\n- Order #ORD-8834: delayed by FedEx weather at Memphis hub`,
    category: "processes",
    tags: ["support", "SLA", "escalation"],
    linkedEntries: [] as string[],
    createdByName: "Casey",
    createdByAgentId: null as string | null,
  },
  {
    title: "Shipping & Fulfillment Tracker",
    content: `## Overview\n\n- **Active shipments:** 23\n- **On-time rate:** 94%\n- **Avg delivery:** 3.2 days\n\n## Carrier Mix\n\n| Carrier | Share | Reliability |\n|---------|-------|-------------|\n| FedEx | 60% | ⚠️ Memphis issues |\n| UPS | 30% | ✅ Reliable |\n| USPS | 10% | ✅ OK for small items |\n\n## Current Delays\n\n- **FedEx Memphis hub** — weather delays\n- Affected: #ORD-8834, #ORD-8891, #ORD-8903\n- ETA: Tomorrow by 5 PM\n\n## Recommendations\n\n- Consider adding UPS as backup for Southeast routes\n- FedEx Memphis has been unreliable 3x this quarter`,
    category: "metrics",
    tags: ["shipping", "fulfillment", "logistics"],
    linkedEntries: [] as string[],
    createdByName: "Drew",
    createdByAgentId: null as string | null,
  },
  {
    title: "Monthly Financial Overview",
    content: `## Status\n\n⚠️ **Q1 P&L blocked** — need March bank statement\n\n## AI Agent Costs (Monthly)\n\n| Agent | Cost |\n|-------|------|\n| Jordan (Lead Research) | $45.00 |\n| Maya (Content) | $28.50 |\n| Riley (Outreach) | $22.30 |\n| Casey (Support) | $18.90 |\n| Alex (SEO) | $15.20 |\n| Nyx | $12.00 |\n| Quinn (Process) | $9.80 |\n| Zara (Social) | $8.90 |\n| Finley (Bookkeeper) | $5.20 |\n| Morgan (P&L) | $4.50 |\n| Sam (CRM) | $3.50 |\n| Drew (Order Tracking) | $1.20 |\n| **Total** | **$174.90** |\n\n## Action Required\n\n🔴 Upload March bank statement to unblock P&L report`,
    category: "financial",
    tags: ["P&L", "costs", "budget"],
    linkedEntries: [] as string[],
    createdByName: "Morgan",
    createdByAgentId: null as string | null,
  },
]

// Link map by title index: entry index -> array of linked entry indices
const linkMap: Record<number, number[]> = {
  0: [1, 2, 7], // Section 8 -> V1 Ad, GHL, Financial
  1: [0, 2],    // V1 Ad -> Section 8, GHL
  2: [0, 4],    // GHL -> Section 8, Fintech
  3: [0, 1],    // Content Strategy -> Section 8, V1 Ad
  4: [2],       // Fintech -> GHL
  5: [6],       // Support SLAs -> Shipping
  6: [5],       // Shipping -> Support SLAs
  7: [0],       // Financial -> Section 8
}

async function seed() {
  console.log("Seeding knowledge entries...")

  // Insert all entries first (without links)
  const inserted = await db
    .insert(schema.knowledgeEntries)
    .values(entries)
    .returning()

  console.log(`Inserted ${inserted.length} entries`)

  // Now patch linked entries with real IDs
  const { eq } = await import("drizzle-orm")
  for (const [idx, linkedIndices] of Object.entries(linkMap)) {
    const entry = inserted[Number(idx)]
    const linkedIds = linkedIndices.map((i) => inserted[i].id)
    await db
      .update(schema.knowledgeEntries)
      .set({ linkedEntries: linkedIds })
      .where(eq(schema.knowledgeEntries.id, entry.id))
  }

  console.log("Linked entries patched. Done!")
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
