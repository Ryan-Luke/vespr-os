import { describe, it, expect } from "vitest"
import {
  recencyScore,
  textRelevance,
  scoreEntry,
  scoreEntries,
  mmrRerank,
  getTierWeights,
  entrySimilarity,
} from "./scoring"
import type { MemoryEntry, ScoredEntry } from "./types"

// ── Helpers ──────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: overrides.id ?? "entry-1",
    workspaceId: "ws-1",
    agentId: overrides.agentId ?? "agent-1",
    entryType: overrides.entryType ?? "daily",
    title: overrides.title ?? "Test Entry",
    content: overrides.content ?? "Some test content about marketing strategy",
    importance: overrides.importance ?? 3,
    tags: overrides.tags ?? ["test"],
    contentHash: null,
    supersededBy: null,
    metadata: {},
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

// ── recencyScore ─────────────────────────────────────────────────────

describe("recencyScore", () => {
  it("returns 1.0 for entries created right now", () => {
    const now = new Date()
    const score = recencyScore(now, now)
    expect(score).toBeCloseTo(1.0, 5)
  })

  it("returns ~0.5 for entries 7 days old (half-life)", () => {
    const now = new Date("2026-04-06T00:00:00Z")
    const sevenDaysAgo = new Date("2026-03-30T00:00:00Z")
    const score = recencyScore(sevenDaysAgo, now)
    expect(score).toBeCloseTo(0.5, 2)
  })

  it("returns ~0.25 for entries 14 days old (two half-lives)", () => {
    const now = new Date("2026-04-06T00:00:00Z")
    const fourteenDaysAgo = new Date("2026-03-23T00:00:00Z")
    const score = recencyScore(fourteenDaysAgo, now)
    expect(score).toBeCloseTo(0.25, 2)
  })

  it("returns ~0.125 for entries 21 days old (three half-lives)", () => {
    const now = new Date("2026-04-06T00:00:00Z")
    const twentyOneDaysAgo = new Date("2026-03-16T00:00:00Z")
    const score = recencyScore(twentyOneDaysAgo, now)
    expect(score).toBeCloseTo(0.125, 2)
  })

  it("never returns negative values", () => {
    const now = new Date("2026-04-06T00:00:00Z")
    const longAgo = new Date("2020-01-01T00:00:00Z")
    const score = recencyScore(longAgo, now)
    expect(score).toBeGreaterThan(0)
  })

  it("handles future dates by clamping to 1", () => {
    const now = new Date("2026-04-06T00:00:00Z")
    const future = new Date("2026-04-10T00:00:00Z")
    const score = recencyScore(future, now)
    // Future dates get daysSince = 0, so score = 1
    expect(score).toBeCloseTo(1.0, 5)
  })
})

// ── textRelevance ────────────────────────────────────────────────────

describe("textRelevance", () => {
  it("returns 0.5 (neutral) for empty query", () => {
    const entry = makeEntry({ content: "marketing strategy plan" })
    expect(textRelevance("", entry)).toBe(0.5)
  })

  it("returns 1.0 for perfect term match", () => {
    const entry = makeEntry({
      title: "Marketing Strategy",
      content: "marketing strategy",
      tags: [],
    })
    expect(textRelevance("marketing strategy", entry)).toBeCloseTo(1.0, 5)
  })

  it("returns 0 when no terms match", () => {
    const entry = makeEntry({
      title: "Unrelated",
      content: "completely different topic about cooking recipes",
      tags: [],
    })
    expect(textRelevance("quantum physics", entry)).toBe(0)
  })

  it("returns partial score for partial matches", () => {
    const entry = makeEntry({
      title: "Marketing Plan",
      content: "our marketing plan for Q1",
      tags: ["marketing"],
    })
    const score = textRelevance("marketing budget allocation", entry)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })

  it("matches against tags", () => {
    const entry = makeEntry({
      title: "Report",
      content: "quarterly figures",
      tags: ["finance", "revenue"],
    })
    const score = textRelevance("revenue report", entry)
    expect(score).toBeGreaterThan(0)
  })
})

// ── getTierWeights ───────────────────────────────────────────────────

