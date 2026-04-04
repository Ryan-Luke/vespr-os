// Starter content for new workspaces — different frameworks per business type
// Used by /api/onboarding when a new workspace is created

export interface StarterContent {
  knowledgeEntries: Array<{
    title: string
    content: string
    category: string
    tags: string[]
  }>
  sops: Array<{
    title: string
    content: string
    category: string
    roleHint: string // which agent role should own this (matches on substring)
  }>
  userTasks: Array<{
    title: string
    description: string
    priority: string
    instructions?: string
    requirement?: { type: "file" | "url" | "text" | "checkbox"; label: string }
  }>
}

const COMMON_KNOWLEDGE = [
  {
    title: "Your Business Mission",
    content: "## What We Do\n\nTBD — Edit this from the My Business page.\n\n## Who We Serve\n\nTBD\n\n## Why We Exist\n\nTBD",
    category: "business",
    tags: ["mission", "foundation"],
  },
  {
    title: "Ideal Client Profile (ICP)",
    content: "## Our Ideal Client\n\n**Company Size:** TBD\n**Industry:** TBD\n**Pain Points:** TBD\n**Decision Maker:** TBD\n**Budget Range:** TBD\n\nUpdate this as you learn who converts best.",
    category: "business",
    tags: ["ICP", "sales"],
  },
]

const COMMON_USER_TASKS = [
  {
    title: "Fill in your business mission statement",
    description: "Your agents will make better decisions when they understand why your business exists. Takes 5 minutes.",
    priority: "high",
    instructions: "Open the My Business page in the sidebar. Fill in the Mission field with 2-3 sentences about what you do and why.",
    requirement: { type: "checkbox" as const, label: "I've updated my business mission" },
  },
  {
    title: "Define your ICP (Ideal Client Profile)",
    description: "Who exactly are you trying to serve? The more specific, the better your agents can work.",
    priority: "high",
    instructions: "Go to My Business → ICP section. Describe company size, industry, team size, pain points, and decision maker.",
    requirement: { type: "checkbox" as const, label: "I've defined my ICP" },
  },
]

const AGENCY_CONTENT: StarterContent = {
  knowledgeEntries: [
    ...COMMON_KNOWLEDGE,
    {
      title: "Service Packages & Pricing Framework",
      content: "## Standard Service Tiers\n\n### Tier 1: Audit/Assessment\n- One-time engagement\n- Scope: Discovery + roadmap\n- Typical price: $2k-$5k\n\n### Tier 2: Done-With-You\n- Monthly retainer\n- Scope: Strategy + execution support\n- Typical price: $3k-$8k/mo\n\n### Tier 3: Done-For-You\n- Monthly retainer\n- Scope: Full execution\n- Typical price: $8k-$15k/mo\n\n### Add-ons:\n- Priority support\n- Additional deliverables\n- Custom training",
      category: "business",
      tags: ["pricing", "packages", "sales"],
    },
    {
      title: "Client Onboarding Framework",
      content: "## Standard Onboarding Process\n\n### Day 1: Kickoff\n- Welcome email (automated)\n- Slack/comms channel setup\n- Project brief shared\n- Kickoff call scheduled\n\n### Week 1: Discovery\n- Access to tools collected\n- Stakeholder interviews\n- Current state documented\n\n### Week 2: Strategy\n- Roadmap delivered\n- Priorities aligned\n- First deliverables started\n\n### Week 3-4: Execution\n- Weekly check-ins\n- Progress reports\n- Quick wins delivered\n\n### 90 Days: QBR\n- Quarterly business review\n- ROI analysis\n- Next phase planning",
      category: "process",
      tags: ["onboarding", "framework"],
    },
    {
      title: "Sales Outreach Playbook",
      content: "## Cold Outreach Best Practices\n\n### Channels:\n1. Cold email (highest ROI)\n2. LinkedIn DMs (relationship-building)\n3. Warm intros (highest conversion)\n\n### Email Structure:\n- Subject: Pain-point focused (not feature-focused)\n- Hook: Reference something specific about their business\n- Value: 1-2 sentences on what we do for similar clients\n- CTA: Specific next step (15-min call, not 'chat')\n\n### Cadence:\n- Email 1: Day 1 — Pain hook\n- Email 2: Day 3 — Case study\n- Email 3: Day 7 — Social proof\n- Email 4: Day 14 — Breakup",
      category: "reference",
      tags: ["sales", "outreach", "playbook"],
    },
  ],
  sops: [
    { title: "New Client Onboarding Checklist", content: "- [ ] Welcome email sent\n- [ ] Slack channel created\n- [ ] Project brief shared\n- [ ] Kickoff call scheduled\n- [ ] Access credentials collected\n- [ ] Weekly cadence established\n- [ ] First deliverable timeline confirmed\n- [ ] 90-day QBR date set", category: "process", roleHint: "client" },
    { title: "Sales Lead Qualification", content: "## Scoring (1-10)\n\n**Auto-qualify (8+):** Revenue fit, team size fit, decision maker, urgency\n**Nurture (5-7):** Right size, wrong timing\n**Disqualify (<5):** Too small, wrong fit, no budget", category: "process", roleHint: "sales" },
    { title: "Proposal Template", content: "1. Problem statement\n2. Our approach\n3. Deliverables\n4. Timeline\n5. Investment\n6. Team\n7. Next steps", category: "reference", roleHint: "sales" },
  ],
  userTasks: [
    ...COMMON_USER_TASKS,
    { title: "Document your current service offerings", description: "What do you sell, at what price, and to whom? This powers your agents' sales conversations.", priority: "high", instructions: "Edit the 'Service Packages & Pricing Framework' knowledge entry with your actual offerings.", requirement: { type: "checkbox" as const, label: "I've documented my services" } },
  ],
}

