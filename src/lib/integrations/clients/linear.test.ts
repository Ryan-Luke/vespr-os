// Tests for Linear PM client (expanded).

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/integrations/credentials", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    api_key: "lin_api_test_key",
  }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockGqlResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data }),
  })
}

describe("Linear PM Client", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("createTask", () => {
    it("resolves team when not provided, then creates issue", async () => {
      const { linearPMClient } = await import("./linear")
      mockGqlResponse({ teams: { nodes: [{ id: "team-1" }] } })
      mockGqlResponse({
        issueCreate: {
          success: true,
          issue: { id: "issue-1", identifier: "ENG-42", title: "Fix bug", url: "https://linear.app/issue/ENG-42" },
        },
      })

      const result = await linearPMClient.createTask("ws-1", { title: "Fix bug" })
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.identifier).toBe("ENG-42")
    })
  })

  describe("updateTask", () => {
    it("sends issueUpdate mutation with changed fields", async () => {
      const { linearPMClient } = await import("./linear")
      mockGqlResponse({
        issueUpdate: {
          success: true,
          issue: { id: "issue-1", identifier: "ENG-42", title: "Updated title", url: "https://linear.app/issue/ENG-42" },
        },
      })

      const result = await linearPMClient.updateTask("ws-1", "issue-1", {
        title: "Updated title",
        priority: 2,
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.query).toContain("issueUpdate")
      expect(body.variables.input.title).toBe("Updated title")
      expect(body.variables.input.priority).toBe(2)
      expect(result.title).toBe("Updated title")
    })
  })

  describe("addComment", () => {
    it("sends commentCreate mutation", async () => {
      const { linearPMClient } = await import("./linear")
      mockGqlResponse({
        commentCreate: {
          success: true,
          comment: {
            id: "comment-1",
            body: "Looking into this now",
            user: { name: "Bot" },
            createdAt: "2026-04-12T10:00:00Z",
          },
        },
      })

      const result = await linearPMClient.addComment("ws-1", "issue-1", "Looking into this now")
      expect(result.body).toBe("Looking into this now")
      expect(result.authorName).toBe("Bot")
    })
  })

  describe("listTasks", () => {
    it("fetches issues ordered by createdAt", async () => {
      const { linearPMClient } = await import("./linear")
      mockGqlResponse({
        issues: {
          nodes: [
            { id: "i1", identifier: "ENG-1", title: "Task 1", url: "https://linear.app/ENG-1" },
            { id: "i2", identifier: "ENG-2", title: "Task 2", url: "https://linear.app/ENG-2" },
          ],
        },
      })

      const result = await linearPMClient.listTasks("ws-1", 10)
      expect(result).toHaveLength(2)
      expect(result[0].identifier).toBe("ENG-1")
    })
  })

  describe("getTask", () => {
    it("fetches issue detail with comments", async () => {
      const { linearPMClient } = await import("./linear")
      mockGqlResponse({
        issue: {
          id: "i1",
          identifier: "ENG-1",
          title: "Task 1",
          description: "Description here",
          url: "https://linear.app/ENG-1",
          priority: 2,
          state: { name: "In Progress" },
          assignee: { name: "Jane" },
          createdAt: "2026-04-10T10:00:00Z",
          updatedAt: "2026-04-11T10:00:00Z",
          comments: {
            nodes: [
              { id: "c1", body: "WIP", user: { name: "Jane" }, createdAt: "2026-04-11T10:00:00Z" },
            ],
          },
        },
      })

      const result = await linearPMClient.getTask("ws-1", "i1")
      expect(result.status).toBe("In Progress")
      expect(result.assigneeName).toBe("Jane")
      expect(result.comments).toHaveLength(1)
      expect(result.comments[0].body).toBe("WIP")
    })
  })
})