describe("getTierWeights", () => {
  it("returns correct weights for recent tier", () => {
    const weights = getTierWeights("recent")
    expect(weights).toEqual({ recency: 0.3, importance: 0.3, relevance: 0.4 })
  })

  it("returns correct weights for summary tier", () => {
    const weights = getTierWeights("summary")
    expect(weights).toEqual({ recency: 0.2, importance: 0.3, relevance: 0.5 })
  })

  it("returns correct weights for shared tier", () => {
    const weights = getTierWeights("shared")
    expect(weights).toEqual({ recency: 0.1, importance: 0.3, relevance: 0.6 })
  })

  it("returns correct weights for archive tier", () => {
    const weights = getTierWeights("archive")
    expect(weights).toEqual({ recency: 0.1, importance: 0.2, relevance: 0.7 })
  })

  it("weights always sum to 1.0", () => {
    for (const tier of ["recent", "summary", "shared", "archive"] as const) {
      const w = getTierWeights(tier)
      expect(w.recency + w.importance + w.relevance).toBeCloseTo(1.0, 5)
    }
  })
})

// ── scoreEntry ───────────────────────────────────────────────────────

describe("scoreEntry", () => {
  it("produces a composite score between 0 and 1", () => {
    const entry = makeEntry({ importance: 5 })
    const scored = scoreEntry(entry, "recent", "marketing", new Date())
    expect(scored.scores.composite).toBeGreaterThanOrEqual(0)
    expect(scored.scores.composite).toBeLessThanOrEqual(1)
  })

  it("scores importance 5 higher than importance 1", () => {
    const now = new Date()
    const highImp = makeEntry({ id: "high", importance: 5, createdAt: now })
    const lowImp = makeEntry({ id: "low", importance: 1, createdAt: now })

    const highScored = scoreEntry(highImp, "recent", "test", now)
    const lowScored = scoreEntry(lowImp, "recent", "test", now)

    expect(highScored.scores.importance).toBeGreaterThan(lowScored.scores.importance)
  })

  it("scores recent entries higher than old entries in the recent tier", () => {
    const now = new Date("2026-04-06T00:00:00Z")
    const recentEntry = makeEntry({ id: "recent", createdAt: now, importance: 3 })
    const oldEntry = makeEntry({
      id: "old",
      createdAt: new Date("2026-03-01T00:00:00Z"),
      importance: 3,
    })

    const recentScored = scoreEntry(recentEntry, "recent", "", now)
    const oldScored = scoreEntry(oldEntry, "recent", "", now)

    expect(recentScored.scores.recency).toBeGreaterThan(oldScored.scores.recency)
  })

  it("assigns the correct tier to the scored entry", () => {
    const entry = makeEntry()
    const scored = scoreEntry(entry, "summary")
    expect(scored.tier).toBe("summary")
  })
})

// ── scoreEntries ─────────────────────────────────────────────────────

describe("scoreEntries", () => {
  it("returns entries sorted by composite score descending", () => {
    const now = new Date()
    const entries = [
      makeEntry({ id: "1", importance: 1, createdAt: now }),
      makeEntry({ id: "2", importance: 5, createdAt: now }),
      makeEntry({ id: "3", importance: 3, createdAt: now }),
    ]

    const scored = scoreEntries(entries, "recent", "", now)

    for (let i = 0; i < scored.length - 1; i++) {
      expect(scored[i].scores.composite).toBeGreaterThanOrEqual(scored[i + 1].scores.composite)
    }
  })

  it("returns empty array for empty input", () => {
    expect(scoreEntries([], "recent")).toEqual([])
  })
})

// ── entrySimilarity ──────────────────────────────────────────────────

describe("entrySimilarity", () => {
  it("returns 1.0 for identical entries", () => {
    const now = new Date()
    const entry = makeEntry({ tags: ["a", "b"], agentId: "agent-1", createdAt: now })
    const scored = scoreEntry(entry, "recent", "", now)
    expect(entrySimilarity(scored, scored)).toBeCloseTo(1.0, 2)
  })

  it("returns lower similarity for different tags and agents", () => {
    const now = new Date()
    const entry1 = makeEntry({ id: "1", tags: ["marketing", "strategy"], agentId: "agent-1", createdAt: now })
    const entry2 = makeEntry({ id: "2", tags: ["finance", "budgets"], agentId: "agent-2", createdAt: new Date(now.getTime() - 7 * 86_400_000) })

    const scored1 = scoreEntry(entry1, "recent", "", now)
    const scored2 = scoreEntry(entry2, "recent", "", now)

    const sim = entrySimilarity(scored1, scored2)
    expect(sim).toBeLessThan(0.5) // quite different
  })

  it("gives higher similarity for same tags", () => {
    const now = new Date()
    const entry1 = makeEntry({ id: "1", tags: ["marketing", "strategy"], agentId: "agent-1", createdAt: now })
    const entry2 = makeEntry({ id: "2", tags: ["marketing", "strategy"], agentId: "agent-2", createdAt: now })

    const scored1 = scoreEntry(entry1, "recent", "", now)
    const scored2 = scoreEntry(entry2, "recent", "", now)

    const sim = entrySimilarity(scored1, scored2)
    // Same tags (jaccard = 1.0), same date (proximity = 1.0), different agent (0)
    // 0.4 * 1.0 + 0.3 * 1.0 + 0.3 * 0 = 0.7
    expect(sim).toBeCloseTo(0.7, 1)
  })
})