const SAAS_CONTENT: StarterContent = {
  knowledgeEntries: [
    ...COMMON_KNOWLEDGE,
    {
      title: "Product & Pricing",
      content: "## Current Product Lineup\n\n### Plan Tiers\n- Free/Starter\n- Pro\n- Business\n- Enterprise\n\n### Pricing Model\n- Per-seat, per-month, or usage-based\n\n### Key Metrics\n- MRR / ARR\n- Churn\n- LTV / CAC\n- Activation rate",
      category: "business",
      tags: ["product", "pricing", "metrics"],
    },
    {
      title: "User Activation Framework",
      content: "## The 'Aha Moment'\n\nWhen does a new user first see real value?\n\n### Activation Checklist:\n1. Account created\n2. First [core action]\n3. Invited a teammate\n4. Integrated with [key tool]\n5. Completed first [workflow]\n\nUsers who complete activation convert to paid at X% vs Y% for non-activated.",
      category: "process",
      tags: ["activation", "growth", "onboarding"],
    },
    {
      title: "Churn Reduction Playbook",
      content: "## Early Warning Signs\n- Login frequency drops >50%\n- Support tickets spike\n- Feature usage declines\n- Team member removes access\n\n## Intervention Tactics\n- Proactive check-in email\n- CS call offer\n- Feature re-engagement campaign\n- Downgrade vs cancel offer",
      category: "reference",
      tags: ["churn", "retention"],
    },
  ],
  sops: [
    { title: "Feature Request Triage", content: "1. Log in product board\n2. Check for duplicates\n3. Tag by priority (P0-P3)\n4. Assign to next review\n5. Respond to user within 24h", category: "process", roleHint: "product" },
    { title: "Customer Support Escalation", content: "**Tier 1:** Standard support (2hr response)\n**Tier 2:** Technical issues (4hr)\n**Tier 3:** Engineering on-call (1hr for P0)\n**Tier 4:** Founder/CEO (enterprise accounts)", category: "escalation", roleHint: "support" },
  ],
  userTasks: [
    ...COMMON_USER_TASKS,
    { title: "Connect your analytics tool", description: "Mixpanel, Amplitude, PostHog, or similar — your agents need product usage data to help with retention and growth.", priority: "high", instructions: "Go to Integrations and connect your analytics platform.", requirement: { type: "checkbox" as const, label: "Analytics connected" } },
  ],
}

