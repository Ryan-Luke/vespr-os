import { describe, it, expect } from "vitest"
import {
  xpForLevel,
  levelFromXp,
  levelProgress,
  levelTitle,
  isValidXpSource,
  XP_REWARDS,
  FORBIDDEN_XP_SOURCES,
  MILESTONE_DEFINITIONS,
} from "./gamification"

describe("gamification", () => {
  describe("xpForLevel", () => {
    it("level 1 requires 0 XP", () => {
      expect(xpForLevel(1)).toBe(0)
    })

    it("level 2 requires 100 XP", () => {
      expect(xpForLevel(2)).toBe(100)
    })

    it("level 3 requires 300 XP (quadratic growth)", () => {
      expect(xpForLevel(3)).toBe(300)
    })

    it("grows roughly quadratically", () => {
      const l5 = xpForLevel(5)
      const l10 = xpForLevel(10)
      // Level 10 should require significantly more than level 5
      expect(l10).toBeGreaterThan(l5 * 3)
    })

    it("returns integer values", () => {
      for (let i = 1; i <= 20; i++) {
        expect(Number.isInteger(xpForLevel(i))).toBe(true)
      }
    })
  })

  describe("levelFromXp", () => {
    it("0 XP = level 1", () => {
      expect(levelFromXp(0)).toBe(1)
    })

    it("99 XP = still level 1", () => {
      expect(levelFromXp(99)).toBe(1)
    })

    it("100 XP = level 2", () => {
      expect(levelFromXp(100)).toBe(2)
    })

    it("300 XP = level 3", () => {
      expect(levelFromXp(300)).toBe(3)
    })

    it("matches xpForLevel round-trip", () => {
      for (let level = 1; level <= 15; level++) {
        const xp = xpForLevel(level)
        expect(levelFromXp(xp)).toBe(level)
      }
    })

    it("XP just below next level stays at current level", () => {
      const xpForLevel3 = xpForLevel(3)
      expect(levelFromXp(xpForLevel3 - 1)).toBe(2)
    })
  })

  describe("levelProgress", () => {
    it("returns 0 at start of level", () => {
      expect(levelProgress(0)).toBe(0)
    })

    it("returns 0 at exact level boundary", () => {
      expect(levelProgress(xpForLevel(3))).toBe(0)
    })

    it("returns 50 at midpoint of level", () => {
      const start = xpForLevel(2) // 100
      const end = xpForLevel(3)   // 300
      const mid = start + (end - start) / 2 // 200
      expect(levelProgress(mid)).toBe(50)
    })

    it("returns a percentage between 0 and 100", () => {
      const progress = levelProgress(150)
      expect(progress).toBeGreaterThanOrEqual(0)
      expect(progress).toBeLessThanOrEqual(100)
    })
  })

  describe("levelTitle", () => {
    it("returns Rookie for levels 1-2", () => {
      expect(levelTitle(1)).toBe("Rookie")
      expect(levelTitle(2)).toBe("Rookie")
    })

    it("returns Specialist for levels 3-5", () => {
      expect(levelTitle(3)).toBe("Specialist")
      expect(levelTitle(5)).toBe("Specialist")
    })

    it("returns Expert for levels 6-10", () => {
      expect(levelTitle(6)).toBe("Expert")
      expect(levelTitle(10)).toBe("Expert")
    })

    it("returns Executive for very high levels", () => {
      expect(levelTitle(51)).toBe("Executive")
      expect(levelTitle(100)).toBe("Executive")
    })

    it("returns correct titles for all tier boundaries", () => {
      expect(levelTitle(15)).toBe("Senior")
      expect(levelTitle(20)).toBe("Lead")
      expect(levelTitle(30)).toBe("Director")
      expect(levelTitle(50)).toBe("VP")
    })
  })

  describe("isValidXpSource", () => {
    it("accepts valid XP sources", () => {
      expect(isValidXpSource("qualified_lead")).toBe(true)
      expect(isValidXpSource("meeting_booked")).toBe(true)
      expect(isValidXpSource("deal_closed_small")).toBe(true)
      expect(isValidXpSource("task_shipped")).toBe(true)
    })

    it("rejects forbidden sources", () => {
      for (const source of FORBIDDEN_XP_SOURCES) {
        expect(isValidXpSource(source)).toBe(false)
      }
    })

    it("rejects unknown sources", () => {
      expect(isValidXpSource("random_event")).toBe(false)
      expect(isValidXpSource("")).toBe(false)
    })
  })

  describe("XP_REWARDS", () => {
    it("has positive values for all reward types", () => {
      for (const [, value] of Object.entries(XP_REWARDS)) {
        expect(value).toBeGreaterThan(0)
      }
    })

    it("larger deals give more XP", () => {
      expect(XP_REWARDS.deal_closed_large).toBeGreaterThan(XP_REWARDS.deal_closed_medium)
      expect(XP_REWARDS.deal_closed_medium).toBeGreaterThan(XP_REWARDS.deal_closed_small)
    })
  })

  describe("MILESTONE_DEFINITIONS", () => {
    it("first-task milestone triggers at 1 task", () => {
      const firstTask = MILESTONE_DEFINITIONS.find((m) => m.id === "first-task")!
      expect(firstTask.check({ tasksCompleted: 0, xp: 0, level: 1, streak: 0 })).toBe(false)
      expect(firstTask.check({ tasksCompleted: 1, xp: 0, level: 1, streak: 0 })).toBe(true)
    })

    it("century-club milestone triggers at 100 tasks", () => {
      const century = MILESTONE_DEFINITIONS.find((m) => m.id === "century-club")!
      expect(century.check({ tasksCompleted: 99, xp: 0, level: 1, streak: 0 })).toBe(false)
      expect(century.check({ tasksCompleted: 100, xp: 0, level: 1, streak: 0 })).toBe(true)
    })

    it("level-10 milestone checks level not XP", () => {
      const level10 = MILESTONE_DEFINITIONS.find((m) => m.id === "level-10")!
      expect(level10.check({ tasksCompleted: 0, xp: 99999, level: 9, streak: 0 })).toBe(false)
      expect(level10.check({ tasksCompleted: 0, xp: 0, level: 10, streak: 0 })).toBe(true)
    })

    it("all milestones have required fields", () => {
      for (const m of MILESTONE_DEFINITIONS) {
        expect(m.id).toBeTruthy()
        expect(m.name).toBeTruthy()
        expect(m.description).toBeTruthy()
        expect(m.icon).toBeTruthy()
        expect(["agent", "team", "company"]).toContain(m.type)
        expect(typeof m.check).toBe("function")
      }
    })
  })
})
