// Notion documents client.
//
// Uses internal integration tokens (no OAuth required for internal integrations).
// Creates pages with rich text blocks converted from markdown.
//
// Docs: https://developers.notion.com/reference/intro

import { getCredentials } from "@/lib/integrations/credentials"
import type {
  DocsClient,
  DocsCreatePageInput,
  DocsUpdatePageInput,
  DocsPage,
  DocsPageDetail,
  DocsSearchResult,
} from "@/lib/integrations/capabilities/docs"

const NOTION_API = "https://api.notion.com/v1"
const NOTION_VERSION = "2022-06-28"

async function callNotion<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(NOTION_API + path, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
      ...(init.headers ?? {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (payload as { message?: string })?.message ??
      (payload as { code?: string })?.code ??
      `Notion HTTP ${res.status}`
    throw new Error(`Notion API error: ${msg}`)
  }
  return payload as T
}

async function loadNotionToken(workspaceId: string): Promise<string> {
  const creds = await getCredentials(workspaceId, "notion")
  if (!creds?.api_key) {
    throw new Error("Notion is not connected for this workspace. Connect it via the integration picker first.")
  }
  return creds.api_key
}

// ── Markdown to Notion blocks ────────────────────────────
// Simplified converter. Handles paragraphs, headings, bullets, code.

interface NotionBlock {
  object: "block"
  type: string
  [key: string]: unknown
}

function markdownToBlocks(markdown: string): NotionBlock[] {
  const lines = markdown.split("\n")
  const blocks: NotionBlock[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith("### ")) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: trimmed.slice(4) } }],
        },
      })
    } else if (trimmed.startsWith("## ")) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: trimmed.slice(3) } }],
        },
      })
    } else if (trimmed.startsWith("# ")) {
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: {
          rich_text: [{ type: "text", text: { content: trimmed.slice(2) } }],
        },
      })
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: trimmed.slice(2) } }],
        },
      })
    } else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: [{ type: "text", text: { content: trimmed.replace(/^\d+\.\s/, "") } }],
        },
      })
    } else if (trimmed.startsWith("```")) {
      blocks.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: trimmed.replace(/^```\w*\s?/, "").replace(/```$/, "") } }],
          language: "plain text",
        },
      })
    } else {
      // Notion rich_text content has a 2000-char limit per segment
      const chunks: { type: string; text: { content: string } }[] = []
      for (let i = 0; i < trimmed.length; i += 2000) {
        chunks.push({ type: "text", text: { content: trimmed.slice(i, i + 2000) } })
      }
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: chunks },
      })
    }
  }
  return blocks
}

// ── Notion blocks to plain text ──────────────────────────

function extractRichText(richText: { plain_text?: string }[]): string {
  return (richText ?? []).map((t) => t.plain_text ?? "").join("")
}

function blocksToText(blocks: { type: string; [key: string]: unknown }[]): string {
  const lines: string[] = []
  for (const block of blocks) {
    const b = block as Record<string, unknown>
    const blockData = b[block.type] as { rich_text?: { plain_text?: string }[] } | undefined
    if (blockData?.rich_text) {
      const text = extractRichText(blockData.rich_text)
      if (block.type === "heading_1") lines.push(`# ${text}`)
      else if (block.type === "heading_2") lines.push(`## ${text}`)
      else if (block.type === "heading_3") lines.push(`### ${text}`)
      else if (block.type === "bulleted_list_item") lines.push(`- ${text}`)
      else if (block.type === "numbered_list_item") lines.push(`1. ${text}`)
      else lines.push(text)
    }
  }
  return lines.join("\n")
}

// ── Page operations ──────────────────────────────────────

interface NotionPageRaw {
  id: string
  url: string
  created_time?: string
  last_edited_time?: string
  properties?: {
    title?: { title?: { plain_text?: string }[] }
    Name?: { title?: { plain_text?: string }[] }
    [key: string]: unknown
  }
}

function extractTitle(page: NotionPageRaw): string {
  const titleProp = page.properties?.title ?? page.properties?.Name
  if (titleProp?.title) {
    return titleProp.title.map((t) => t.plain_text ?? "").join("") || "Untitled"
  }
  return "Untitled"
}

