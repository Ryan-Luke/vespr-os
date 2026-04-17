// src/lib/templates/index.ts

import type { VerticalTemplate } from "./types"
import { AGENCY_TEMPLATE } from "./agency"
import { SAAS_FOUNDER_TEMPLATE } from "./saas-founder"

// -- Template Registry -------------------------------------------------------
// Add new vertical templates here. That's it -- the engine handles the rest.

const TEMPLATES: VerticalTemplate[] = [
  AGENCY_TEMPLATE,
  SAAS_FOUNDER_TEMPLATE,
]

const TEMPLATE_MAP = new Map<string, VerticalTemplate>(
  TEMPLATES.map((t) => [t.id, t])
)

// Also build a businessType -> template lookup for auto-matching
const BUSINESS_TYPE_MAP = new Map<string, VerticalTemplate>()
for (const t of TEMPLATES) {
  for (const bt of t.businessTypes) {
    BUSINESS_TYPE_MAP.set(bt, t)
  }
}

/**
 * Get a template by its ID. Returns null if not found.
 */
export function getTemplate(id: string): VerticalTemplate | null {
  return TEMPLATE_MAP.get(id) ?? null
}

/**
 * Get the best-matching template for a business type.
 * Returns null if no template matches.
 */
export function getTemplateForBusinessType(businessType: string): VerticalTemplate | null {
  return BUSINESS_TYPE_MAP.get(businessType) ?? null
}

/**
 * List all available templates (for template picker UI).
 */
export function listTemplates(): VerticalTemplate[] {
  return TEMPLATES
}

/**
 * List templates as summary cards (lighter payload for API responses).
 */
export function listTemplateSummaries() {
  return TEMPLATES.map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    icon: t.icon,
    businessTypes: t.businessTypes,
    teamCount: t.teams.length,
    agentCount: t.agents.length + 1, // +1 for Chief of Staff (Nova)
  }))
}

// Re-export types for convenience
export type { VerticalTemplate } from "./types"