const ECOMMERCE_CONTENT: StarterContent = {
  knowledgeEntries: [
    ...COMMON_KNOWLEDGE,
    {
      title: "Brand & Product Positioning",
      content: "## Brand Voice\n- Tone: TBD\n- Style: TBD\n\n## Hero Products\n- Product 1: [margin/AOV/velocity]\n- Product 2: [margin/AOV/velocity]\n\n## Unit Economics\n- Average Order Value: $X\n- Cost per Acquisition: $X\n- Lifetime Value: $X\n- Gross Margin: X%",
      category: "business",
      tags: ["branding", "products", "margins"],
    },
    {
      title: "Email/SMS Flow Playbook",
      content: "## Core Automated Flows\n\n1. **Welcome Series** (5 emails) — Activation\n2. **Abandoned Cart** (3 emails) — Recovery\n3. **Browse Abandonment** (2 emails) — Re-engagement\n4. **Post-Purchase** (3 emails) — Retention & review requests\n5. **Win-back** (3 emails) — Churned customers\n6. **VIP Program** — Repeat buyers\n\n## Benchmarks\n- Welcome open rate: 60%+\n- Abandoned cart recovery: 10-15%\n- Post-purchase review rate: 15-20%",
      category: "reference",
      tags: ["email", "sms", "retention"],
    },
    {
      title: "Ad Platform Strategy",
      content: "## Paid Acquisition Mix\n\n### Meta (FB/IG)\n- Best for: Cold prospecting, creative testing\n- Target CPA: TBD\n- Creative refresh: Every 14 days\n\n### Google (Search + Shopping)\n- Best for: High-intent purchase queries\n- Target ROAS: 3-5x\n\n### TikTok\n- Best for: Viral-potential products, younger audiences\n- Lower CPMs but higher creative churn",
      category: "reference",
      tags: ["ads", "marketing", "acquisition"],
    },
  ],
  sops: [
    { title: "Order Fulfillment Workflow", content: "1. Order received → inventory check\n2. Pick & pack\n3. Label printed\n4. Ship confirmation to customer\n5. Tracking update to CRM\n6. Post-delivery review request", category: "process", roleHint: "fulfill" },
    { title: "Customer Return Policy", content: "## Return Window\n30 days from delivery\n\n## Process\n1. Customer requests return via portal\n2. Return label auto-generated\n3. Item inspected on receipt\n4. Refund processed within 5 days\n\n## Exceptions\n- Custom items: non-refundable\n- Sale items: store credit only", category: "reference", roleHint: "support" },
  ],
  userTasks: [
    ...COMMON_USER_TASKS,
    { title: "Connect your store platform", description: "Shopify, WooCommerce, BigCommerce, etc. — agents need order data to help with fulfillment and marketing.", priority: "high", instructions: "Go to Integrations and connect your store.", requirement: { type: "checkbox" as const, label: "Store platform connected" } },
  ],
}

const INFO_PRODUCT_CONTENT: StarterContent = {
  knowledgeEntries: [
    ...COMMON_KNOWLEDGE,
    {
      title: "Product Lineup & Pricing",
      content: "## Core Offers\n\n### Low-Ticket ($27-$97)\n- Purpose: Lead magnet / tripwire\n- Example: Mini-course, template, ebook\n\n### Mid-Ticket ($297-$997)\n- Purpose: Core product\n- Example: Full course, digital course\n\n### High-Ticket ($2k-$15k)\n- Purpose: Premium coaching, mastermind\n- Example: Group coaching, 1:1 program\n\n### Continuity ($47-$297/mo)\n- Purpose: Recurring revenue, community",
      category: "business",
      tags: ["products", "pricing", "offers"],
    },
    {
      title: "Content → Conversion Funnel",
      content: "## The Content Funnel\n\n1. **Organic Content** (TOFU) — IG Reels, YouTube, podcast, LinkedIn\n2. **Lead Magnet** (MOFU) — Free PDF, video series, quiz\n3. **Email Nurture** (MOFU) — 5-7 day sequence\n4. **Offer** (BOFU) — Low-ticket or webinar → high-ticket\n5. **Continuity** — Community, membership\n\n## Key Metrics\n- Cost per lead (CPL)\n- Email → sale conversion\n- LTV per buyer\n- Refund rate",
      category: "reference",
      tags: ["funnel", "content", "conversion"],
    },
  ],
  sops: [
    { title: "Course Launch Checklist", content: "- [ ] Sales page live\n- [ ] Payment processing tested\n- [ ] Email sequence loaded\n- [ ] Affiliate portal ready\n- [ ] Support docs prepared\n- [ ] Launch content published\n- [ ] Webinar scheduled\n- [ ] Cart close automation set", category: "process", roleHint: "marketing" },
    { title: "Customer Refund Process", content: "Honor all refund requests within stated policy window. Log reason for analysis. Offer alternative (e.g., different course) before processing refund.", category: "process", roleHint: "support" },
  ],
  userTasks: [
    ...COMMON_USER_TASKS,
    { title: "List your current offers", description: "What products/courses/programs do you sell? At what price? Your agents use this to recommend the right offer per prospect.", priority: "high", instructions: "Edit the 'Product Lineup & Pricing' knowledge entry with your actual offers.", requirement: { type: "checkbox" as const, label: "I've listed my offers" } },
  ],
}

