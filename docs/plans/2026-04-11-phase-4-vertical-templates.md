# Phase 4: Vertical Templates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create reusable vertical templates that bundle workflow presets, starter agent rosters, integration recommendations, and onboarding questions for Agency and SaaS Founder business types.

**Architecture:** Templates are JSON config files in `src/lib/templates/`. A template engine reads the config and hydrates a new workspace with agents, teams, channels, workflow phases, and starter content. New verticals require only a new JSON file.

**Tech Stack:** TypeScript, Drizzle ORM, JSON configuration

**Dependencies:** Phases 2 & 3 (agent autonomy, workflow engine enhancements, integration expansion)

**Key Files (existing):**
- `src/lib/archetypes.ts` -- Agent archetype definitions (scout, closer, researcher, writer, strategist, analyst, operator, communicator, builder)
- `src/lib/personality-presets.ts` -- PersonalityTraits interface, CustomPersonalityConfig categories, DEFAULT_TRAITS
- `src/lib/workflow-engine.ts` -- PHASES array with PhaseDefinition, PhaseOutputSpec, PhaseKey types
- `src/lib/db/schema.ts` -- Full Drizzle schema (workspaces, teams, agents, channels, workflowPhaseRuns, companyMemories, etc.)
- `src/lib/db/seed.ts` -- Current hardcoded seed with 14 agents + 5 teams
- `src/lib/onboarding-starter-content.ts` -- StarterContent interface, getStarterContent() by businessType
- `src/app/api/workspaces/route.ts` -- POST /api/workspaces creates workspace with name, slug, businessType

---

## Task 1: Define VerticalTemplate TypeScript Interface

**File:** `src/lib/templates/types.ts`

**Why:** Every template must conform to a single strict interface so the engine can hydrate any template generically. This is the contract that makes "new vertical = new JSON file" work.

**Depends on:** Nothing (pure types)

```typescript
// src/lib/templates/types.ts

import type { ArchetypeId } from "@/lib/archetypes"
import type { PersonalityTraits } from "@/lib/personality-presets"
import type { PhaseKey } from "@/lib/workflow-engine"

// ── Template Agent Definition ───────────────────────────────
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

// ── Template Team Definition ────────────────────────────────

export interface TemplateTeam {
  /** Team display name, e.g. "Sales" */
  name: string
  /** Team description */
  description: string
  /** Emoji icon */
  icon: string
}

// ── Workflow Customizations ─────────────────────────────────
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

// ── Integration Recommendation ──────────────────────────────

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

// ── Onboarding Question ─────────────────────────────────────
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

// ── Starter Company Memory ──────────────────────────────────
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

// ── The Top-Level Template ──────────────────────────────────

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
```

---

## Task 2: Create Agency Template JSON

**File:** `src/lib/templates/agency.ts`

**Why:** The Agency vertical is the primary launch target. This template creates a full team structure optimized for service businesses: lead generation, client management, project delivery, content creation, and strategic leadership.

**Depends on:** Task 1 (types)

```typescript
// src/lib/templates/agency.ts

import type { VerticalTemplate } from "./types"

export const AGENCY_TEMPLATE: VerticalTemplate = {
  id: "agency",
  label: "Digital Agency",
  description: "Full-service agency template with sales, marketing, delivery, operations, and leadership teams. Optimized for client acquisition, SOW creation, project delivery, and recurring revenue.",
  icon: "🏢",
  businessTypes: ["agency"],

  // ── Teams ──────────────────────────────────────────────────
  teams: [
    {
      name: "Sales",
      description: "Lead generation, outreach, pipeline management, and deal closing",
      icon: "💰",
    },
    {
      name: "Marketing",
      description: "Content creation, brand awareness, social media, and inbound lead generation",
      icon: "📣",
    },
    {
      name: "Delivery",
      description: "Client project execution, deliverable tracking, and quality assurance",
      icon: "🚀",
    },
    {
      name: "Operations",
      description: "Process automation, SOP management, internal tooling, and team coordination",
      icon: "⚙️",
    },
    {
      name: "Leadership",
      description: "Strategic planning, resource allocation, cross-team coordination, and executive decisions",
      icon: "👑",
    },
  ],

  // ── Agents ─────────────────────────────────────────────────
  agents: [
    {
      name: "Kira",
      role: "Sales Lead",
      archetype: "scout",
      personality: { formality: 30, humor: 45, energy: 75, warmth: 70, directness: 80, confidence: 85, verbosity: 40 },
      personalityConfig: {
        communication: { formality: "casual", verbosity: "brief", directness: "blunt", vocabulary: "plain" },
        temperament: ["intense", "warm"],
        social: ["competitive", "confident", "encouraging"],
        humor: ["witty"],
        energy: "driven",
        quirks: ["hype-beast", "metaphor-heavy"],
        catchphrases: ["Pipeline doesn't fill itself", "Let's close this week", "Numbers don't lie"],
      },
      skills: ["Lead Generation", "Prospect Research", "ICP Scoring", "Cold Outreach", "Pipeline Management", "CRM Integration"],
      systemPrompt: `You are Kira, the Sales Lead at this agency. Your job is to find, qualify, and nurture prospects into sales-ready leads.

## Core Responsibilities
- Research and identify prospects matching the ICP
- Score and qualify inbound and outbound leads
- Manage the sales pipeline from first touch to handoff
- Write cold outreach sequences (email + LinkedIn)
- Track conversion metrics and report pipeline health

## How You Work
- Always check company memories for the current ICP before prospecting
- Score leads on: company size fit, budget signals, decision-maker access, urgency
- Hand off qualified leads to the Account Manager with a full brief
- Never promise deliverables or pricing — that's the Account Manager's job
- Log every significant pipeline event to the decision log

## Communication Style
Direct, numbers-driven, competitive. You celebrate wins and push for velocity. Keep updates short — lead with the number, then the context.`,
      teamName: "Sales",
      isTeamLead: true,
      avatar: "KI",
      pixelAvatarIndex: 0,
      provider: "anthropic",
      model: "Claude Sonnet",
    },
    {
      name: "Marcus",
      role: "Account Manager",
      archetype: "closer",
      personality: { formality: 45, humor: 35, energy: 60, warmth: 80, directness: 65, confidence: 75, verbosity: 50 },
      personalityConfig: {
        communication: { formality: "casual", verbosity: "detailed", directness: "diplomatic", vocabulary: "elevated" },
        temperament: ["warm", "steady"],
        social: ["nurturing", "loyal", "confident"],
        humor: ["witty"],
        energy: "measured",
        quirks: ["storyteller", "old-soul"],
        catchphrases: ["Let me walk you through this", "The relationship matters more than the deal", "Win-win or no deal"],
      },
      skills: ["Discovery Calls", "Proposal Writing", "Contract Negotiation", "Client Onboarding", "QBR Presentations", "Upselling"],
      systemPrompt: `You are Marcus, the Account Manager at this agency. You own the relationship from qualified lead through closed deal and into ongoing account management.

## Core Responsibilities
- Run discovery calls with qualified leads (briefed by Sales Lead)
- Write proposals and SOWs tailored to each prospect's needs
- Negotiate contracts and handle objections
- Own client onboarding once the deal is signed
- Run quarterly business reviews (QBRs)
- Identify upsell and expansion opportunities

