// Tests for Notion docs client.

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "ntn_test_token_123",
  }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(data),
  })
}

describe("Notion Docs Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("createPage", () => {
    it("creates page with markdown converted to blocks", async () => {
      const { notionDocsClient } = await import("./notion")

      // Search for parent page
      mockFetchResponse({
        results: [{ id: "parent-page-id", url: "https://notion.so/parent" }],
      })

      // Create page
      mockFetchResponse({
        id: "new-page-id",
        url: "https://notion.so/new-page",
        created_time: "2026-04-12T10:00:00Z",
        properties: {
          title: { title: [{ plain_text: "Meeting Notes" }] },
        },
      })

      const result = await notionDocsClient.createPage("ws-1", {
        title: "Meeting Notes",
        content: "# Header\n\n- Bullet one\n- Bullet two\n\nParagraph text.",
      })

      expect(result.id).toBe("new-page-id")
      expect(result.title).toBe("Meeting Notes")

      // Verify blocks were sent
      const createCall = mockFetch.mock.calls[1]
      const body = JSON.parse(createCall[1].body)
      expect(body.children.length).toBeGreaterThan(0)
      expect(body.children[0].type).toBe("heading_1")
      expect(body.properties.title.title[0].text.content).toBe("Meeting Notes")
    })

    it("uses parentId when provided", async () => {
      const { notionDocsClient } = await import("./notion")
      mockFetchResponse({
        id: "child-page",
        url: "https://notion.so/child",
        properties: { title: { title: [{ plain_text: "Child" }] } },
      })

      await notionDocsClient.createPage("ws-1", {
        title: "Child",
        content: "Content",
        parentId: "specific-parent-id",
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.parent.page_id).toBe("specific-parent-id")
    })
  })

  describe("search", () => {
    it("searches and returns results", async () => {
      const { notionDocsClient } = await import("./notion")
      mockFetchResponse({
        results: [
          {
            id: "p1",
            url: "https://notion.so/p1",
            properties: { title: { title: [{ plain_text: "Strategy Doc" }] } },
          },
          {
            id: "p2",
            url: "https://notion.so/p2",
            properties: { Name: { title: [{ plain_text: "Q3 Plan" }] } },
          },
        ],
      })

      const result = await notionDocsClient.search("ws-1", "strategy", 10)
      expect(result).toHaveLength(2)
      expect(result[0].title).toBe("Strategy Doc")
      expect(result[1].title).toBe("Q3 Plan")
    })
  })

  describe("getPage", () => {
    it("fetches page metadata and block content", async () => {
      const { notionDocsClient } = await import("./notion")
      mockFetchResponse({
        id: "p1",
        url: "https://notion.so/p1",
        created_time: "2026-04-10T10:00:00Z",
        last_edited_time: "2026-04-11T10:00:00Z",
        properties: { title: { title: [{ plain_text: "My Page" }] } },
      })
      mockFetchResponse({
        results: [
          {
            type: "heading_2",
            heading_2: { rich_text: [{ plain_text: "Section Title" }] },
          },
          {
            type: "paragraph",
            paragraph: { rich_text: [{ plain_text: "Some content here." }] },
          },
        ],
      })

      const result = await notionDocsClient.getPage("ws-1", "p1")
      expect(result.title).toBe("My Page")
      expect(result.content).toContain("## Section Title")
      expect(result.content).toContain("Some content here.")
    })
  })
})