const CONSULTING_CONTENT: StarterContent = {
  knowledgeEntries: [
    ...COMMON_KNOWLEDGE,
    {
      title: "Engagement Models",
      content: "## Types of Engagements\n\n### Strategic Advisory\n- Monthly retainer\n- 2-4 hrs/mo\n- Price: $3k-$10k/mo\n\n### Project-Based\n- Defined scope & timeline\n- Fixed price\n- Typical: $15k-$100k\n\n### Fractional Exec\n- 10-20 hrs/week\n- 6-12 month contract\n- Price: $10k-$25k/mo\n\n### Speaking/Training\n- One-time events\n- Price: $5k-$50k/day",
      category: "business",
      tags: ["engagements", "pricing"],
    },
    {
      title: "Discovery → Proposal Framework",
      content: "## Discovery Process\n\n### Stage 1: Initial Call (30 min)\n- Understand business, goals, pain points\n- Assess fit\n- Schedule deeper dive if qualified\n\n### Stage 2: Deep Dive (60-90 min)\n- Stakeholder interviews\n- Access to key data/tools\n- Diagnose root issues\n\n### Stage 3: Proposal\n- Problem statement\n- Recommended approach\n- Deliverables & timeline\n- Investment\n\n### Stage 4: Contract & Kickoff\n- SOW signed\n- Payment received\n- Kickoff call within 7 days",
      category: "process",
      tags: ["discovery", "proposals"],
    },
  ],
  sops: [
    { title: "Client Engagement Standards", content: "- Respond to client messages within 24hrs\n- Weekly status updates mandatory\n- Monthly strategic check-ins\n- Quarterly business reviews\n- All deliverables in writing", category: "process", roleHint: "client" },
    { title: "Research Methodology", content: "1. Frame the question clearly\n2. Identify sources (internal data, interviews, external research)\n3. Synthesize findings\n4. Draft recommendation\n5. Peer review before client delivery", category: "process", roleHint: "research" },
  ],
  userTasks: [
    ...COMMON_USER_TASKS,
    { title: "Document your engagement types", description: "Advisory, project-based, fractional, speaking — which do you offer and at what rates?", priority: "high", instructions: "Edit the 'Engagement Models' knowledge entry.", requirement: { type: "checkbox" as const, label: "Engagements documented" } },
  ],
}

const DEFAULT_CONTENT: StarterContent = {
  knowledgeEntries: COMMON_KNOWLEDGE,
  sops: [
    { title: "Team Communication Standards", content: "- Use public channels for work discussions\n- DMs only for urgent/personal matters\n- Daily standup posted by 10am\n- Weekly team sync on Fridays", category: "process", roleHint: "" },
  ],
  userTasks: COMMON_USER_TASKS,
}

export function getStarterContent(businessType: string): StarterContent {
  switch (businessType) {
    case "agency":
      return AGENCY_CONTENT
    case "saas":
      return SAAS_CONTENT
    case "ecommerce":
      return ECOMMERCE_CONTENT
    case "info_product":
      return INFO_PRODUCT_CONTENT
    case "consulting":
      return CONSULTING_CONTENT
    default:
      return DEFAULT_CONTENT
  }
}