// ── mmrRerank ────────────────────────────────────────────────────────

describe("mmrRerank", () => {
  it("returns empty array for empty input", () => {
    expect(mmrRerank([], 5)).toEqual([])
  })

  it("returns all entries when maxResults >= entries.length", () => {
    const entries = [
      scoreEntry(makeEntry({ id: "1" }), "recent"),
      scoreEntry(makeEntry({ id: "2" }), "recent"),
    ]
    const result = mmrRerank(entries, 10)
    expect(result.length).toBe(2)
  })

  it("returns exactly maxResults entries when more are available", () => {
    const now = new Date()
    const entries = Array.from({ length: 10 }, (_, i) =>
      scoreEntry(makeEntry({
        id: `entry-${i}`,
        importance: 5 - (i % 5),
        tags: [`tag-${i % 3}`],
        agentId: `agent-${i % 2}`,
        createdAt: new Date(now.getTime() - i * 86_400_000),
      }), "recent", "test", now),
    )
    // Sort by composite (required input for mmrRerank)
    entries.sort((a, b) => b.scores.composite - a.scores.composite)

    const result = mmrRerank(entries, 5)
    expect(result.length).toBe(5)
  })

  it("selects the highest-scoring entry first", () => {
    const now = new Date()
    const entries = [
      scoreEntry(makeEntry({ id: "low", importance: 1 }), "recent", "test", now),
      scoreEntry(makeEntry({ id: "high", importance: 5 }), "recent", "test", now),
      scoreEntry(makeEntry({ id: "mid", importance: 3 }), "recent", "test", now),
    ]
    entries.sort((a, b) => b.scores.composite - a.scores.composite)

    const result = mmrRerank(entries, 2)
    expect(result[0].entry.id).toBe("high")
  })

  it("promotes diversity by selecting dissimilar entries", () => {
    const now = new Date()
    // Create two clusters: 3 entries with same tags and 2 with different tags
    const similar1 = scoreEntry(makeEntry({ id: "s1", importance: 5, tags: ["marketing"], agentId: "a1", createdAt: now }), "recent", "", now)
    const similar2 = scoreEntry(makeEntry({ id: "s2", importance: 4, tags: ["marketing"], agentId: "a1", createdAt: now }), "recent", "", now)
    const similar3 = scoreEntry(makeEntry({ id: "s3", importance: 4, tags: ["marketing"], agentId: "a1", createdAt: now }), "recent", "", now)
    const diverse1 = scoreEntry(makeEntry({ id: "d1", importance: 3, tags: ["finance"], agentId: "a2", createdAt: new Date(now.getTime() - 5 * 86_400_000) }), "recent", "", now)
    const diverse2 = scoreEntry(makeEntry({ id: "d2", importance: 3, tags: ["ops"], agentId: "a3", createdAt: new Date(now.getTime() - 3 * 86_400_000) }), "recent", "", now)

    const entries = [similar1, similar2, similar3, diverse1, diverse2]
    entries.sort((a, b) => b.scores.composite - a.scores.composite)

    const result = mmrRerank(entries, 3)
    const resultIds = result.map((r) => r.entry.id)

    // MMR should pick s1 first (highest score), but then promote at least
    // one diverse entry over the remaining similar ones
    expect(resultIds[0]).toBe("s1")
    // At least one of the diverse entries should make it in
    const hasDiverse = resultIds.includes("d1") || resultIds.includes("d2")
    expect(hasDiverse).toBe(true)
  })
})
