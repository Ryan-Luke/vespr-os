// Web search and fetch tools for autonomous agents.
// Gives agents the ability to research competitors, check pricing,
// find market data, and pull content from URLs without the user
// needing to provide everything.
//
// Search uses Brave Search API (free tier: 2000 queries/month).
// If BRAVE_SEARCH_API_KEY is not set, search returns an error telling
// the agent to ask the user instead.
//
// Fetch extracts readable text from any URL. No API key needed.

import { tool, jsonSchema } from "ai"

const BRAVE_API = "https://api.search.brave.com/res/v1/web/search"

interface BraveSearchResult {
  title: string
  url: string
  description: string
}

async function braveSearch(query: string, count = 5): Promise<BraveSearchResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY
  if (!key) {
    throw new Error("Web search is not configured. Ask the user for the information you need instead.")
  }

  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(count, 10)),
  })

  const res = await fetch(`${BRAVE_API}?${params}`, {
    headers: { "Accept": "application/json", "X-Subscription-Token": key },
  })

  if (!res.ok) {
    throw new Error(`Search failed: HTTP ${res.status}`)
  }

  const data = await res.json() as {
    web?: { results?: { title: string; url: string; description: string }[] }
  }

  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }))
}

async function fetchAndExtractText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BusinessOS/1.0)",
      "Accept": "text/html,application/xhtml+xml,text/plain",
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    throw new Error(`Fetch failed: HTTP ${res.status}`)
  }

  const contentType = res.headers.get("content-type") ?? ""
  const text = await res.text()

  // If it's HTML, strip tags and extract readable text
  if (contentType.includes("html")) {
    return extractTextFromHTML(text)
  }

  // Plain text or JSON, return as-is (clamped)
  return text.slice(0, 8000)
}

function extractTextFromHTML(html: string): string {
  // Remove scripts, styles, and HTML tags. Keep text content.
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()

  // Clamp to ~8000 chars to fit in context
  return text.slice(0, 8000)
}

/**
 * Build the web research tools for the autonomous toolkit.
 */
export function buildWebTools() {
  return {
    web_search: tool({
      description:
        "Search the web for information. Use this to research competitors, find pricing data, check market trends, or look up anything you need to do your job well. Returns the top results with titles, URLs, and descriptions. Follow up with web_fetch to read the full content of any interesting result.",
      inputSchema: jsonSchema<{ query: string; count?: number }>({
        type: "object",
        properties: {
          query: { type: "string", minLength: 2, maxLength: 200, description: "The search query" },
          count: { type: "number", minimum: 1, maximum: 10, description: "Number of results to return (default 5)" },
        },
        required: ["query"],
        additionalProperties: false,
      }),
      execute: async ({ query, count }) => {
        try {
          const results = await braveSearch(query, count ?? 5)
          return {
            ok: true,
            query,
            resultCount: results.length,
            results: results.map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.description,
            })),
          }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Search failed" }
        }
      },
    }),

    web_fetch: tool({
      description:
        "Fetch and read the content of a web page. Use this after web_search to read a specific result in full, or when you need to check a specific URL (competitor website, pricing page, documentation, etc). Returns the extracted text content, not the raw HTML.",
      inputSchema: jsonSchema<{ url: string }>({
        type: "object",
        properties: {
          url: { type: "string", minLength: 5, maxLength: 500, description: "The full URL to fetch" },
        },
        required: ["url"],
        additionalProperties: false,
      }),
      execute: async ({ url }) => {
        try {
          const text = await fetchAndExtractText(url)
          return {
            ok: true,
            url,
            contentLength: text.length,
            content: text,
          }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Fetch failed" }
        }
      },
    }),

    meta_ad_library: tool({
      description:
        "Search Meta's Ad Library for a competitor's active ads. Use this during the R&D phase when researching competitors. Returns a link to the Ad Library results and fetches the page content so you can analyze what ads they're running. Great for understanding competitor positioning, messaging, and creative angles.",
      inputSchema: jsonSchema<{ competitorName: string; country?: string }>({
        type: "object",
        properties: {
          competitorName: { type: "string", minLength: 1, maxLength: 100, description: "The competitor's brand or business name" },
          country: { type: "string", maxLength: 5, description: "Country code (default US)" },
        },
        required: ["competitorName"],
        additionalProperties: false,
      }),
      execute: async ({ competitorName, country }) => {
        try {
          const countryCode = country ?? "US"
          const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${countryCode}&q=${encodeURIComponent(competitorName)}`

          // Try to fetch the page content. Meta may block server-side fetches,
          // so we return the URL either way for the user to check manually.
          let adContent = ""
          try {
            adContent = await fetchAndExtractText(adLibraryUrl)
          } catch {
            adContent = "Could not fetch ad library page directly. The URL is still valid for manual review."
          }

          return {
            ok: true,
            competitorName,
            adLibraryUrl,
            contentPreview: adContent.slice(0, 3000),
            message: `Meta Ad Library results for "${competitorName}". Share this link with the user: ${adLibraryUrl}`,
          }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Ad library search failed" }
        }
      },
    }),
  }
}
