/**
 * Memory scoring module.
 *
 * Implements the Park et al. generative-agents scoring formula with
 * tiered weights and MMR (Maximal Marginal Relevance) re-ranking for
 * diversity in retrieved memory sets.
 *
 * Core formula:
 *   recencyScore(date) = exp(-0.693 * daysSince(date) / 7)   // 7-day half-life
 *   compositeScore = w_recency * recency + w_importance * (importance/5) + w_relevance * relevance
 *
 * MMR re-ranking (Carbonell & Goldberg 1998):
 *   MMR = lambda * relevance - (1-lambda) * max_similarity_to_selected
 */

import type { MemoryEntry, TierWeights, TierName, ScoredEntry } from "./types"

// ── Constants ────────────────────────────────────────────────────────

/** Half-life in days for the exponential decay function. */
const HALF_LIFE_DAYS = 7

/** ln(2), used in the decay formula. */
const LN2 = 0.693

/** Lambda parameter for MMR. Higher = more relevance, lower = more diversity. */
const MMR_LAMBDA = 0.7

// ── Tier weight presets ──────────────────────────────────────────────

const TIER_WEIGHTS: Record<TierName, TierWeights> = {
  recent: { recency: 0.3, importance: 0.3, relevance: 0.4 },
  summary: { recency: 0.2, importance: 0.3, relevance: 0.5 },
  shared: { recency: 0.1, importance: 0.3, relevance: 0.6 },
  archive: { recency: 0.1, importance: 0.2, relevance: 0.7 },
}

/**
 * Returns the tier weight preset for the given tier name.
 */
export function getTierWeights(tier: TierName): TierWeights {
  return TIER_WEIGHTS[tier]
}

// ── Recency scoring ──────────────────────────────────────────────────

/**
 * Exponential decay with a 7-day half-life.
 * Returns a value in [0, 1] where 1 = now, 0.5 = 7 days ago, 0.25 = 14 days ago, etc.
 */
export function recencyScore(date: Date, now?: Date): number {
  const reference = now ?? new Date()
  const msPerDay = 86_400_000
  const daysSince = Math.max(0, (reference.getTime() - date.getTime()) / msPerDay)
  return Math.exp(-LN2 * daysSince / HALF_LIFE_DAYS)
}

// ── Relevance scoring (text matching) ────────────────────────────────

/**
 * Simple keyword relevance between a query and a memory entry.
 * Uses normalized term overlap. No embeddings needed.
 * Returns a value in [0, 1].
 */
export function textRelevance(query: string, entry: MemoryEntry): number {
  if (!query || query.trim().length === 0) return 0.5 // neutral when no query

  const queryTerms = tokenize(query)
  if (queryTerms.length === 0) return 0.5

  // Search across title, content, and tags
  const entryText = `${entry.title} ${entry.content} ${entry.tags.join(" ")}`
  const entryTerms = new Set(tokenize(entryText))

  let matches = 0
  for (const term of queryTerms) {
    if (entryTerms.has(term)) {
      matches++
    }
  }

  return matches / queryTerms.length
}

/**
 * Tokenize text into lowercase alphanumeric terms, filtering stop words.
 */
function tokenize(text: string): string[] {
  const STOP_WORDS = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "out", "off", "over",
    "under", "again", "further", "then", "once", "and", "but", "or",
    "nor", "not", "so", "yet", "both", "each", "few", "more", "most",
    "other", "some", "such", "no", "only", "own", "same", "than", "too",
    "very", "just", "because", "about", "up", "it", "its", "this", "that",
    "these", "those", "i", "me", "my", "we", "our", "you", "your", "he",
    "him", "his", "she", "her", "they", "them", "their", "what", "which",
    "who", "whom", "how", "when", "where", "why", "all", "if",
  ])

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

// ── Composite scoring ────────────────────────────────────────────────

