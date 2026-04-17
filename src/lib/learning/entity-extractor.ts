/**
 * Entity Extractor — pattern-based and LLM-powered entity extraction.
 *
 * Extracts named entities from text (conversations, task descriptions,
 * agent outputs) for the knowledge graph.
 */

import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"

// ── Types ────────────────────────────────────────────────────

export interface ExtractedEntity {
  name: string
  entityType: "person" | "company" | "project" | "tool" | "concept" | "agent" | "financial"
  observations: string[]
  relations: { targetName: string; relationType: string }[]
}

// ── Pattern-based extraction (fast, no LLM) ──────────────────

const PATTERNS = {
  /** @mentions → agent entities */
  mention: /@(\w+)/g,
  /** URLs → tool/company entities */
  url: /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)/g,
  /** Email addresses → person entities */
  email: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  /** Dollar amounts → financial entities */
  financial: /\$[\d,]+(?:\.\d{1,2})?(?:\s*[kKmMbB])?/g,
  /** Capitalized multi-word phrases → potential entity names (2-4 words) */
  capitalizedPhrase: /(?<![.!?]\s)(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?=[\s,.:;!?]|$)/g,
}

/** Common words that should not be extracted as entities */
const STOP_PHRASES = new Set([
  "The", "This", "That", "These", "Those", "Monday", "Tuesday",
  "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
  "Good Morning", "Good Afternoon", "Good Evening", "Thank You",
  "Best Regards", "Kind Regards", "In Addition", "For Example",
  "On The", "At The", "In The", "Of The",
])

/**
 * Fast pattern-based entity extraction. No LLM call.
 * Good for real-time extraction during conversations.
 */
export function extractEntitiesFromText(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []
  const seen = new Set<string>()

  // @mentions → agent entities
  for (const match of text.matchAll(PATTERNS.mention)) {
    const name = match[1]
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      entities.push({
        name,
        entityType: "agent",
        observations: [`Mentioned in conversation`],
        relations: [],
      })
    }
  }

  // Email addresses → person entities
  for (const match of text.matchAll(PATTERNS.email)) {
    const name = match[1].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    const domain = match[2]
    if (!seen.has(match[0].toLowerCase())) {
      seen.add(match[0].toLowerCase())
      entities.push({
        name,
        entityType: "person",
        observations: [`Has email ${match[0]}`],
        relations: [{ targetName: domain, relationType: "works_with" }],
      })
    }
  }

  // URLs → tool/company entities
  for (const match of text.matchAll(PATTERNS.url)) {
    const domain = match[1]
    if (!seen.has(domain.toLowerCase())) {
      seen.add(domain.toLowerCase())
      entities.push({
        name: domain,
        entityType: "tool",
        observations: [`Referenced URL: ${match[0]}`],
        relations: [],
      })
    }
  }

  // Financial amounts → financial entities
  for (const match of text.matchAll(PATTERNS.financial)) {
    const amount = match[0]
    if (!seen.has(amount)) {
      seen.add(amount)
      entities.push({
        name: amount,
        entityType: "financial",
        observations: [`Amount mentioned: ${amount}`],
        relations: [],
      })
    }
  }

  // Capitalized phrases → potential entities
  for (const match of text.matchAll(PATTERNS.capitalizedPhrase)) {
    const phrase = match[1].trim()
    if (!seen.has(phrase.toLowerCase()) && !STOP_PHRASES.has(phrase)) {
      seen.add(phrase.toLowerCase())
      entities.push({
        name: phrase,
        entityType: "concept",
        observations: [`Mentioned in context`],
        relations: [],
      })
    }
  }

  return entities
}

// ── LLM-powered extraction (deep, used during consolidation) ─

/**
 * Deep entity extraction using LLM. Used during consolidation
 * for more accurate and contextual extraction.
 */
export async function extractEntitiesWithLLM(
  text: string,
  apiKey: string,
): Promise<ExtractedEntity[]> {
  const anthropic = createAnthropic({ apiKey })

  const { text: response } = await generateText({
    model: anthropic("claude-haiku-4-5"),
    maxOutputTokens: 2048,
    system: `You are an entity extraction engine. Extract named entities from text and return structured JSON.`,
    prompt: `Extract all named entities from this text. For each entity, determine:
1. The name (canonical form)
2. The type: "person", "company", "project", "tool", "concept", or "agent"
3. Key observations (facts about this entity from the text)
4. Relations to other entities

Text:
${text}

Return ONLY valid JSON in this format:
{
  "entities": [
    {
      "name": "Entity Name",
      "entityType": "person",
      "observations": ["Observation 1", "Observation 2"],
      "relations": [{ "targetName": "Other Entity", "relationType": "works_with" }]
    }
  ]
}

Relation types: "works_with", "manages", "uses", "part_of", "related_to"
If no entities found, return { "entities": [] }`,
  })

  try {
    // Extract JSON from the response (handle potential markdown wrapping)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return []
    const parsed = JSON.parse(jsonMatch[0])
    return (parsed.entities || []) as ExtractedEntity[]
  } catch {
    return []
  }
}