function toDocsPage(raw: NotionPageRaw): DocsPage {
  return {
    id: raw.id,
    title: extractTitle(raw),
    url: raw.url,
    createdAt: raw.created_time ?? null,
    updatedAt: raw.last_edited_time ?? null,
  }
}

async function createPage(
  workspaceId: string,
  input: DocsCreatePageInput,
): Promise<DocsPage> {
  const token = await loadNotionToken(workspaceId)
  const blocks = markdownToBlocks(input.content)

  let parent: Record<string, string>
  if (input.parentId) {
    parent = { type: "page_id", page_id: input.parentId }
  } else {
    // Try to find a suitable parent page by searching
    const searchResults = await callNotion<{
      results: NotionPageRaw[]
    }>(token, "/search", {
      method: "POST",
      body: JSON.stringify({
        filter: { value: "page", property: "object" },
        page_size: 1,
      }),
    })
    const firstPage = searchResults.results?.[0]
    if (firstPage) {
      parent = { type: "page_id", page_id: firstPage.id }
    } else {
      throw new Error(
        "No accessible Notion pages found. Make sure your Notion integration has access to at least one page.",
      )
    }
  }

  const data = await callNotion<NotionPageRaw>(
    token,
    "/pages",
    {
      method: "POST",
      body: JSON.stringify({
        parent,
        properties: {
          title: {
            title: [{ type: "text", text: { content: input.title } }],
          },
        },
        children: blocks.slice(0, 100), // Notion API limit: 100 blocks per request
      }),
    },
  )

  return toDocsPage(data)
}

async function updatePage(
  workspaceId: string,
  pageId: string,
  input: DocsUpdatePageInput,
): Promise<DocsPage> {
  const token = await loadNotionToken(workspaceId)

  // Update title if provided
  if (input.title) {
    await callNotion(
      token,
      `/pages/${encodeURIComponent(pageId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            title: {
              title: [{ type: "text", text: { content: input.title } }],
            },
          },
        }),
      },
    )
  }

  // Replace content if provided.
  if (input.content) {
    // Fetch existing children
    const existing = await callNotion<{
      results: { id: string }[]
    }>(token, `/blocks/${encodeURIComponent(pageId)}/children?page_size=100`)

    // Delete existing blocks
    for (const block of existing.results ?? []) {
      await callNotion(token, `/blocks/${encodeURIComponent(block.id)}`, { method: "DELETE" })
    }

    // Append new blocks
    const newBlocks = markdownToBlocks(input.content)
    if (newBlocks.length > 0) {
      await callNotion(
        token,
        `/blocks/${encodeURIComponent(pageId)}/children`,
        {
          method: "PATCH",
          body: JSON.stringify({ children: newBlocks.slice(0, 100) }),
        },
      )
    }
  }

  // Fetch updated page
  const page = await callNotion<NotionPageRaw>(
    token,
    `/pages/${encodeURIComponent(pageId)}`,
  )
  return toDocsPage(page)
}

async function getPage(
  workspaceId: string,
  pageId: string,
): Promise<DocsPageDetail> {
  const token = await loadNotionToken(workspaceId)

  const page = await callNotion<NotionPageRaw>(
    token,
    `/pages/${encodeURIComponent(pageId)}`,
  )

  const blocks = await callNotion<{
    results: { type: string; [key: string]: unknown }[]
  }>(token, `/blocks/${encodeURIComponent(pageId)}/children?page_size=100`)

  return {
    ...toDocsPage(page),
    content: blocksToText(blocks.results ?? []),
  }
}

async function search(
  workspaceId: string,
  query: string,
  limit: number,
): Promise<DocsSearchResult[]> {
  const token = await loadNotionToken(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 50)

  const data = await callNotion<{
    results: (NotionPageRaw & {
      properties?: Record<string, unknown>
    })[]
  }>(
    token,
    "/search",
    {
      method: "POST",
      body: JSON.stringify({
        query,
        filter: { value: "page", property: "object" },
        page_size: clamped,
      }),
    },
  )

  return (data.results ?? []).map((r) => ({
    id: r.id,
    title: extractTitle(r),
    url: r.url,
    snippet: null, // Notion search doesn't return content snippets
  }))
}

export const notionDocsClient: DocsClient = {
  providerKey: "notion",
  createPage,
  updatePage,
  getPage,
  search,
}