/**
 * Score a single memory entry using the Park et al. formula.
 *
 * compositeScore = w_recency * recency + w_importance * (importance/5) + w_relevance * relevance
 */
export function scoreEntry(
  entry: MemoryEntry,
  tier: TierName,
  query?: string,
  now?: Date,
): ScoredEntry {
  const weights = getTierWeights(tier)
  const rec = recencyScore(entry.createdAt, now)
  const imp = entry.importance / 5
  const rel = textRelevance(query ?? "", entry)

  const composite =
    weights.recency * rec +
    weights.importance * imp +
    weights.relevance * rel

  return {
    entry,
    scores: {
      recency: rec,
      importance: imp,
      relevance: rel,
      composite,
    },
    tier,
  }
}

/**
 * Score a batch of memory entries and sort by composite score descending.
 */
export function scoreEntries(
  entries: MemoryEntry[],
  tier: TierName,
  query?: string,
  now?: Date,
): ScoredEntry[] {
  return entries
    .map((entry) => scoreEntry(entry, tier, query, now))
    .sort((a, b) => b.scores.composite - a.scores.composite)
}

// ── MMR Re-ranking ───────────────────────────────────────────────────

/**
 * Compute pairwise similarity between two scored entries for MMR.
 * Uses a weighted combination of:
 *   0.4 * tagJaccard + 0.3 * dateProximity + 0.3 * agentMatch
 */
export function entrySimilarity(a: ScoredEntry, b: ScoredEntry): number {
  // Tag Jaccard similarity
  const tagsA = new Set(a.entry.tags)
  const tagsB = new Set(b.entry.tags)
  const intersection = new Set([...tagsA].filter((t) => tagsB.has(t)))
  const union = new Set([...tagsA, ...tagsB])
  const tagJaccard = union.size > 0 ? intersection.size / union.size : 0

  // Date proximity: 1 when same day, decays with distance
  const msPerDay = 86_400_000
  const daysDiff = Math.abs(a.entry.createdAt.getTime() - b.entry.createdAt.getTime()) / msPerDay
  const dateProximity = Math.exp(-LN2 * daysDiff / 3) // 3-day half-life for proximity

  // Agent match: 1 if same agent (or both shared), 0 otherwise
  const agentMatch = a.entry.agentId === b.entry.agentId ? 1 : 0

  return 0.4 * tagJaccard + 0.3 * dateProximity + 0.3 * agentMatch
}

/**
 * MMR (Maximal Marginal Relevance) re-ranking.
 *
 * Selects entries iteratively, balancing relevance against diversity.
 * MMR(i) = lambda * relevance(i) - (1-lambda) * max_j(similarity(i, j))
 * where j ranges over already-selected entries.
 *
 * @param entries Pre-scored entries (sorted by composite score)
 * @param maxResults Maximum number of entries to return
 * @param lambda Balance parameter: 1.0 = pure relevance, 0.0 = pure diversity
 */
export function mmrRerank(
  entries: ScoredEntry[],
  maxResults: number,
  lambda: number = MMR_LAMBDA,
): ScoredEntry[] {
  if (entries.length === 0) return []
  if (entries.length <= maxResults) return entries

  const selected: ScoredEntry[] = []
  const candidates = [...entries]

  // Always start with the highest-scoring entry
  selected.push(candidates.shift()!)

  while (selected.length < maxResults && candidates.length > 0) {
    let bestIdx = 0
    let bestMmr = -Infinity

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]
      const relevance = candidate.scores.composite

      // Max similarity to any already-selected entry
      let maxSim = 0
      for (const sel of selected) {
        const sim = entrySimilarity(candidate, sel)
        if (sim > maxSim) maxSim = sim
      }

      const mmr = lambda * relevance - (1 - lambda) * maxSim

      if (mmr > bestMmr) {
        bestMmr = mmr
        bestIdx = i
      }
    }

    selected.push(candidates.splice(bestIdx, 1)[0])
  }

  return selected
}
