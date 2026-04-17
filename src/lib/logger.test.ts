import { describe, it, expect, vi, beforeEach } from "vitest"
import { createLogger, withRequestLogging } from "./logger"

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("createLogger", () => {
    it("emits structured JSON on info", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {})
      const log = createLogger({ route: "/api/test" })
      log.info("test message", { count: 5 })

      expect(spy).toHaveBeenCalledOnce()
      const output = JSON.parse(spy.mock.calls[0][0])
      expect(output.level).toBe("info")
      expect(output.message).toBe("test message")
      expect(output.route).toBe("/api/test")
      expect(output.data).toEqual({ count: 5 })
      expect(output.timestamp).toBeDefined()
    })

    it("emits to console.warn on warn", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
      const log = createLogger()
      log.warn("warning message")

      expect(spy).toHaveBeenCalledOnce()
      const output = JSON.parse(spy.mock.calls[0][0])
      expect(output.level).toBe("warn")
      expect(output.message).toBe("warning message")
    })

    it("emits to console.error on error with error details", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      const log = createLogger({ workspaceId: "ws-1" })
      const err = new Error("boom")
      log.error("something failed", {}, err)

      expect(spy).toHaveBeenCalledOnce()
      const output = JSON.parse(spy.mock.calls[0][0])
      expect(output.level).toBe("error")
      expect(output.workspaceId).toBe("ws-1")
      expect(output.error.name).toBe("Error")
      expect(output.error.message).toBe("boom")
      expect(output.error.stack).toBeDefined()
    })

    it("includes context fields in output", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {})
      const log = createLogger({ workspaceId: "ws-1", userId: "u-1", agentId: "a-1" })
      log.info("ctx test")

      const output = JSON.parse(spy.mock.calls[0][0])
      expect(output.workspaceId).toBe("ws-1")
      expect(output.userId).toBe("u-1")
      expect(output.agentId).toBe("a-1")
    })

    it("omits data field when no data provided", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {})
      const log = createLogger()
      log.info("no data")

      const output = JSON.parse(spy.mock.calls[0][0])
      expect(output.data).toBeUndefined()
    })

    it("handles string errors in error method", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      const log = createLogger()
      log.error("fail", {}, "string error")

      const output = JSON.parse(spy.mock.calls[0][0])
      expect(output.error).toBe("string error")
    })
  })

  describe("withRequestLogging", () => {
    it("wraps a handler and logs request/response", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      const handler = withRequestLogging(async () => {
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      })

      const req = new Request("http://localhost/api/test", { method: "GET" })
      const res = await handler(req)

      expect(res.status).toBe(200)
      // Should have logged start + completed
      expect(logSpy).toHaveBeenCalledTimes(2)

      const startLog = JSON.parse(logSpy.mock.calls[0][0])
      expect(startLog.message).toBe("Request started")
      expect(startLog.data.method).toBe("GET")

      const endLog = JSON.parse(logSpy.mock.calls[1][0])
      expect(endLog.message).toBe("Request completed")
      expect(endLog.data.status).toBe(200)
      expect(endLog.data.durationMs).toBeGreaterThanOrEqual(0)
    })

    it("logs error when handler throws", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const handler = withRequestLogging(async () => {
        throw new Error("handler exploded")
      })

      const req = new Request("http://localhost/api/boom", { method: "POST" })
      await expect(handler(req)).rejects.toThrow("handler exploded")

      expect(errorSpy).toHaveBeenCalledOnce()
      const errorLog = JSON.parse(errorSpy.mock.calls[0][0])
      expect(errorLog.message).toBe("Request failed")
      expect(errorLog.error.message).toBe("handler exploded")
    })
  })
})
