// src/lib/templates/types.ts

import type { ArchetypeId } from "@/lib/archetypes"
import type { PersonalityTraits } from "@/lib/personality-presets"
import type { PhaseKey } from "@/lib/workflow-engine"

// -- Template Agent Definition -----------------------------------------------
// Describes an agent to be created when the template is applied.
// Maps 1:1 to an `agents` table insert, with the template engine
// resolving teamName -> teamId at hydration time.

export interface TemplateAgent {
  /** Display name, e.g. "Sales Lead" */
  name: string
  /** Role string stored in agents.role, e.g. "Sales Lead" */
  role: string
  /** Which archetype from archetypes.ts */
  archetype: ArchetypeId
  /** Personality slider values (0-100 per trait) */
  personality: PersonalityTraits
  /** Expanded personality config (communication, temperament, social, humor, energy, quirks, catchphrases) */
  personalityConfig: {
    communication: {
      formality: "formal" | "casual"
      verbosity: "detailed" | "brief"
      directness: "diplomatic" | "blunt"
      vocabulary: "elevated" | "plain"
    }
    temperament: string[]
    social: string[]
    humor: string[]
    energy: string
    quirks: string[]
    catchphrases: string[]
  }
  /** Skills array stored in agents.skills jsonb */
  skills: string[]
  /** Full system prompt for the agent */
  systemPrompt: string
  /** Team name this agent belongs to (resolved to teamId during hydration) */
  teamName: string
  /** Whether this agent is the team lead */
  isTeamLead: boolean
  /** 2-letter avatar fallback */
  avatar: string
  /** Pixel avatar sprite index 0-5 */
  pixelAvatarIndex: number
  /** AI provider */
  provider: "anthropic" | "openai" | "google"
  /** Model name */
  model: string
}

// -- Template Team Definition ------------------------------------------------

export interface TemplateTeam {
  /** Team display name, e.g. "Sales" */
  name: string
  /** Team description */
  description: string
  /** Emoji icon */
  icon: string
}

// -- Workflow Customizations -------------------------------------------------
// Per-phase overrides. If a phase key is present, its outputs and
// guidance override the defaults in workflow-engine.ts PHASES.

export interface PhaseOutputOverride {
  /** Must match a key in the phase's requiredOutputs */
  key: string
  /** Override the label */
  label?: string
  /** Override the description / guidance text */
  description?: string
}

export interface PhaseCustomization {
  /** Override guidance text shown to the user for this phase */
  guidanceOverride?: string
  /** Override specific output labels/descriptions */
  outputOverrides?: PhaseOutputOverride[]
}

// -- Integration Recommendation ----------------------------------------------

export interface IntegrationRecommendation {
  /** Provider key from the integration registry, e.g. "gohighlevel" */
  providerKey: string
  /** Display name, e.g. "GoHighLevel" */
  name: string
  /** Why this integration matters for this vertical */
  reason: string
  /** Is this a critical integration or nice-to-have? */
  priority: "critical" | "recommended" | "optional"
  /** Which workflow phase this is most relevant to */
  relevantPhase: PhaseKey
}

// -- Onboarding Question -----------------------------------------------------
// Vertical-specific questions asked during workspace setup.
// Answers are stored in workspace.businessProfile jsonb.

export interface OnboardingQuestion {
  /** Unique key, used as the field name in businessProfile */
  key: string
  /** Question text shown to the user */
  question: string
  /** Helper text / description */
  helpText?: string
  /** Input type */
  inputType: "text" | "textarea" | "select" | "multiselect" | "number"
  /** Options for select/multiselect */
  options?: { label: string; value: string }[]
  /** Placeholder text */
  placeholder?: string
  /** Is this required during onboarding? */
  required: boolean
  /** Which businessProfile key to store the answer in */
  storageKey: string
}

// -- Starter Company Memory --------------------------------------------------
// Pre-seeded company memories that give agents initial context.

export interface StarterMemory {
  /** Memory category: client, process, preference, lesson, fact */
  category: "client" | "process" | "preference" | "lesson" | "fact"
  /** Memory title */
  title: string
  /** Memory content (markdown) */
  content: string
  /** Importance score 0-1 */
  importance: number
  /** Tags for searchability */
  tags: string[]
}

// -- The Top-Level Template --------------------------------------------------

export interface VerticalTemplate {
  /** Unique template ID, e.g. "agency", "saas_founder" */
  id: string
  /** Human-readable label, e.g. "Digital Agency" */
  label: string
  /** One-line description */
  description: string
  /** Emoji icon for the template card */
  icon: string
  /** Which businessType values this template applies to */
  businessTypes: string[]
  /** Pre-configured agent roster */
  agents: TemplateAgent[]
  /** Team structure */
  teams: TemplateTeam[]
  /** Per-phase workflow customizations */
  workflowCustomizations: Partial<Record<PhaseKey, PhaseCustomization>>
  /** Recommended integrations, ordered by priority */
  integrationRecommendations: IntegrationRecommendation[]
  /** Business profiling questions for onboarding */
  onboardingQuestions: OnboardingQuestion[]
  /** Starter company memories seeded into the workspace */
  starterMemories: StarterMemory[]
}