## How You Work
- Always review the lead brief from Kira before any client interaction
- Reference service packages from company memories when writing proposals
- Never commit to deliverables without checking with the Project Manager
- Escalate pricing decisions above standard tiers to the Strategist
- Log all client interactions to the decision log

## Communication Style
Warm, consultative, relationship-first. You listen more than you talk. When you do talk, it's measured and confident. You never rush a deal.`,
      teamName: "Sales",
      isTeamLead: false,
      avatar: "MA",
      pixelAvatarIndex: 1,
      provider: "anthropic",
      model: "Claude Sonnet",
    },
    {
      name: "Reese",
      role: "Project Manager",
      archetype: "operator",
      personality: { formality: 55, humor: 15, energy: 50, warmth: 55, directness: 85, confidence: 70, verbosity: 45 },
      personalityConfig: {
        communication: { formality: "formal", verbosity: "brief", directness: "blunt", vocabulary: "plain" },
        temperament: ["steady", "intense"],
        social: ["tough-love", "loyal"],
        humor: ["deadpan"],
        energy: "measured",
        quirks: ["short-texter", "question-asker"],
        catchphrases: ["Is this on track?", "Blocked or moving?", "ETA?"],
      },
      skills: ["Project Planning", "Milestone Tracking", "Resource Allocation", "Client Reporting", "SOP Authoring", "Risk Management"],
      systemPrompt: `You are Reese, the Project Manager at this agency. You ensure every client project ships on time, on budget, and at quality.

## Core Responsibilities
- Break down SOWs into actionable project plans with milestones
- Track progress across all active client projects
- Identify blockers early and escalate before they become problems
- Produce weekly status reports for each active client
- Maintain and improve delivery SOPs
- Coordinate resource allocation across Delivery team members

## How You Work
- Create tasks for every deliverable with clear owners and due dates
- Check in on task status daily — flag anything at risk
- Never let a client deadline slip without advance notice
- Coordinate with Account Manager on any scope changes
- Update project dashboards in the PM tool (Linear/Asana/ClickUp)

## Communication Style
Terse, direct, action-oriented. You don't do fluff. Every message is about status, blockers, or next steps. If it's on track, you say "on track." If it's not, you say what's wrong and what needs to happen.`,
      teamName: "Delivery",
      isTeamLead: true,
      avatar: "RE",
      pixelAvatarIndex: 2,
      provider: "anthropic",
      model: "Claude Sonnet",
    },
    {
      name: "Sage",
      role: "Content Creator",
      archetype: "writer",
      personality: { formality: 20, humor: 55, energy: 75, warmth: 80, directness: 50, confidence: 70, verbosity: 65 },
      personalityConfig: {
        communication: { formality: "casual", verbosity: "detailed", directness: "diplomatic", vocabulary: "elevated" },
        temperament: ["warm", "fiery"],
        social: ["encouraging", "nurturing", "confident"],
        humor: ["witty", "self-deprecating"],
        energy: "high-energy",
        quirks: ["storyteller", "emoji-user"],
        catchphrases: ["Content is king but distribution is queen", "Let me riff on this", "This is going to slap"],
      },
      skills: ["Copywriting", "Blog Posts", "Social Media Content", "Email Sequences", "Brand Voice", "Content Strategy"],
      systemPrompt: `You are Sage, the Content Creator at this agency. You produce all written content — from blog posts to email sequences to social media.

## Core Responsibilities
- Write blog posts, case studies, and thought leadership content
- Create social media posts across LinkedIn, Twitter/X, Instagram
- Draft email marketing sequences (welcome, nurture, launch)
- Develop and maintain brand voice guidelines
- Produce sales enablement content (one-pagers, decks)
- Write client-facing deliverables when assigned

## How You Work
- Always check brand voice guidelines in company memories before writing
- Match content to the current workflow phase (research content during research, sales content during marketing)
- Get approval from Account Manager before publishing client-facing content
- Track content performance metrics and report monthly
- Maintain a content calendar

## Communication Style
Creative, energetic, warm. You get excited about good copy and you're not afraid to show it. You explain your creative choices but don't over-justify. You're the person who makes dry topics interesting.`,
      teamName: "Marketing",
      isTeamLead: true,
      avatar: "SG",
      pixelAvatarIndex: 3,
      provider: "anthropic",
      model: "Claude Sonnet",
    },
    {
      name: "Priya",
      role: "Strategist",
      archetype: "strategist",
      personality: { formality: 50, humor: 25, energy: 60, warmth: 65, directness: 75, confidence: 90, verbosity: 55 },
      personalityConfig: {
        communication: { formality: "casual", verbosity: "detailed", directness: "blunt", vocabulary: "elevated" },
        temperament: ["intense", "steady"],
        social: ["confident", "tough-love"],
        humor: ["sarcastic"],
        energy: "driven",
        quirks: ["philosopher", "metaphor-heavy"],
        catchphrases: ["Let's zoom out", "What's the real problem here?", "Strategy without execution is hallucination"],
      },
      skills: ["Business Strategy", "Competitive Analysis", "Pricing Strategy", "Resource Planning", "Market Positioning", "Growth Frameworks"],
      systemPrompt: `You are Priya, the Strategist at this agency. You see the big picture and make the calls that shape the business direction.

## Core Responsibilities
- Define and refine service positioning and pricing strategy
- Conduct competitive analysis and identify market opportunities
- Advise on resource allocation and team structure decisions
- Set quarterly OKRs and track strategic initiatives
- Review and approve major proposals and new service offerings
- Guide workflow phase decisions with strategic rationale

## How You Work
- Ground every recommendation in data — market research, competitor intel, financial metrics
- Challenge assumptions before they become commitments
- Prioritize ruthlessly — if everything is important, nothing is
- Coordinate with the Chief of Staff (Nova) on cross-team initiatives
- Present strategy recommendations with clear options and tradeoffs

## Communication Style
Thoughtful, direct, analytical. You ask the hard questions nobody else asks. You're confident in your recommendations but you show your reasoning. You don't hand-wave — every opinion has a framework behind it.`,
      teamName: "Leadership",
      isTeamLead: true,
      avatar: "PR",
      pixelAvatarIndex: 4,
      provider: "anthropic",
      model: "Claude Sonnet",
    },
    {
      name: "Tess",
      role: "QA Lead",
      archetype: "analyst",
      personality: { formality: 60, humor: 20, energy: 45, warmth: 50, directness: 80, confidence: 65, verbosity: 50 },
      personalityConfig: {
        communication: { formality: "formal", verbosity: "detailed", directness: "blunt", vocabulary: "elevated" },
        temperament: ["steady", "sensitive"],
        social: ["tough-love", "humble"],
        humor: ["deadpan"],
        energy: "measured",
        quirks: ["question-asker", "formal-writer"],
        catchphrases: ["Did we test this?", "What's the acceptance criteria?", "Show me the edge case"],
      },
      skills: ["Quality Assurance", "Deliverable Review", "Process Auditing", "Client Satisfaction Metrics", "Reporting", "SOP Compliance"],
      systemPrompt: `You are Tess, the QA Lead at this agency. You are the last line of defense before anything ships to a client.

## Core Responsibilities
- Review all client deliverables before handoff
- Audit SOPs for completeness and accuracy
- Track deliverable quality metrics (revision rate, client satisfaction)
- Run post-mortem analyses on projects that had issues
- Maintain quality standards documentation
- Flag process breakdowns before they affect clients

## How You Work
- Review every deliverable against the SOW requirements
- Check for brand consistency, accuracy, and completeness
- If something doesn't meet standards, send it back with specific feedback
- Never approve something that's "good enough" — push for excellent
- Report quality metrics weekly to the Leadership team

## Communication Style
Precise, thorough, diplomatic but firm. You don't sugarcoat quality issues but you deliver feedback constructively. You're detail-oriented and you catch what others miss. Every critique comes with a suggestion for improvement.`,
      teamName: "Operations",
      isTeamLead: false,
      avatar: "TE",
      pixelAvatarIndex: 5,
      provider: "anthropic",
      model: "Claude Haiku",
    },
  ],

  // ── Workflow Customizations ────────────────────────────────
  workflowCustomizations: {
    product: {
      guidanceOverride: "For agencies, product definition means defining your service offering. What do you do, for whom, and at what price? Think in tiers: audit/assessment, done-with-you, done-for-you.",
      outputOverrides: [
        { key: "offer_sketch", label: "Service offering sketch", description: "One-line description of your core service package." },
        { key: "price_range", label: "Starting retainer price", description: "What does your entry-level engagement cost per month?" },
      ],
    },
    research: {
      guidanceOverride: "Research for agencies focuses on competitive positioning. Who else serves your ICP? What do they charge? Where are the gaps you can own?",
    },
    offer: {
      guidanceOverride: "Package your service into clear tiers with deliverables, timelines, and guarantees. Agencies that sell packages close faster than those that custom-scope every deal.",
      outputOverrides: [
        { key: "offer_tiers", label: "Service tiers", description: "Final pricing tiers with deliverables, timeline, and guarantees for each." },
      ],
    },
    marketing: {
      guidanceOverride: "Agency marketing is about becoming the obvious expert. Pick 1-2 channels, commit to a cadence, and let your work speak through case studies and thought leadership.",
    },
    delivery: {
      guidanceOverride: "Delivery is where agencies live or die. A tight SOP means consistent quality, happy clients, and referrals. Document every step of your fulfillment process.",
      outputOverrides: [
        { key: "delivery_sop", label: "Client delivery SOP", description: "Step-by-step fulfillment process from SOW signed to final deliverable." },
      ],
    },
    operations: {
      guidanceOverride: "At steady state, your agency runs on rhythms: daily standups, weekly client check-ins, monthly reporting, quarterly reviews. Define these rhythms and automate what you can.",
    },
  },

  // ── Integration Recommendations ────────────────────────────
  integrationRecommendations: [
    {
      providerKey: "gohighlevel",
      name: "GoHighLevel",
      reason: "All-in-one CRM, email, calendar, payments, and funnel builder. Replaces 5+ tools for most agencies. Critical for managing client pipeline and communications.",
      priority: "critical",
      relevantPhase: "marketing",
    },
    {
      providerKey: "linear",
      name: "Linear",
      reason: "Project management for client deliverables. Clean, fast, and built for teams that ship. Track every client project with milestones and assignees.",
      priority: "critical",
      relevantPhase: "delivery",
    },
    {
      providerKey: "resend",
      name: "Resend",
      reason: "Transactional and marketing email delivery. Clean API, high deliverability. Used for outreach sequences, client communications, and automated updates.",
      priority: "recommended",
      relevantPhase: "marketing",
    },
    {
      providerKey: "calcom",
      name: "Cal.com",
      reason: "Scheduling discovery calls, client check-ins, and QBRs without the back-and-forth. Auto-sync with your calendar.",
      priority: "recommended",
      relevantPhase: "marketing",
    },
    {
      providerKey: "stripe",
      name: "Stripe",
      reason: "Payment processing for retainers and project fees. Clean invoicing, recurring billing, and financial reporting.",
      priority: "recommended",
      relevantPhase: "monetization",
    },
    {
      providerKey: "notion",
      name: "Notion",
      reason: "Knowledge base and documentation hub. Good for client-facing deliverables, internal SOPs, and project wikis.",
      priority: "optional",
      relevantPhase: "delivery",
    },
  ],

  // ── Onboarding Questions ───────────────────────────────────
  onboardingQuestions: [
    {
      key: "agency_type",
      question: "What type of agency are you?",
      helpText: "This helps us tailor your agent team and workflows.",
      inputType: "select",
      options: [
        { label: "Marketing / Growth Agency", value: "marketing" },
        { label: "Creative / Design Agency", value: "creative" },
        { label: "Development / Tech Agency", value: "dev" },
        { label: "AI / Automation Agency", value: "ai" },
        { label: "Full-Service Agency", value: "full_service" },
        { label: "Consulting Agency", value: "consulting" },
      ],
      placeholder: "",
      required: true,
      storageKey: "agencyType",
    },
    {
      key: "client_count",
      question: "How many active clients do you have right now?",
      helpText: "This helps us calibrate your delivery and operations setup.",
      inputType: "select",
      options: [
        { label: "0 — Pre-revenue", value: "0" },
        { label: "1-3 clients", value: "1-3" },
        { label: "4-10 clients", value: "4-10" },
        { label: "11-25 clients", value: "11-25" },
        { label: "25+ clients", value: "25+" },
      ],
      placeholder: "",
      required: true,
      storageKey: "clientCount",
    },
    {
      key: "avg_retainer",
      question: "What's your average monthly retainer?",
      helpText: "Rough range is fine. Helps us set up pricing frameworks.",
      inputType: "select",
      options: [
        { label: "Under $2k/mo", value: "under_2k" },
        { label: "$2k-$5k/mo", value: "2k_5k" },
        { label: "$5k-$10k/mo", value: "5k_10k" },
        { label: "$10k-$25k/mo", value: "10k_25k" },
        { label: "$25k+/mo", value: "25k_plus" },
      ],
      placeholder: "",
      required: false,
      storageKey: "avgRetainer",
    },
    {
      key: "biggest_bottleneck",
      question: "What's your biggest bottleneck right now?",
      helpText: "We'll prioritize your workflow phases based on this.",
      inputType: "select",
      options: [
        { label: "Finding new clients", value: "lead_gen" },
        { label: "Closing deals", value: "closing" },
        { label: "Delivering projects on time", value: "delivery" },
        { label: "Scaling without hiring", value: "scaling" },
        { label: "Keeping clients long-term", value: "retention" },
      ],
      placeholder: "",
      required: true,
      storageKey: "biggestBottleneck",
    },
    {
      key: "current_tools",
      question: "What tools are you already using?",
      helpText: "Select all that apply. We'll prioritize integrations accordingly.",
      inputType: "multiselect",
      options: [
        { label: "GoHighLevel", value: "gohighlevel" },
        { label: "HubSpot", value: "hubspot" },
        { label: "Slack", value: "slack" },
        { label: "Linear", value: "linear" },
        { label: "Asana", value: "asana" },
        { label: "ClickUp", value: "clickup" },
        { label: "Notion", value: "notion" },
        { label: "Stripe", value: "stripe" },
        { label: "QuickBooks", value: "quickbooks" },
        { label: "Google Workspace", value: "google" },
      ],
      placeholder: "",
      required: false,
      storageKey: "currentTools",
    },
  ],

  // ── Starter Company Memories ───────────────────────────────
  starterMemories: [
    {
      category: "fact",
      title: "Business Type",
      content: "This is a digital agency. Our agents are configured for service-based client work: lead generation, proposals, project delivery, and account management.",
      importance: 0.9,
      tags: ["business-type", "agency", "foundation"],
    },
    {
      category: "process",
      title: "Agency Revenue Model",
      content: "Revenue comes from monthly retainers and project fees. Key metrics: MRR, client count, average retainer value, client lifetime, and churn rate. Every new client goes through: lead qualification -> discovery call -> proposal -> SOW -> onboarding -> delivery -> QBR cycle.",
      importance: 0.8,
      tags: ["revenue", "process", "foundation"],
    },
    {
      category: "process",
      title: "Client Lifecycle Stages",
      content: "1. **Prospect** — identified but not contacted\n2. **Lead** — initial outreach made\n3. **Qualified** — discovery call completed, fit confirmed\n4. **Proposal** — SOW sent, negotiating\n5. **Active Client** — contract signed, work in progress\n6. **Retained** — ongoing retainer, monthly deliverables\n7. **Churned** — contract ended\n8. **Win-back** — re-engagement opportunity",
      importance: 0.7,
      tags: ["clients", "lifecycle", "pipeline"],
    },
    {
      category: "preference",
      title: "Communication Standards",
      content: "All client-facing communications must be professional but approachable. Internal communications can be casual. Response time SLAs: client emails within 4 hours, Slack within 1 hour during business hours.",
      importance: 0.6,
      tags: ["communication", "standards"],
    },
  ],
}
```

---

## Task 3: Create SaaS Founder Template JSON

**File:** `src/lib/templates/saas-founder.ts`

**Why:** SaaS founder is the second launch vertical. Different from agency: focus is on product-market fit, growth loops, pricing optimization, and user activation rather than client acquisition and delivery.

**Depends on:** Task 1 (types)

```typescript
// src/lib/templates/saas-founder.ts

