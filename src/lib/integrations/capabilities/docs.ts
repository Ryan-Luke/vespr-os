// Documents capability. Agents can create and update pages/docs in
// whatever document tool the user has connected (Notion, Google Docs).
// Document creation is NOT approval-gated since it's internal workspace
// content (not customer-facing). The user can always review/edit in
// the native tool.

import { listIntegrations } from "@/lib/integrations/credentials"

export interface DocsCreatePageInput {
  title: string
  content: string        // Markdown or plain text (client converts to provider format)
  parentId?: string      // parent page/database ID (if omitted, creates at top level)
}

export interface DocsUpdatePageInput {
  content?: string       // replaces page body
  title?: string         // updates title
}

export interface DocsPage {
  id: string
  title: string
  url: string
  createdAt: string | null
  updatedAt: string | null
}

export interface DocsPageDetail extends DocsPage {
  content: string        // plain text extraction of page content
}

export interface DocsSearchResult {
  id: string
  title: string
  url: string
  snippet: string | null
}

export interface DocsClient {
  providerKey: string
  createPage(workspaceId: string, input: DocsCreatePageInput): Promise<DocsPage>
  updatePage(workspaceId: string, pageId: string, input: DocsUpdatePageInput): Promise<DocsPage>
  getPage(workspaceId: string, pageId: string): Promise<DocsPageDetail>
  search(workspaceId: string, query: string, limit: number): Promise<DocsSearchResult[]>
}

const DOCS_PROVIDER_KEYS = ["notion", "google_docs"] as const
export type DocsProviderKey = typeof DOCS_PROVIDER_KEYS[number]

export async function getConnectedDocsKey(workspaceId: string): Promise<DocsProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of DOCS_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

export async function getDocsClient(workspaceId: string): Promise<DocsClient | null> {
  const key = await getConnectedDocsKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "notion":
      return (await import("@/lib/integrations/clients/notion")).notionDocsClient
    case "google_docs":
      return null // OAuth required, deferred
    default:
      return null
  }
}
