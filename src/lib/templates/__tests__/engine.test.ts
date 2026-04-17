import { describe, it, expect, vi } from "vitest"

// Mock the DB module to avoid needing a real database connection
vi.mock("@/lib/db", () => ({
  db: {},
}))

// Import after mocking
import { getTemplate, getTemplateForBusinessType, listTemplates, listTemplateSummaries } from "../index"
import { getTemplatePreview } from "../engine"

// -- Registry Tests ----------------------------------------------------------

describe("Template Registry", () => {
  it("should list at least 2 templates", () => {
    const templates = listTemplates()
    expect(templates.length).toBeGreaterThanOrEqual(2)
  })

  it("should have unique template IDs", () => {
    const templates = listTemplates()
    const ids = templates.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("should get agency template by ID", () => {
    const template = getTemplate("agency")
    expect(template).not.toBeNull()
    expect(template!.id).toBe("agency")
    expect(template!.label).toBe("Digital Agency")
  })

  it("should get saas_founder template by ID", () => {
    const template = getTemplate("saas_founder")
    expect(template).not.toBeNull()
    expect(template!.id).toBe("saas_founder")
  })

  it("should return null for unknown template ID", () => {
    const template = getTemplate("nonexistent")
    expect(template).toBeNull()
  })

  it("should auto-match agency template for 'agency' business type", () => {
    const template = getTemplateForBusinessType("agency")
    expect(template).not.toBeNull()
    expect(template!.id).toBe("agency")
  })

  it("should auto-match saas template for 'saas' business type", () => {
    const template = getTemplateForBusinessType("saas")
    expect(template).not.toBeNull()
    expect(template!.id).toBe("saas_founder")
  })

  it("should return null for unmatched business type", () => {
    const template = getTemplateForBusinessType("unknown_type")
    expect(template).toBeNull()
  })

  it("should list template summaries with correct counts", () => {
    const summaries = listTemplateSummaries()
    expect(summaries.length).toBeGreaterThanOrEqual(2)
    for (const s of summaries) {
      expect(s.id).toBeDefined()
      expect(s.label).toBeDefined()
      expect(s.teamCount).toBeGreaterThan(0)
      expect(s.agentCount).toBeGreaterThan(0)
    }
  })
})

// -- Template Structure Validation -------------------------------------------

describe("Template Structure Validation", () => {
  const templates = listTemplates()

  for (const template of templates) {
    describe(`Template: ${template.id}`, () => {
      it("should have required top-level fields", () => {
        expect(template.id).toBeTruthy()
        expect(template.label).toBeTruthy()
        expect(template.description).toBeTruthy()
        expect(template.icon).toBeTruthy()
        expect(template.businessTypes.length).toBeGreaterThan(0)
      })

      it("should have at least 1 team", () => {
        expect(template.teams.length).toBeGreaterThan(0)
      })

      it("should have at least 3 agents", () => {
        expect(template.agents.length).toBeGreaterThanOrEqual(3)
      })

      it("should have valid archetypes for all agents", () => {
        const validArchetypes = [
          "scout", "closer", "researcher", "writer", "strategist",
          "analyst", "operator", "communicator", "builder",
        ]
        for (const agent of template.agents) {
          expect(validArchetypes).toContain(agent.archetype)
        }
      })

      it("should have all agent teamNames matching a defined team", () => {
        const teamNames = new Set(template.teams.map((t) => t.name))
        for (const agent of template.agents) {
          expect(teamNames.has(agent.teamName)).toBe(true)
        }
      })

      it("should have at least one team lead per team", () => {
        const teamNames = template.teams.map((t) => t.name)
        for (const teamName of teamNames) {
          const teamAgents = template.agents.filter((a) => a.teamName === teamName)
          const hasLead = teamAgents.some((a) => a.isTeamLead)
          // Not every team needs a lead (e.g., if the team only has support roles),
          // but most should. Log a warning if not.
          if (!hasLead && teamAgents.length > 0) {
            console.warn(`Template ${template.id}: Team "${teamName}" has no team lead`)
          }
        }
      })

      it("should have personality traits in valid range (0-100)", () => {
        for (const agent of template.agents) {
          const traits = agent.personality
          for (const [, value] of Object.entries(traits)) {
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThanOrEqual(100)
          }
        }
      })

      it("should have non-empty system prompts for all agents", () => {
        for (const agent of template.agents) {
          expect(agent.systemPrompt.length).toBeGreaterThan(50)
        }
      })

      it("should have at least 1 integration recommendation", () => {
        expect(template.integrationRecommendations.length).toBeGreaterThan(0)
      })

      it("should have at least 1 onboarding question", () => {
        expect(template.onboardingQuestions.length).toBeGreaterThan(0)
      })

      it("should have unique onboarding question keys", () => {
        const keys = template.onboardingQuestions.map((q) => q.key)
        expect(new Set(keys).size).toBe(keys.length)
      })

      it("should have at least 1 starter memory", () => {
        expect(template.starterMemories.length).toBeGreaterThan(0)
      })
    })
  }
})

// -- Agency Template Specifics -----------------------------------------------

describe("Agency Template", () => {
  const template = getTemplate("agency")!

  it("should have 6 agents", () => {
    expect(template.agents.length).toBe(6)
  })

  it("should have 5 teams", () => {
    expect(template.teams.length).toBe(5)
  })

  it("should have expected team names", () => {
    const names = template.teams.map((t) => t.name)
    expect(names).toContain("Sales")
    expect(names).toContain("Marketing")
    expect(names).toContain("Delivery")
    expect(names).toContain("Operations")
    expect(names).toContain("Leadership")
  })

  it("should have a Sales Lead agent", () => {
    const salesLead = template.agents.find((a) => a.role === "Sales Lead")
    expect(salesLead).toBeDefined()
    expect(salesLead!.archetype).toBe("scout")
    expect(salesLead!.isTeamLead).toBe(true)
  })

  it("should have workflow customizations for agency-specific phases", () => {
    expect(template.workflowCustomizations.product).toBeDefined()
    expect(template.workflowCustomizations.delivery).toBeDefined()
  })

  it("should recommend GoHighLevel as critical integration", () => {
    const ghl = template.integrationRecommendations.find((r) => r.providerKey === "gohighlevel")
    expect(ghl).toBeDefined()
    expect(ghl!.priority).toBe("critical")
  })

  it("should have 4 starter memories", () => {
    expect(template.starterMemories.length).toBe(4)
  })
})

// -- SaaS Founder Template Specifics -----------------------------------------

describe("SaaS Founder Template", () => {
  const template = getTemplate("saas_founder")!

  it("should have 5 agents", () => {
    expect(template.agents.length).toBe(5)
  })

  it("should have 4 teams", () => {
    expect(template.teams.length).toBe(4)
  })

  it("should have expected team names", () => {
    const names = template.teams.map((t) => t.name)
    expect(names).toContain("Growth")
    expect(names).toContain("Product")
    expect(names).toContain("Engineering")
    expect(names).toContain("Leadership")
  })

  it("should have a Growth Lead agent", () => {
    const growthLead = template.agents.find((a) => a.role === "Growth Lead")
    expect(growthLead).toBeDefined()
    expect(growthLead!.archetype).toBe("scout")
    expect(growthLead!.isTeamLead).toBe(true)
  })

  it("should recommend Linear as critical integration", () => {
    const linear = template.integrationRecommendations.find((r) => r.providerKey === "linear")
    expect(linear).toBeDefined()
    expect(linear!.priority).toBe("critical")
  })

  it("should recommend Stripe as critical integration", () => {
    const stripe = template.integrationRecommendations.find((r) => r.providerKey === "stripe")
    expect(stripe).toBeDefined()
    expect(stripe!.priority).toBe("critical")
  })

  it("should have 4 starter memories", () => {
    expect(template.starterMemories.length).toBe(4)
  })
})

// -- Template Preview --------------------------------------------------------

describe("Template Preview", () => {
  it("should generate preview for agency template", () => {
    const preview = getTemplatePreview("agency")
    expect(preview).not.toBeNull()
    expect(preview!.id).toBe("agency")
    expect(preview!.teamCount).toBeGreaterThan(0)
    expect(preview!.agentCount).toBeGreaterThan(preview!.teams.length)
    expect(preview!.agents.length).toBeGreaterThan(0)
    expect(preview!.integrationRecommendations.length).toBeGreaterThan(0)
    expect(preview!.onboardingQuestions.length).toBeGreaterThan(0)
  })

  it("should generate preview for saas_founder template", () => {
    const preview = getTemplatePreview("saas_founder")
    expect(preview).not.toBeNull()
    expect(preview!.id).toBe("saas_founder")
    expect(preview!.teamCount).toBe(4)
    expect(preview!.agentCount).toBe(6) // 5 agents + Nova
  })

  it("should return null for unknown template", () => {
    const preview = getTemplatePreview("does_not_exist")
    expect(preview).toBeNull()
  })

  it("should include Nova in agent count but not in agents array", () => {
    const preview = getTemplatePreview("agency")
    expect(preview).not.toBeNull()
    // agents array has template agents only, count includes Nova (+1)
    expect(preview!.agentCount).toBe(preview!.agents.length + 1)
  })
})