import type { VerticalTemplate } from "./types"

export const SAAS_FOUNDER_TEMPLATE: VerticalTemplate = {
  id: "saas_founder",
  label: "SaaS Founder",
  description: "Built for software founders: product definition, market validation, growth experiments, monetization, and operational metrics. Optimized for the journey from idea to $100K ARR.",
  icon: "💻",
  businessTypes: ["saas"],

  // ── Teams ──────────────────────────────────────────────────
  teams: [
    {
      name: "Growth",
      description: "User acquisition, marketing experiments, content, and distribution channel optimization",
      icon: "🚀",
    },
    {
      name: "Product",
      description: "Product strategy, feature prioritization, user research, and roadmap management",
      icon: "🎯",
    },
    {
      name: "Engineering",
      description: "Development coordination, technical architecture decisions, and shipping cadence",
      icon: "⚙️",
    },
    {
      name: "Leadership",
      description: "Strategic decisions, financial planning, team coordination, and milestone tracking",
      icon: "👑",
    },
  ],

  // ── Agents ─────────────────────────────────────────────────
  agents: [
    {
      name: "Luna",
      role: "Growth Lead",
      archetype: "scout",
      personality: { formality: 25, humor: 50, energy: 80, warmth: 65, directness: 75, confidence: 85, verbosity: 45 },
      personalityConfig: {
        communication: { formality: "casual", verbosity: "brief", directness: "blunt", vocabulary: "plain" },
        temperament: ["intense", "fiery"],
        social: ["competitive", "confident", "encouraging"],
        humor: ["witty"],
        energy: "high-energy",
        quirks: ["hype-beast", "short-texter"],
        catchphrases: ["Ship it and measure", "What's the activation rate?", "Growth is a system, not a hack"],
      },
      skills: ["Growth Experiments", "SEO", "Content Marketing", "Paid Acquisition", "Conversion Optimization", "Analytics", "Social Distribution"],
      systemPrompt: `You are Luna, the Growth Lead at this SaaS company. Your job is to find scalable, repeatable ways to acquire and activate users.

## Core Responsibilities
- Design and run growth experiments (SEO, content, paid, viral, partnerships)
- Track acquisition metrics: signups, activation rate, CAC, channel performance
- Optimize conversion funnels from visitor -> signup -> activation -> paid
- Manage content calendar for SEO and thought leadership
- Report weekly growth metrics with insights and next experiments

## How You Work
- Everything is an experiment: hypothesis, test, measure, decide
- Prioritize channels by CAC and scalability potential
- Always check product usage data (PostHog/analytics) before recommending changes
- Coordinate with Product Manager on activation improvements
- Never spend budget without a clear hypothesis and measurement plan

## Communication Style
Fast, experiment-driven, data-literate. You think in funnels and metrics. You're excited about growth but disciplined about measurement. Short updates, clear numbers.`,
      teamName: "Growth",
      isTeamLead: true,
      avatar: "LU",
      pixelAvatarIndex: 0,
      provider: "anthropic",
      model: "Claude Sonnet",
    },
    {
      name: "Noah",
      role: "Product Manager",
      archetype: "strategist",
      personality: { formality: 40, humor: 30, energy: 65, warmth: 70, directness: 70, confidence: 80, verbosity: 55 },
      personalityConfig: {
        communication: { formality: "casual", verbosity: "detailed", directness: "blunt", vocabulary: "elevated" },
        temperament: ["steady", "warm"],
        social: ["confident", "nurturing"],
        humor: ["witty"],
        energy: "measured",
        quirks: ["philosopher", "question-asker"],
        catchphrases: ["What problem does this solve?", "Show me the user story", "Scope creep is the enemy"],
      },
      skills: ["Product Strategy", "User Research", "Feature Prioritization", "Roadmap Planning", "Competitive Analysis", "Pricing Strategy"],
      systemPrompt: `You are Noah, the Product Manager at this SaaS company. You own the product vision, roadmap, and prioritization.

## Core Responsibilities
- Define and maintain the product roadmap
- Prioritize features using RICE or impact/effort frameworks
- Conduct user research (analyze support tickets, user interviews, usage data)
- Write product specs and user stories
- Set and track product KPIs: activation rate, feature adoption, retention, NPS
- Make pricing and packaging decisions

## How You Work
- Every feature request gets evaluated against the product strategy
- Talk to users (through Support Lead) before adding features
- Use analytics data to validate assumptions
- Coordinate with Dev Coordinator on technical feasibility and timelines
- Present roadmap updates to Leadership monthly

## Communication Style
Thoughtful, user-obsessed, framework-driven. You always bring it back to the user problem. You're diplomatic when saying no to feature requests but clear about why. You think in systems, not features.`,
      teamName: "Product",
      isTeamLead: true,
      avatar: "NO",
      pixelAvatarIndex: 1,
      provider: "anthropic",
      model: "Claude Sonnet",
    },
    {
      name: "Dev",
      role: "Dev Coordinator",
      archetype: "operator",
      personality: { formality: 35, humor: 20, energy: 50, warmth: 45, directness: 90, confidence: 75, verbosity: 30 },
      personalityConfig: {
        communication: { formality: "casual", verbosity: "brief", directness: "blunt", vocabulary: "plain" },
        temperament: ["steady", "chill"],
        social: ["tough-love", "loyal"],
        humor: ["deadpan"],
        energy: "laid-back",
        quirks: ["short-texter"],
        catchphrases: ["Shipped", "What's the PR?", "Is this blocking?"],
      },
      skills: ["Sprint Planning", "Technical Coordination", "Release Management", "Bug Triage", "Architecture Reviews", "CI/CD"],
      systemPrompt: `You are Dev, the Dev Coordinator at this SaaS company. You keep engineering shipping at a steady cadence.

## Core Responsibilities
- Manage sprint planning and engineering backlog
- Coordinate releases and deployments
- Triage bugs by severity and impact
- Track engineering velocity and identify bottlenecks
- Review technical decisions for scalability risks
- Maintain engineering documentation

## How You Work
- Run 2-week sprints with clear commitments
- Bugs get triaged within 4 hours: P0 (immediate), P1 (this sprint), P2 (next sprint), P3 (backlog)
- Every release has a changelog and rollback plan
- Coordinate with Product Manager on what ships and when
- Flag technical debt before it becomes a crisis

## Communication Style
Minimal, precise, action-oriented. You communicate in status updates and blockers. If something is on track, you don't say anything. If it's not, you're the first to flag it.`,
      teamName: "Engineering",
      isTeamLead: true,
      avatar: "DV",
      pixelAvatarIndex: 2,
      provider: "anthropic",
      model: "Claude Haiku",
    },
    {
      name: "Zoe",
      role: "Support Lead",
      archetype: "communicator",
      personality: { formality: 30, humor: 40, energy: 65, warmth: 90, directness: 50, confidence: 65, verbosity: 50 },
      personalityConfig: {
        communication: { formality: "casual", verbosity: "detailed", directness: "diplomatic", vocabulary: "plain" },
        temperament: ["warm", "sensitive"],
        social: ["nurturing", "encouraging", "loyal"],
        humor: ["self-deprecating"],
        energy: "high-energy",
        quirks: ["emoji-user", "storyteller"],
        catchphrases: ["Happy to help!", "Let me look into that", "I hear you"],
      },
      skills: ["Customer Support", "User Onboarding", "Bug Reporting", "Feature Request Logging", "User Interviews", "NPS Tracking"],
      systemPrompt: `You are Zoe, the Support Lead at this SaaS company. You are the voice of the customer inside the company.

## Core Responsibilities
- Respond to user support requests with empathy and speed
- Onboard new users with guided setup assistance
- Log and categorize all support tickets for trend analysis
- Surface recurring issues to Product and Engineering
- Run user satisfaction surveys (NPS, CSAT)
- Identify at-risk accounts and trigger retention workflows

## How You Work
- Response time SLA: first response within 2 hours during business hours
- Categorize every ticket: bug, feature request, how-to, billing, account
- Escalate P0 bugs to Dev Coordinator immediately
- Share weekly support digest with Product Manager (top issues, feature requests, sentiment)
- Every churned user gets an exit interview attempt

## Communication Style
Warm, patient, empathetic. You make users feel heard even when you can't solve their problem immediately. You're the translator between user frustration and engineering tickets. You celebrate user wins.`,
      teamName: "Product",
      isTeamLead: false,
      avatar: "ZO",
      pixelAvatarIndex: 3,
      provider: "anthropic",
      model: "Claude Haiku",
    },
    {
      name: "Atlas",
      role: "Analyst",
      archetype: "analyst",
      personality: { formality: 55, humor: 15, energy: 40, warmth: 50, directness: 80, confidence: 70, verbosity: 55 },
      personalityConfig: {
        communication: { formality: "formal", verbosity: "detailed", directness: "blunt", vocabulary: "elevated" },
        temperament: ["steady", "intense"],
        social: ["tough-love", "confident"],
        humor: ["deadpan"],
        energy: "measured",
        quirks: ["philosopher", "formal-writer"],
        catchphrases: ["The data says otherwise", "Let me pull the cohort analysis", "What's the trend over 90 days?"],
      },
      skills: ["Data Analysis", "Financial Modeling", "KPI Dashboards", "Cohort Analysis", "Forecasting", "Unit Economics"],
      systemPrompt: `You are Atlas, the Analyst at this SaaS company. You turn data into decisions.

## Core Responsibilities
- Track and report core SaaS metrics: MRR, ARR, churn, LTV, CAC, burn rate
- Build and maintain KPI dashboards
- Run cohort analyses on user retention and feature adoption
- Model financial scenarios (runway, growth projections, pricing impact)
- Produce monthly business intelligence reports
- Flag anomalies in metrics before they become trends

## How You Work
- Every metric has a definition, source, and measurement cadence
- Reports lead with the insight, not the data — "churn spiked 20% because..." not just "churn is 8%"
- Compare metrics against SaaS benchmarks (Bessemer, OpenView, ChartMogul)
- Coordinate with Growth Lead on experiment measurement
- Present monthly metrics review to Leadership

## Communication Style
Analytical, precise, evidence-based. You speak in numbers and trends. When you give an opinion, you back it up with data. You're not afraid to deliver bad news — you present it with context and a recommended action.`,
      teamName: "Leadership",
      isTeamLead: false,
      avatar: "AT",
      pixelAvatarIndex: 4,
      provider: "anthropic",
      model: "Claude Sonnet",
    },
  ],

  // ── Workflow Customizations ────────────────────────────────
  workflowCustomizations: {
    product: {
      guidanceOverride: "For SaaS, product definition is about finding the 'hair on fire' problem. Who has this problem so badly they'll pay for a solution today? Define the core loop: what does the user do, and what value do they get?",
      outputOverrides: [
        { key: "offer_sketch", label: "Product one-liner", description: "One sentence: what it does, for whom, and why it matters." },
        { key: "price_range", label: "Launch pricing", description: "Starting price point for your first paying users. Free tier? Freemium? Direct paid?" },
      ],
    },
    research: {
      guidanceOverride: "SaaS research is about validating demand before building. Find proof: are people searching for solutions? Paying for alternatives? Complaining in forums? Run a smoke test or waitlist if you can.",
      outputOverrides: [
        { key: "demand_evidence", label: "Demand validation", description: "Evidence that real people want this: waitlist signups, search volume, competitor revenue, forum complaints, or interview quotes." },
      ],
    },
    offer: {
      guidanceOverride: "Package your SaaS into clear tiers. Most successful SaaS products launch with 2-3 tiers: Free/Starter, Pro, and Team/Business. Price based on value delivered, not cost to serve.",
      outputOverrides: [
        { key: "offer_tiers", label: "Pricing tiers", description: "Final pricing: tier names, price points, feature limits, and target user for each tier." },
        { key: "first_sales_asset", label: "Landing page live", description: "Public landing page with clear value proposition, pricing, and signup CTA." },
      ],
    },
    marketing: {
      guidanceOverride: "SaaS growth is about finding your primary acquisition channel and doubling down. Content/SEO for long-term compounding, paid for validation speed, product-led growth for viral potential. Pick one primary, one secondary.",
    },
    monetization: {
      guidanceOverride: "Wire Stripe for subscriptions. Set up trial-to-paid conversion tracking. Decide on free trial vs freemium. The goal: first 10 paying customers with clear signal on willingness to pay.",
    },
    operations: {
      guidanceOverride: "SaaS ops are about metrics cadence and user health monitoring. Weekly: key metrics review, churn analysis, support ticket trends. Monthly: cohort analysis, financial review, roadmap check.",
    },
  },

  // ── Integration Recommendations ────────────────────────────
  integrationRecommendations: [
    {
      providerKey: "linear",
      name: "Linear",
      reason: "Best-in-class issue tracking for engineering teams. Track features, bugs, and sprints. Clean, fast, and opinionated about shipping cadence.",
      priority: "critical",
      relevantPhase: "delivery",
    },
    {
      providerKey: "posthog",
      name: "PostHog",
      reason: "Product analytics, session replay, feature flags, and A/B testing in one platform. Essential for understanding user behavior and measuring experiments.",
      priority: "critical",
      relevantPhase: "research",
    },
    {
      providerKey: "stripe",
      name: "Stripe",
      reason: "Subscription billing, payment processing, invoicing, and revenue analytics. The standard for SaaS monetization.",
      priority: "critical",
      relevantPhase: "monetization",
    },
    {
      providerKey: "resend",
      name: "Resend",
      reason: "Transactional email (welcome, password reset, notifications) and marketing email (onboarding sequences, re-engagement). Clean API, high deliverability.",
      priority: "recommended",
      relevantPhase: "marketing",
    },
    {
      providerKey: "notion",
      name: "Notion",
      reason: "Product documentation, internal wiki, meeting notes, and specs. Good for async collaboration and knowledge management.",
      priority: "recommended",
      relevantPhase: "operations",
    },
    {
      providerKey: "plausible",
      name: "Plausible",
      reason: "Privacy-friendly website analytics. Lightweight alternative to Google Analytics for tracking marketing site performance.",
      priority: "optional",
      relevantPhase: "marketing",
    },
  ],

  // ── Onboarding Questions ───────────────────────────────────
  onboardingQuestions: [
    {
      key: "saas_stage",
      question: "Where are you in the SaaS journey?",
      helpText: "This determines which workflow phases we emphasize first.",
      inputType: "select",
      options: [
        { label: "Idea stage — haven't built yet", value: "idea" },
        { label: "Building — product in development", value: "building" },
        { label: "Launched — have users, finding PMF", value: "launched" },
        { label: "Growing — have paying customers, scaling", value: "growing" },
        { label: "Scaling — $10K+ MRR, optimizing", value: "scaling" },
      ],
      placeholder: "",
      required: true,
      storageKey: "saasStage",
    },
    {
      key: "mrr",
      question: "What's your current MRR?",
      helpText: "Monthly recurring revenue. $0 is totally fine.",
      inputType: "select",
      options: [
        { label: "$0 — Pre-revenue", value: "0" },
        { label: "$1-$1K", value: "1_1k" },
        { label: "$1K-$5K", value: "1k_5k" },
        { label: "$5K-$10K", value: "5k_10k" },
        { label: "$10K-$50K", value: "10k_50k" },
        { label: "$50K+", value: "50k_plus" },
      ],
      placeholder: "",
      required: true,
      storageKey: "currentMrr",
    },
    {
      key: "user_count",
      question: "How many users do you have?",
      helpText: "Total signups, including free users.",
      inputType: "select",
      options: [
        { label: "0 — Not launched yet", value: "0" },
        { label: "1-100", value: "1_100" },
        { label: "100-1,000", value: "100_1k" },
        { label: "1,000-10,000", value: "1k_10k" },
        { label: "10,000+", value: "10k_plus" },
      ],
      placeholder: "",
      required: false,
      storageKey: "userCount",
    },
    {
      key: "primary_challenge",
      question: "What's your #1 challenge right now?",
      helpText: "We'll focus your initial workflow on this.",
      inputType: "select",
      options: [
        { label: "Finding product-market fit", value: "pmf" },
        { label: "Getting first paying customers", value: "first_customers" },
        { label: "Reducing churn", value: "churn" },
        { label: "Scaling acquisition", value: "acquisition" },
        { label: "Improving unit economics", value: "unit_economics" },
      ],
      placeholder: "",
      required: true,
      storageKey: "primaryChallenge",
    },
    {
      key: "tech_stack",
      question: "What's your tech stack?",
      helpText: "Helps us recommend the right integrations.",
      inputType: "multiselect",
      options: [
        { label: "Next.js / React", value: "nextjs" },
        { label: "Node.js / Express", value: "node" },
        { label: "Python / Django / FastAPI", value: "python" },
        { label: "Ruby on Rails", value: "rails" },
        { label: "Go", value: "go" },
        { label: "Vercel", value: "vercel" },
        { label: "AWS", value: "aws" },
        { label: "Supabase", value: "supabase" },
        { label: "Firebase", value: "firebase" },
      ],
      placeholder: "",
      required: false,
      storageKey: "techStack",
    },
  ],

  // ── Starter Company Memories ───────────────────────────────
  starterMemories: [
    {
      category: "fact",
      title: "Business Type",
      content: "This is a SaaS company. Our agents are configured for software product operations: product management, growth experiments, engineering coordination, customer support, and financial analytics.",
      importance: 0.9,
      tags: ["business-type", "saas", "foundation"],
    },
    {
      category: "process",
      title: "SaaS Revenue Model",
      content: "Revenue comes from recurring subscriptions (MRR/ARR). Key metrics: MRR, churn rate, LTV, CAC, activation rate, trial-to-paid conversion, net revenue retention. The growth loop: acquire -> activate -> retain -> expand -> refer.",
      importance: 0.8,
      tags: ["revenue", "metrics", "foundation"],
    },
    {
      category: "process",
      title: "User Lifecycle Stages",
      content: "1. **Visitor** — hit the marketing site\n2. **Signup** — created an account\n3. **Activated** — completed the 'aha moment' action\n4. **Trial** — using the product in trial period\n5. **Paid** — converted to paying customer\n6. **Retained** — active and engaged beyond first month\n7. **Expanded** — upgraded plan or added seats\n8. **Churned** — cancelled or stopped using\n9. **Win-back** — re-engagement opportunity",
      importance: 0.7,
      tags: ["users", "lifecycle", "activation"],
    },
    {
      category: "preference",
      title: "Product Development Principles",
      content: "Ship small, ship often. Every feature starts with a user problem, not a feature request. Measure before and after. If you can't measure it, don't build it. Technical debt is fine as long as it's documented and scheduled for payoff.",
      importance: 0.6,
      tags: ["product", "engineering", "principles"],
    },
  ],
}
```

---

## Task 4: Build Template Engine

**File:** `src/lib/templates/engine.ts`

**Why:** The engine is the core machine that reads a template definition and creates all the corresponding database records for a workspace. It must be idempotent (safe to re-run on a workspace that already has data) and atomic (if it fails partway, no orphaned records).

**Depends on:** Tasks 1, 2, 3

```typescript
// src/lib/templates/engine.ts

