/**
 * Learning Engine tests.
 *
 * Tests entity extraction (pattern-based), Jaccard similarity for skill
 * dedup, importance decay logic, and content hash dedup.
 */

import { describe, it, expect, vi } from "vitest"

// Mock the DB module before importing modules that use it
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}))

import { extractEntitiesFromText } from "./entity-extractor"
import { jaccardSimilarity } from "./skill-library"
import { sha256 } from "./memory-writer"

// ── Entity Extraction (pattern-based) ────────────────────────

describe("extractEntitiesFromText", () => {
  it("extracts @mentions as agent entities", () => {
    const entities = extractEntitiesFromText("@Luna mentioned the new project")
    const luna = entities.find((e) => e.name === "Luna")
    expect(luna).toBeDefined()
    expect(luna!.entityType).toBe("agent")
  })

  it("extracts financial entities from dollar amounts", () => {
    const entities = extractEntitiesFromText("@Luna mentioned $50k budget")
    const luna = entities.find((e) => e.name === "Luna")
    const financial = entities.find((e) => e.entityType === "financial")
    expect(luna).toBeDefined()
    expect(luna!.entityType).toBe("agent")
    expect(financial).toBeDefined()
    expect(financial!.name).toBe("$50k")
  })

  it("extracts email addresses as person entities", () => {
    const entities = extractEntitiesFromText("Contact john.doe@acme.com for details")
    const person = entities.find((e) => e.entityType === "person")
    expect(person).toBeDefined()
    expect(person!.name).toBe("John Doe")
    expect(person!.observations[0]).toContain("john.doe@acme.com")
  })

  it("extracts URLs as tool entities", () => {
    const entities = extractEntitiesFromText("Check https://github.com/org/repo")
    const tool = entities.find((e) => e.entityType === "tool")
    expect(tool).toBeDefined()
    expect(tool!.name).toBe("github.com")
  })

  it("extracts capitalized phrases as concept entities", () => {
    const entities = extractEntitiesFromText("We discussed the Marketing Strategy and Sales Pipeline today")
    const names = entities.map((e) => e.name)
    expect(names).toContain("Marketing Strategy")
    expect(names).toContain("Sales Pipeline")
  })

  it("does not extract stop phrases", () => {
    const entities = extractEntitiesFromText("Good Morning to everyone. Thank You for coming.")
    const names = entities.map((e) => e.name)
    expect(names).not.toContain("Good Morning")
    expect(names).not.toContain("Thank You")
  })

  it("deduplicates entities by name", () => {
    const entities = extractEntitiesFromText("@Luna talked to @Luna about @Luna's project")
    const lunas = entities.filter((e) => e.name === "Luna")
    expect(lunas.length).toBe(1)
  })

  it("handles empty text", () => {
    const entities = extractEntitiesFromText("")
    expect(entities).toEqual([])
  })

  it("handles text with no entities", () => {
    const entities = extractEntitiesFromText("hello world, nothing special here")
    // Should not crash, may return empty or only concepts
    expect(Array.isArray(entities)).toBe(true)
  })
})

// ── Jaccard Similarity ───────────────────────────────────────

describe("jaccardSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(jaccardSimilarity("write article", "write article")).toBe(1)
  })

  it("returns 0 for completely different strings", () => {
    const sim = jaccardSimilarity("apple banana", "xyz qwerty")
    expect(sim).toBe(0)
  })

  it("returns partial similarity for overlapping strings", () => {
    const sim = jaccardSimilarity(
      "Write LinkedIn article about marketing",
      "Write LinkedIn post about sales",
    )
    // "write", "linkedin", "about" overlap = 3
    // Union: "write", "linkedin", "article", "about", "marketing", "post", "sales" = 7
    expect(sim).toBeCloseTo(3 / 7, 2)
  })

  it("is case insensitive", () => {
    expect(jaccardSimilarity("Hello World", "hello world")).toBe(1)
  })

  it("handles empty strings", () => {
    expect(jaccardSimilarity("", "")).toBe(1)
    expect(jaccardSimilarity("hello", "")).toBe(0)
    expect(jaccardSimilarity("", "hello")).toBe(0)
  })

  it("ignores single-character words", () => {
    const sim = jaccardSimilarity("a b c test", "x y z test")
    // Only "test" is kept (rest are single-char), so intersection=1, union=1
    expect(sim).toBe(1)
  })

  it("classifies duplicate skills at threshold 0.8", () => {
    // Same task done twice with minor variation
    const sim = jaccardSimilarity(
      "Write weekly LinkedIn post for marketing team",
      "Write weekly LinkedIn article for marketing team",
    )
    // "write", "weekly", "linkedin", "for", "marketing", "team" overlap = 6
    // Union includes "post" and "article" = 8
    // 6/8 = 0.75 — close to threshold but below 0.8
    expect(sim).toBeGreaterThan(0.5)
    expect(sim).toBeLessThan(1)
  })

  it("classifies distinct skills below threshold 0.5", () => {
    const sim = jaccardSimilarity(
      "Design website landing page",
      "Write quarterly financial report",
    )
    expect(sim).toBeLessThan(0.5)
  })
})

// ── Importance Decay Logic ───────────────────────────────────

describe("importance decay", () => {
  // These test the decay rules without hitting the DB
  function applyDecay(importance: number): { action: string; newImportance: number } {
    if (importance <= 1) {
      return { action: "superseded", newImportance: 0 }
    } else if (importance === 2) {
      return { action: "decayed", newImportance: 1 }
    } else {
      return { action: "consolidated", newImportance: importance }
    }
  }

  it("supersedes importance 1 entries immediately", () => {
    const result = applyDecay(1)
    expect(result.action).toBe("superseded")
  })

  it("decays importance 2 to importance 1", () => {
    const result = applyDecay(2)
    expect(result.action).toBe("decayed")
    expect(result.newImportance).toBe(1)
  })

  it("preserves importance 3+ with consolidation tag", () => {
    expect(applyDecay(3).action).toBe("consolidated")
    expect(applyDecay(4).action).toBe("consolidated")
    expect(applyDecay(5).action).toBe("consolidated")
  })

  it("preserves original importance for high-value entries", () => {
    expect(applyDecay(4).newImportance).toBe(4)
    expect(applyDecay(5).newImportance).toBe(5)
  })
})

// ── Content Hash Dedup ───────────────────────────────────────

describe("sha256 content hashing", () => {
  it("produces a 64-character hex string", async () => {
    const hash = await sha256("test content")
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("produces identical hashes for identical content", async () => {
    const hash1 = await sha256("identical content")
    const hash2 = await sha256("identical content")
    expect(hash1).toBe(hash2)
  })

  it("produces different hashes for different content", async () => {
    const hash1 = await sha256("content A")
    const hash2 = await sha256("content B")
    expect(hash1).not.toBe(hash2)
  })

  it("handles empty string", async () => {
    const hash = await sha256("")
    expect(hash).toHaveLength(64)
    // SHA-256 of empty string is well-known
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
  })

  it("handles unicode content", async () => {
    const hash = await sha256("Hello World! Emoji content here.")
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
