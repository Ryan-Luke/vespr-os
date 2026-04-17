import { describe, it, expect } from "vitest"
import {
  traitsToPromptStyle,
  customPersonalityToPrompt,
  PERSONALITY_PRESETS,
  DEFAULT_TRAITS,
  DEFAULT_CUSTOM_PERSONALITY,
  TRAIT_LABELS,
  CATEGORY_INFO,
  type PersonalityTraits,
  type CustomPersonalityConfig,
} from "./personality-presets"

describe("personality-presets", () => {
  describe("traitsToPromptStyle", () => {
    it("returns preset-based prompt when presetId is provided", () => {
      const result = traitsToPromptStyle(DEFAULT_TRAITS, "gandalf")
      expect(result).toContain("PERSONALITY:")
      expect(result).toContain("Gandalf")
      expect(result).toContain("Stay in character")
    })

    it("returns empty string for default traits with no preset", () => {
      // Default traits are all in the 25-75 range, so no lines are generated
      const result = traitsToPromptStyle(DEFAULT_TRAITS)
      expect(result).toBe("")
    })

    it("generates casual prompt for low formality", () => {
      const traits: PersonalityTraits = { ...DEFAULT_TRAITS, formality: 10 }
      const result = traitsToPromptStyle(traits)
      expect(result).toContain("casually")
    })

    it("generates formal prompt for high formality", () => {
      const traits: PersonalityTraits = { ...DEFAULT_TRAITS, formality: 80 }
      const result = traitsToPromptStyle(traits)
      expect(result).toContain("formally")
    })

    it("generates funny prompt for high humor", () => {
      const traits: PersonalityTraits = { ...DEFAULT_TRAITS, humor: 80 }
      const result = traitsToPromptStyle(traits)
      expect(result).toContain("funny")
    })

    it("generates serious prompt for low humor", () => {
      const traits: PersonalityTraits = { ...DEFAULT_TRAITS, humor: 10 }
      const result = traitsToPromptStyle(traits)
      expect(result).toContain("serious")
    })

    it("generates high-energy prompt for high energy", () => {
      const traits: PersonalityTraits = { ...DEFAULT_TRAITS, energy: 80 }
      const result = traitsToPromptStyle(traits)
      expect(result).toContain("high-energy")
    })

    it("generates calm prompt for low energy", () => {
      const traits: PersonalityTraits = { ...DEFAULT_TRAITS, energy: 10 }
      const result = traitsToPromptStyle(traits)
      expect(result).toContain("calm")
    })

    it("generates blunt prompt for high directness", () => {
      const traits: PersonalityTraits = { ...DEFAULT_TRAITS, directness: 80 }
      const result = traitsToPromptStyle(traits)
      expect(result).toContain("blunt")
    })

    it("generates terse prompt for low verbosity", () => {
      const traits: PersonalityTraits = { ...DEFAULT_TRAITS, verbosity: 10 }
      const result = traitsToPromptStyle(traits)
      expect(result).toContain("terse")
    })

    it("generates multiple lines for multiple extreme traits", () => {
      const traits: PersonalityTraits = {
        formality: 10,
        humor: 90,
        energy: 90,
        warmth: 90,
        directness: 90,
        confidence: 90,
        verbosity: 90,
      }
      const result = traitsToPromptStyle(traits)
      expect(result).toContain("PERSONALITY:")
      const lines = result.split("\n")
      // PERSONALITY: header + multiple trait lines
      expect(lines.length).toBeGreaterThanOrEqual(7)
    })

    it("prefers custom personality config over legacy slider traits", () => {
      const config: CustomPersonalityConfig = {
        ...DEFAULT_CUSTOM_PERSONALITY,
        communication: { formality: "formal", verbosity: "detailed", directness: "blunt", vocabulary: "elevated" },
      }
      const result = traitsToPromptStyle(DEFAULT_TRAITS, undefined, config)
      expect(result).toContain("PERSONALITY:")
      expect(result).toContain("Speak formally")
    })

    it("prefers preset over custom config when both provided", () => {
      const config: CustomPersonalityConfig = DEFAULT_CUSTOM_PERSONALITY
      const result = traitsToPromptStyle(DEFAULT_TRAITS, "yoda", config)
      expect(result).toContain("Yoda")
      // Should not contain custom personality output
      expect(result).not.toContain("PERSONALITY:\n")
    })
  })

  describe("customPersonalityToPrompt", () => {
    it("generates prompt from default custom personality", () => {
      const result = customPersonalityToPrompt(DEFAULT_CUSTOM_PERSONALITY)
      expect(result).toContain("PERSONALITY:")
    })

    it("includes communication style directives", () => {
      const config: CustomPersonalityConfig = {
        ...DEFAULT_CUSTOM_PERSONALITY,
        communication: { formality: "formal", verbosity: "brief", directness: "diplomatic", vocabulary: "elevated" },
      }
      const result = customPersonalityToPrompt(config)
      expect(result).toContain("formally")
      expect(result).toContain("concise")
      expect(result).toContain("diplomatic")
      expect(result).toContain("sophisticated")
    })

    it("includes catchphrases when provided", () => {
      const config: CustomPersonalityConfig = {
        ...DEFAULT_CUSTOM_PERSONALITY,
        catchphrases: ["Let's ship it!", "Move fast"],
      }
      const result = customPersonalityToPrompt(config)
      expect(result).toContain("Let's ship it!")
      expect(result).toContain("Move fast")
    })

    it("omits catchphrases section when empty", () => {
      const config: CustomPersonalityConfig = {
        ...DEFAULT_CUSTOM_PERSONALITY,
        catchphrases: [],
      }
      const result = customPersonalityToPrompt(config)
      expect(result).not.toContain("signature expressions")
    })
  })

  describe("PERSONALITY_PRESETS", () => {
    it("has at least 50 presets", () => {
      expect(PERSONALITY_PRESETS.length).toBeGreaterThanOrEqual(50)
    })

    it("all presets have unique ids", () => {
      const ids = PERSONALITY_PRESETS.map((p) => p.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    })

    it("all presets have valid trait values (0-100)", () => {
      for (const preset of PERSONALITY_PRESETS) {
        for (const [key, value] of Object.entries(preset.traits)) {
          expect(value, `${preset.id}.${key}`).toBeGreaterThanOrEqual(0)
          expect(value, `${preset.id}.${key}`).toBeLessThanOrEqual(100)
        }
      }
    })

    it("all presets have valid categories", () => {
      const validCategories = Object.keys(CATEGORY_INFO)
      for (const preset of PERSONALITY_PRESETS) {
        expect(validCategories, `${preset.id} has invalid category ${preset.category}`)
          .toContain(preset.category)
      }
    })

    it("all presets have speechStyle", () => {
      for (const preset of PERSONALITY_PRESETS) {
        expect(preset.speechStyle.length, `${preset.id} has empty speechStyle`).toBeGreaterThan(0)
      }
    })
  })

  describe("TRAIT_LABELS", () => {
    it("has labels for all trait keys", () => {
      const traitKeys: (keyof PersonalityTraits)[] = [
        "formality", "humor", "energy", "warmth", "directness", "confidence", "verbosity",
      ]
      for (const key of traitKeys) {
        expect(TRAIT_LABELS[key]).toBeDefined()
        expect(TRAIT_LABELS[key].name).toBeTruthy()
        expect(TRAIT_LABELS[key].low).toBeTruthy()
        expect(TRAIT_LABELS[key].high).toBeTruthy()
      }
    })
  })
})