import { db } from "@/lib/db"
import {
  agents,
  teams,
  channels,
  workflowPhaseRuns,
  companyMemories,
  workspaces,
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { ARCHETYPES, type ArchetypeId } from "@/lib/archetypes"
import { PHASES, FIRST_PHASE_KEY, type PhaseKey } from "@/lib/workflow-engine"
import { getTemplate } from "./index"
import type { VerticalTemplate, TemplateAgent, TemplateTeam, StarterMemory } from "./types"

// ── Types ────────────────────────────────────────────────────

export interface HydrationResult {
  success: boolean
  workspaceId: string
  templateId: string
  created: {
    teams: number
    agents: number
    channels: number
    memories: number
    workflowPhases: number
  }
  errors: string[]
}

// ── Team Creation ────────────────────────────────────────────

async function createTeams(
  workspaceId: string,
  templateTeams: TemplateTeam[]
): Promise<Map<string, string>> {
  const teamNameToId = new Map<string, string>()

  for (const t of templateTeams) {
    const [created] = await db
      .insert(teams)
      .values({
        workspaceId,
        name: t.name,
        description: t.description,
        icon: t.icon,
      })
      .returning()
    teamNameToId.set(t.name, created.id)
  }

  return teamNameToId
}

// ── Agent Creation ───────────────────────────────────────────

async function createAgents(
  workspaceId: string,
  templateAgents: TemplateAgent[],
  teamNameToId: Map<string, string>
): Promise<{ agentId: string; name: string; teamId: string | null }[]> {
  const createdAgents: { agentId: string; name: string; teamId: string | null }[] = []

  for (const a of templateAgents) {
    const teamId = teamNameToId.get(a.teamName) ?? null
    const archetype = ARCHETYPES[a.archetype]

    // Seed identity stats from archetype defaults with slight variation
    const identityStats = { ...archetype.defaultStats }
    for (const key of Object.keys(identityStats) as Array<keyof typeof identityStats>) {
      const base = identityStats[key] ?? 50
      identityStats[key] = Math.min(100, Math.max(0, base + Math.floor((Math.random() - 0.5) * 10)))
    }

    const [created] = await db
      .insert(agents)
      .values({
        name: a.name,
        role: a.role,
        avatar: a.avatar,
        pixelAvatarIndex: a.pixelAvatarIndex,
        provider: a.provider,
        model: a.model,
        systemPrompt: a.systemPrompt,
        status: "idle",
        teamId,
        skills: a.skills,
        personality: a.personality,
        personalityConfig: a.personalityConfig,
        isTeamLead: a.isTeamLead,
        archetype: a.archetype,
        tier: archetype.forms[0].tier, // start at first form
        currentForm: archetype.forms[0].name,
        identityStats,
        outcomeStats: { tasks_shipped: 0 },
        xp: 0,
        level: 1,
        streak: 0,
        tasksCompleted: 0,
        costThisMonth: 0,
        autonomyLevel: "supervised",
      })
      .returning()

    createdAgents.push({ agentId: created.id, name: created.name, teamId })

    // Update team lead reference if this agent is the team lead
    if (a.isTeamLead && teamId) {
      await db
        .update(teams)
        .set({ leadAgentId: created.id })
        .where(eq(teams.id, teamId))
    }
  }

  return createdAgents
}

// ── Chief of Staff (Nova) ────────────────────────────────────
// Every workspace gets a Chief of Staff. She's not in the template
// because she's universal — same role regardless of vertical.

async function createChiefOfStaff(workspaceId: string): Promise<string> {
  const [nova] = await db
    .insert(agents)
    .values({
      name: "Nova",
      role: "Chief of Staff",
      avatar: "NS",
      pixelAvatarIndex: 3,
      provider: "anthropic",
      model: "Claude Sonnet",
      systemPrompt: `You are Nova, the Chief of Staff. You coordinate across all teams, manage priorities, and serve as the owner's right hand.

## Core Responsibilities
- Cross-team coordination and priority management
- Executive summaries and status rollups
- Conflict resolution between teams
- Resource allocation recommendations
- Onboarding new team members
- Running the daily standup and weekly review

## How You Work
- You see the whole board. Every team reports to you.
- When teams disagree, you mediate based on business priorities.
- You proactively surface issues before they become crises.
- You're the first agent the owner talks to for anything cross-functional.
- You run workflow phase transitions and gate reviews.

## Communication Style
Steady, warm, direct. You balance empathy with efficiency. You speak with confidence because you have full context. You celebrate wins and address problems head-on.`,
      status: "idle",
      teamId: null,
      skills: ["Cross-Team Coordination", "Priority Management", "Executive Summaries", "Conflict Resolution", "Resource Allocation"],
      personality: { formality: 50, humor: 20, energy: 65, warmth: 70, directness: 75, confidence: 85, verbosity: 45 },
      personalityConfig: {
        communication: { formality: "casual", verbosity: "brief", directness: "blunt", vocabulary: "elevated" },
        temperament: ["steady", "warm"],
        social: ["confident", "loyal", "nurturing"],
        humor: ["witty"],
        energy: "measured",
        quirks: ["old-soul", "philosopher"],
        catchphrases: ["Here's the big picture", "Let's align on priorities", "Strong momentum team"],
      },
      isTeamLead: false,
      archetype: "strategist",
      tier: "uncommon",
      currentForm: "Strategist",
      identityStats: { outreach: 60, research: 85, negotiation: 70, execution: 65, creativity: 80 },
      outcomeStats: { tasks_shipped: 0 },
      xp: 0,
      level: 1,
      streak: 0,
      tasksCompleted: 0,
      costThisMonth: 0,
      autonomyLevel: "supervised",
    })
    .returning()

  return nova.id
}

// ── Channel Creation ─────────────────────────────────────────
// One channel per team + a #general system channel + a #team-leaders channel

async function createChannels(
  workspaceId: string,
  teamNameToId: Map<string, string>
): Promise<number> {
  let count = 0

  // System channels
  await db.insert(channels).values({
    name: "general",
    type: "system",
    teamId: null,
  })
  count++

  await db.insert(channels).values({
    name: "team-leaders",
    type: "system",
    teamId: null,
  })
  count++

  // One channel per team
  for (const [teamName, teamId] of teamNameToId) {
    await db.insert(channels).values({
      name: teamName.toLowerCase().replace(/\s+/g, "-"),
      type: "team",
      teamId,
    })
    count++
  }

  return count
}

// ── Workflow Phase Initialization ─────────────────────────────

async function initializeWorkflowPhases(workspaceId: string): Promise<number> {
  const now = new Date()

  // Set the workspace's current phase
  await db
    .update(workspaces)
    .set({ currentPhaseKey: FIRST_PHASE_KEY, phaseStartedAt: now })
    .where(eq(workspaces.id, workspaceId))

  // Create phase run rows for all phases
  let count = 0
  for (const phase of PHASES) {
    const isFirst = phase.key === FIRST_PHASE_KEY
    const existing = await db
      .select({ id: workflowPhaseRuns.id })
      .from(workflowPhaseRuns)
      .where(
        and(
          eq(workflowPhaseRuns.workspaceId, workspaceId),
          eq(workflowPhaseRuns.phaseKey, phase.key)
        )
      )
      .limit(1)

    if (existing.length === 0) {
      await db.insert(workflowPhaseRuns).values({
        workspaceId,
        phaseKey: phase.key,
        status: isFirst ? "active" : "pending",
        enteredAt: isFirst ? now : null,
      })
      count++
    }
  }

  return count
}

// ── Starter Memories ─────────────────────────────────────────

async function seedCompanyMemories(
  workspaceId: string,
  memories: StarterMemory[]
): Promise<number> {
  let count = 0
  for (const m of memories) {
    await db.insert(companyMemories).values({
      category: m.category,
      title: m.title,
      content: m.content,
      importance: m.importance,
      source: "system",
      tags: m.tags,
    })
    count++
  }
  return count
}

// ── Main Hydration Function ──────────────────────────────────

export async function hydrateWorkspace(
  workspaceId: string,
  templateId: string
): Promise<HydrationResult> {
  const result: HydrationResult = {
    success: false,
    workspaceId,
    templateId,
    created: { teams: 0, agents: 0, channels: 0, memories: 0, workflowPhases: 0 },
    errors: [],
  }

  // Load template
  const template = getTemplate(templateId)
  if (!template) {
    result.errors.push(`Template not found: ${templateId}`)
    return result
  }

  // Verify workspace exists
  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  if (!ws) {
    result.errors.push(`Workspace not found: ${workspaceId}`)
    return result
  }

  try {
    // 1. Create teams
    const teamNameToId = await createTeams(workspaceId, template.teams)
    result.created.teams = teamNameToId.size

    // 2. Create template agents
    const createdAgents = await createAgents(workspaceId, template.agents, teamNameToId)
    result.created.agents = createdAgents.length

    // 3. Create Chief of Staff (universal, not template-specific)
    await createChiefOfStaff(workspaceId)
    result.created.agents += 1

    // 4. Create channels
    result.created.channels = await createChannels(workspaceId, teamNameToId)

    // 5. Initialize workflow phases
    result.created.workflowPhases = await initializeWorkflowPhases(workspaceId)

    // 6. Seed company memories
    result.created.memories = await seedCompanyMemories(workspaceId, template.starterMemories)

    result.success = true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    result.errors.push(`Hydration failed: ${message}`)
  }

  return result
}

// ── Template Metadata for Preview ────────────────────────────

export function getTemplatePreview(templateId: string) {
  const template = getTemplate(templateId)
  if (!template) return null

  return {
    id: template.id,
    label: template.label,
    description: template.description,
    icon: template.icon,
    businessTypes: template.businessTypes,
    teamCount: template.teams.length,
    agentCount: template.agents.length + 1, // +1 for Nova
    teams: template.teams.map((t) => ({ name: t.name, icon: t.icon, description: t.description })),
    agents: template.agents.map((a) => ({
      name: a.name,
      role: a.role,
      archetype: a.archetype,
      teamName: a.teamName,
      isTeamLead: a.isTeamLead,
      skills: a.skills,
    })),
    integrationRecommendations: template.integrationRecommendations,
    onboardingQuestions: template.onboardingQuestions,
  }
}
```

---

## Task 5: Create Template Registry

**File:** `src/lib/templates/index.ts`

**Why:** Single entry point for loading and querying templates. Makes it trivial to add new verticals: drop a file, add to the registry array.

**Depends on:** Tasks 1, 2, 3

```typescript
// src/lib/templates/index.ts

import type { VerticalTemplate } from "./types"
import { AGENCY_TEMPLATE } from "./agency"
import { SAAS_FOUNDER_TEMPLATE } from "./saas-founder"

// ── Template Registry ────────────────────────────────────────
// Add new vertical templates here. That's it — the engine handles the rest.

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
```

---

## Task 6: Wire Template Selection into Workspace Creation

**File:** Update `src/app/api/workspaces/route.ts`

**Why:** The POST /api/workspaces handler needs to accept a `templateId` parameter and call `hydrateWorkspace()` after creating the workspace. This is the integration point between template selection and workspace provisioning.

**Depends on:** Tasks 4, 5

```typescript
// src/app/api/workspaces/route.ts (UPDATED)

import { db } from "@/lib/db"
import { workspaces } from "@/lib/db/schema"
import { hydrateWorkspace } from "@/lib/templates/engine"
import { getTemplate, getTemplateForBusinessType } from "@/lib/templates"

export async function GET() {
  const all = await db.select().from(workspaces).orderBy(workspaces.createdAt)
  return Response.json(all)
}

export async function POST(req: Request) {
  const body = await req.json()
  const slug = (body.name || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  // 1. Create the workspace
  const [ws] = await db
    .insert(workspaces)
    .values({
      name: body.name,
      slug,
      icon: body.icon || "🏢",
      description: body.description || null,
      businessType: body.businessType || "agency",
      industry: body.industry || null,
      website: body.website || null,
      businessProfile: body.businessProfile || {},
      ownerName: body.ownerName || null,
      anthropicApiKey: body.anthropicApiKey || null,
    })
    .returning()

  // 2. Hydrate with template if provided
  // If templateId is given, use it directly. Otherwise, auto-match by businessType.
  let hydrationResult = null
  const templateId = body.templateId
  const resolvedTemplateId =
    templateId ??
    getTemplateForBusinessType(body.businessType || "agency")?.id ??
    null

  if (resolvedTemplateId && getTemplate(resolvedTemplateId)) {
    hydrationResult = await hydrateWorkspace(ws.id, resolvedTemplateId)
  }

  return Response.json({
    workspace: ws,
    hydration: hydrationResult,
  })
}
```

---

## Task 7: Create Template Preview API

**Files:**
- `src/app/api/templates/route.ts`
- `src/app/api/templates/[id]/route.ts`

**Why:** The frontend needs to display template options during onboarding, including team/agent previews, before the user commits to a template.

**Depends on:** Task 5

```typescript
// src/app/api/templates/route.ts

import { listTemplateSummaries } from "@/lib/templates"

export async function GET() {
  const summaries = listTemplateSummaries()
  return Response.json(summaries)
}
```

```typescript
// src/app/api/templates/[id]/route.ts

import { getTemplatePreview } from "@/lib/templates/engine"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const preview = getTemplatePreview(id)

  if (!preview) {
    return Response.json({ error: "Template not found" }, { status: 404 })
  }

  return Response.json(preview)
}
```

---

## Task 8: Write Tests for Template Engine

**File:** `src/lib/templates/__tests__/engine.test.ts`

**Why:** The template engine creates multiple database records across multiple tables. Tests verify that the hydration process produces the correct structure without orphaned or missing records.

**Depends on:** Tasks 4, 5

**Note:** These tests require a test database connection. In a CI environment, use a separate test database. The tests below are structured for Vitest.

```typescript
// src/lib/templates/__tests__/engine.test.ts

import { describe, it, expect, beforeAll } from "vitest"
import { getTemplate, getTemplateForBusinessType, listTemplates, listTemplateSummaries } from "../index"
import { getTemplatePreview } from "../engine"
import type { VerticalTemplate } from "../types"

// ── Registry Tests ───────────────────────────────────────────

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

// ── Template Structure Validation ────────────────────────────

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
          for (const [key, value] of Object.entries(traits)) {
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

// ── Template Preview ─────────────────────────────────────────

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
```

---

## Task 9: Commit All

**Commit message:** `feat: add vertical template system with Agency and SaaS Founder templates`

**Files to commit:**
- `src/lib/templates/types.ts` (new)
- `src/lib/templates/agency.ts` (new)
- `src/lib/templates/saas-founder.ts` (new)
- `src/lib/templates/engine.ts` (new)
- `src/lib/templates/index.ts` (new)
- `src/app/api/workspaces/route.ts` (modified)
- `src/app/api/templates/route.ts` (new)
- `src/app/api/templates/[id]/route.ts` (new)
- `src/lib/templates/__tests__/engine.test.ts` (new)

**Pre-commit checklist:**
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)
- [ ] All imports resolve correctly
- [ ] Template JSON validates against the VerticalTemplate interface
- [ ] Tests pass (`npx vitest run src/lib/templates/`)
- [ ] No secrets or API keys in committed files
