// Seed sanitized AI Skills playbooks into knowledge_entries.
// Idempotent: skips entries whose title already exists.
// Called automatically by POST /api/onboarding and manually via
// `npx tsx scripts/seed-playbooks.ts`.
//
// These are agent-only reference material (tagged `internal`). They are
// hidden from the user-facing Knowledge page and global search. Agents
// pull them via the phase-relevance lookup in the chat route.

import fs from "node:fs/promises"
import path from "node:path"
import { db } from "@/lib/db"
import { knowledgeEntries } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const SRC = path.join(process.cwd(), "..", "AI Skills Sanitized")
// Fallback: check the desktop path if the relative path doesn't exist.
// The relative path works when cwd is inside business-os/app (npx tsx, next dev).
// The desktop path is a fallback for edge cases.
const SRC_DESKTOP = "/Users/lukefontaine/Desktop/AI Skills Sanitized"

interface PlaybookMapping {
  category: "business" | "clients" | "campaigns" | "processes" | "metrics" | "financial"
  topicTags: string[]
  phases: string[]
}

const MAPPINGS: Record<string, PlaybookMapping> = {
  "high-ticket-offer-interview": { category: "business", topicTags: ["offer", "high-ticket", "interview-framework"], phases: ["offer", "product"] },
  "offer-architecture": { category: "business", topicTags: ["offer", "architecture"], phases: ["offer"] },
  "offer-math-pricing": { category: "business", topicTags: ["offer", "pricing"], phases: ["offer", "monetization"] },
  "offer-proof-flywheel": { category: "business", topicTags: ["offer", "proof"], phases: ["offer", "marketing"] },
  "low-ticket-to-high-ticket": { category: "business", topicTags: ["offer", "ascension"], phases: ["offer"] },
  "upsell-ascension-path": { category: "business", topicTags: ["offer", "ascension", "revenue"], phases: ["offer", "monetization"] },
  "customer-lifetime-value": { category: "business", topicTags: ["ltv", "retention"], phases: ["delivery", "operations"] },
  "scale-100k-to-1m": { category: "business", topicTags: ["scale", "strategy"], phases: ["operations"] },
  "scale-200k-to-1m": { category: "business", topicTags: ["scale", "strategy"], phases: ["operations"] },
  "three-commitments-to-scale": { category: "business", topicTags: ["scale", "mindset"], phases: ["operations"] },
  "multiple-funnels-to-scale": { category: "business", topicTags: ["scale", "funnel"], phases: ["marketing", "operations"] },
  "fix-revenue-plateau": { category: "business", topicTags: ["scale", "diagnostic"], phases: ["operations"] },
  "competitive-advantages": { category: "business", topicTags: ["strategy", "moat"], phases: ["product", "offer"] },
  "scattered-to-scalable": { category: "business", topicTags: ["scale", "transformation"], phases: ["operations"] },
  "call-funnel-blueprint": { category: "clients", topicTags: ["sales", "call-funnel"], phases: ["marketing", "monetization"] },
  "fix-your-call-funnel": { category: "clients", topicTags: ["sales", "call-funnel", "diagnostic"], phases: ["marketing"] },
  "generate-40-50-calls-daily": { category: "clients", topicTags: ["sales", "call-funnel", "scale"], phases: ["marketing"] },
  "recruit-top-closers": { category: "processes", topicTags: ["hiring", "sales"], phases: ["operations"] },
  "pipeline-accuracy-challenge": { category: "clients", topicTags: ["sales", "pipeline"], phases: ["monetization", "operations"] },
  "pipeline-triage-desk": { category: "clients", topicTags: ["sales", "pipeline"], phases: ["monetization"] },
  "pixel-conditioning": { category: "campaigns", topicTags: ["paid-ads", "meta", "optimization"], phases: ["marketing"] },
  "creative-family-micro-tests": { category: "campaigns", topicTags: ["paid-ads", "creative-testing"], phases: ["marketing"] },
  "scaling-ads-15k-day": { category: "campaigns", topicTags: ["paid-ads", "scale"], phases: ["marketing"] },
  "stabilize-cac-scaling": { category: "campaigns", topicTags: ["paid-ads", "cac"], phases: ["marketing", "monetization"] },
  "meta-ad-restrictions-prep": { category: "campaigns", topicTags: ["paid-ads", "compliance", "meta"], phases: ["marketing"] },
  "venus-fly-trap-ad-strategy": { category: "campaigns", topicTags: ["paid-ads", "strategy"], phases: ["marketing"] },
  "content-ads-cold-traffic": { category: "campaigns", topicTags: ["paid-ads", "content", "cold-traffic"], phases: ["marketing"] },
  "vsl-that-converts": { category: "campaigns", topicTags: ["content", "vsl", "conversion"], phases: ["offer", "marketing"] },
  "hidden-vssl-framework": { category: "campaigns", topicTags: ["content", "vsl"], phases: ["marketing"] },
  "confirmation-page-that-converts": { category: "campaigns", topicTags: ["funnel", "conversion"], phases: ["marketing", "monetization"] },
  "ai-first-visibility": { category: "campaigns", topicTags: ["content", "seo", "visibility"], phases: ["marketing"] },
  "free-community-pipeline": { category: "campaigns", topicTags: ["content", "community"], phases: ["marketing"] },
  "partner-webinar-system": { category: "campaigns", topicTags: ["partnerships", "webinar"], phases: ["marketing"] },
  "operating-cadence": { category: "processes", topicTags: ["cadence", "rhythms"], phases: ["operations"] },
  "operator-mindset": { category: "processes", topicTags: ["mindset", "leadership"], phases: ["operations"] },
  "planning-offsite": { category: "processes", topicTags: ["planning", "strategy"], phases: ["operations"] },
  "hiring-roadmap-coaches": { category: "processes", topicTags: ["hiring", "team"], phases: ["operations"] },
  "coaching-delivery-model": { category: "processes", topicTags: ["delivery", "coaching"], phases: ["delivery"] },
  "client-communication-cadence": { category: "processes", topicTags: ["delivery", "retention"], phases: ["delivery", "operations"] },
}

function extractTitle(content: string): string {
  const m = content.match(/^#\s+(.+?)$/m)
  return m ? m[1].trim() : "Untitled playbook"
}

/**
 * Seed all sanitized playbook files into knowledge_entries.
 * Idempotent (checks by title). Returns count of inserted entries.
 * Silently returns 0 if the source directory doesn't exist.
 */
export async function seedPlaybooks(): Promise<number> {
  // Find the source directory
  let srcDir = SRC
  try {
    await fs.access(srcDir)
  } catch {
    try {
      await fs.access(SRC_DESKTOP)
      srcDir = SRC_DESKTOP
    } catch {
      return 0
    }
  }

  const files = (await fs.readdir(srcDir)).filter((f) => f.endsWith(".md") && f !== "INDEX.md")
  let inserted = 0

  for (const file of files) {
    const slug = file.replace(/\.md$/, "")
    const mapping = MAPPINGS[slug]
    if (!mapping) continue

    const content = await fs.readFile(path.join(srcDir, file), "utf8")
    const title = extractTitle(content)

    const existing = await db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.title, title))
      .limit(1)

    if (existing.length > 0) continue

    const tags = [
      "internal",
      "playbook",
      ...mapping.topicTags,
      ...mapping.phases.map((p) => `phase:${p}`),
    ]

    await db.insert(knowledgeEntries).values({
      title,
      content,
      category: mapping.category,
      tags,
      createdByName: "System",
    })
    inserted++
  }

  return inserted
}
