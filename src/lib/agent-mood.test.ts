import { describe, it, expect } from "vitest"
import { getMood, MOOD_EMOJI, MOOD_LABEL } from "./agent-mood"
import type { AgentMood } from "./agent-mood"

describe("agent-mood", () => {
  describe("getMood", () => {
    it("returns 'thriving' when feedback ratio >= 0.8", () => {
      expect(getMood({ tasksCompleted: 10, status: "working", feedbackPositive: 8, feedbackTotal: 10 })).toBe("thriving")
      expect(getMood({ tasksCompleted: 10, status: "working", feedbackPositive: 10, feedbackTotal: 10 })).toBe("thriving")
    })

    it("returns 'on_track' when feedback ratio >= 0.6 but < 0.8", () => {
      expect(getMood({ tasksCompleted: 10, status: "working", feedbackPositive: 6, feedbackTotal: 10 })).toBe("on_track")
      expect(getMood({ tasksCompleted: 10, status: "working", feedbackPositive: 7, feedbackTotal: 10 })).toBe("on_track")
    })

    it("returns 'neutral' when feedback ratio < 0.6", () => {
      expect(getMood({ tasksCompleted: 10, status: "working", feedbackPositive: 5, feedbackTotal: 10 })).toBe("neutral")
      expect(getMood({ tasksCompleted: 10, status: "working", feedbackPositive: 0, feedbackTotal: 10 })).toBe("neutral")
    })

    it("returns 'neutral' when no feedback data", () => {
      expect(getMood({ tasksCompleted: 10, status: "working" })).toBe("neutral")
      expect(getMood({ tasksCompleted: 0, status: "idle" })).toBe("neutral")
    })

    it("returns 'neutral' when feedbackTotal is 0", () => {
      expect(getMood({ tasksCompleted: 10, status: "working", feedbackPositive: 0, feedbackTotal: 0 })).toBe("neutral")
    })

    it("handles boundary at exactly 0.8 ratio", () => {
      expect(getMood({ tasksCompleted: 5, status: "working", feedbackPositive: 4, feedbackTotal: 5 })).toBe("thriving")
    })

    it("handles boundary at exactly 0.6 ratio", () => {
      expect(getMood({ tasksCompleted: 5, status: "working", feedbackPositive: 3, feedbackTotal: 5 })).toBe("on_track")
    })

    it("handles undefined feedbackPositive with feedbackTotal set", () => {
      expect(getMood({ tasksCompleted: 5, status: "working", feedbackTotal: 10 })).toBe("neutral")
    })
  })

  describe("MOOD_EMOJI", () => {
    it("has entries for all mood types", () => {
      const moods: AgentMood[] = ["thriving", "on_track", "neutral"]
      for (const mood of moods) {
        expect(MOOD_EMOJI[mood]).toBeDefined()
      }
    })

    it("neutral has empty emoji (not displayed)", () => {
      expect(MOOD_EMOJI.neutral).toBe("")
    })
  })

  describe("MOOD_LABEL", () => {
    it("has labels for thriving and on_track", () => {
      expect(MOOD_LABEL.thriving).toBe("Thriving")
      expect(MOOD_LABEL.on_track).toBe("On track")
    })

    it("neutral has empty label", () => {
      expect(MOOD_LABEL.neutral).toBe("")
    })
  })
})
