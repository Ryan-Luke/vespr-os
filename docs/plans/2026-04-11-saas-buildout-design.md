# VESPR-OS SaaS Buildout Design

**Date:** 2026-04-11
**Status:** Approved
**Approach:** Layered Build (foundation + features in deliberate phases)

## Context

VESPR-OS is an AI Agent Control Center for business owners. The current state is a functional proof-of-concept with a working autonomous agent engine, 7-phase workflow, chat system, cron jobs, and partial integrations. It needs to become a production SaaS product.

### Key Decisions

- **Product type:** Multi-tenant SaaS
- **UX model:** Progressive disclosure (simple default, power-user depth available)
- **AI cost model:** BYOK (Bring Your Own Key) — users provide Anthropic API keys
- **Launch vertical:** Agencies + SaaS founders (depth-first, extensible to other verticals)
- **Timeline:** Full product launch — build it right before shipping
- **Build strategy:** Layered Build — alternate foundation and features in 6 phases

### Current State (Gap Analysis)

**Working:** Agent autonomy (tools, handoffs, channel posting), workflow engine (7 phases defined), chat with context injection (SOPs, memories, personality), cron jobs (3 endpoints), integration layer (Stripe, GoHighLevel, Linear), pixel office, gamification, seed system.

**Critical Gaps:**
- Auth enforced on only 2 of 50+ API routes
- No workspace isolation (single-tenant)
- No RBAC enforcement
- Agents can't reach outside world (no email, calendar, social)
- Workflow phase advancement is manual
- No error recovery for failed agent tasks
- Chat history not persisted
- Zero tests

---

## Phase 1: Auth, RBAC & Multi-Tenancy

### Auth Middleware
- Global Next.js 16 middleware in `src/middleware.ts`
- Every `/api/*` and `/(app)/*` route requires valid session cookie
- Exceptions: `/api/auth/login`, `/api/auth/signup`, `/api/public/*`, `/api/cron/*` (CRON_SECRET)
- Uses existing HMAC-signed cookie system in `src/lib/auth/session.ts`

### RBAC
- Three roles: `owner`, `admin`, `member` (already in schema)
- Permission matrix:

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Workspace settings | Yes | Yes | No |
| Add/remove agents | Yes | Yes | No |
| Manage integrations & API keys | Yes | Yes | No |
| Approve agent actions | Yes | Yes | Yes |
| Chat, manage tasks | Yes | Yes | Yes |
| Invite/remove users | Yes | Yes | No |
| Delete workspace | Yes | No | No |
| Billing/subscription | Yes | No | No |

- `requireRole()` helper called in route handlers after middleware confirms session

### Multi-Tenancy
- Add `workspaceId` to ~10 tables missing it (agents, channels, messages, tasks, etc.)
- Every API route resolves active workspace from session
- All queries scoped: `where(eq(table.workspaceId, wsId))`
- `withWorkspace(req)` server helper returns `{ user, workspace }` or throws 401/403
- Workspace-scoped query helpers for Drizzle (no native RLS)

### Migration Strategy
- Drizzle migration adds `workspace_id` columns (nullable for backfill, then NOT NULL)
- Seed script creates default workspace and backfills existing data

---

## Phase 2: Agent Autonomy & Workflow Engine

### Auto-Phase Advancement
- After any tool call updates a phase output, check if all required outputs are `"provided"` or `"confirmed"`
- If complete, transition to gate state — surface prompt to user for buy-in
- Notification on dashboard: "Phase X is ready for your review"

### Error Recovery & Retry
- Add `retryCount` and `maxRetries` (default 3) to `agentTasks`
- `/api/cron/agent-work` picks up stuck tasks (running > 2 min, no update) and re-queues
- Failed tasks surface in "Agent Issues" dashboard section

### Chat Persistence
- Persist conversation threads to `messages` table with `threadId`
- On chat reopen, load last 50 messages as context

### Agent-to-Agent Communication
- `consult_agent` tool: agent A invokes agent B with a question, gets response, continues
- Implemented as nested `generateText` call within tool execution

---

## Phase 3: Integration Expansion

### Priority Integrations

| Category | Providers | Capability |
|----------|-----------|------------|
| Email | Resend, SendGrid | Send transactional + marketing emails |
| Calendar | Cal.com, Calendly | Book meetings, check availability |
| CRM (expand) | GoHighLevel, HubSpot | Full CRUD: contacts, deals, pipeline stages, notes |
| PM (expand) | Linear, Asana | Full CRUD: tasks, comments, status updates |
| Social | Buffer, LinkedIn API | Schedule + publish posts |
| Docs | Google Docs, Notion | Create and update documents |
| Analytics | Plausible, PostHog | Pull traffic/product metrics |

### Architecture
- Existing adapter pattern (`capabilities/` layer) stays
- Each provider: `clients/<provider>.ts`, registry entry, capability mapping
- Approval gates remain for high-stakes actions; progressive autonomy for trusted categories

### OAuth Support
- OAuth2 PKCE flow for Google, Notion, calendar providers
- Tokens encrypted in `integrations.config` via existing AES-256-GCM
- Transparent token refresh in client wrappers

---

## Phase 4: Vertical Templates

### Template Structure
1. **Workflow preset** — customized phase outputs and guidance
2. **Starter agent roster** — pre-configured agents with roles, personalities, SOPs
3. **Integration recommendations** — which tools to connect per phase
4. **Onboarding questions** — vertical-specific business profile fields

### Agency Template
- **Agents:** Sales Lead (Scout), Account Manager (Closer), Project Manager (Operator), Content Creator (Writer), Strategist, QA
- **Workflow emphasis:** Lead gen -> Client onboarding -> SOW/proposal -> Delivery management -> Reporting
- **Key integrations:** GoHighLevel/HubSpot, Linear/Asana, Resend, Cal.com

### SaaS Founder Template
- **Agents:** Growth Lead (Scout), Product Manager (Strategist), Dev Coordinator (Operator), Support Lead (Communicator), Analyst
- **Workflow emphasis:** Product definition -> Market research -> Pricing -> Growth channels -> Monetization -> User onboarding -> Ops
- **Key integrations:** Linear, PostHog/Plausible, Stripe, Resend, Notion

### Extensibility
- Templates as JSON config files in `src/lib/templates/`
- New vertical = new JSON file + optional custom phase output specs, no code changes

---

## Phase 5: Onboarding & Billing

### Signup Flow
1. Email + password registration
2. "What kind of business?" — select vertical (agency, SaaS, custom)
3. Business profile — name, industry, team size, goals (vertical-tailored)
4. BYOK setup — paste Anthropic API key, validate with test call
5. Agent roster — auto-populated from template, customizable
6. First phase kickoff — workspace created, workflow initialized, Chief of Staff introduces herself

### Progressive Disclosure
- **Simple mode** (default): Dashboard KPIs, trophy feed, active phase. Agents work autonomously. User interacts via chat and approval queue.
- **Power mode** (toggle): Agent config, system prompts, personality sliders, SOP editor, cron schedules, credentials, decision log.
- Stored as user preference, not plan tier.

### Billing (Stripe)
- Platform billing only (BYOK handles AI costs)
- **Free:** 1 workspace, 3 agents, basic integrations
- **Pro:** Unlimited agents, all integrations, priority cron, advanced analytics
- **Team:** Multi-user, RBAC, audit log, SSO (future)
- Stripe Checkout for subscriptions, webhook handler for plan changes
- `planLimits` helper gates actions against workspace plan

---

## Phase 6: Testing, Monitoring & Polish

### Testing Strategy
- **Unit tests (Vitest):** Crypto, gamification, workflow state transitions, RBAC helpers
- **Integration tests (Vitest + test DB):** API route handlers — auth, workspace scoping, CRUD
- **E2E tests (Playwright):** Signup, onboarding, chat, phase advancement, approval queue
- **Target:** 80%+ coverage on security-critical paths (auth, RBAC, workspace scoping)

### Monitoring
- Structured logging with workspace/agent context on every route
- Vercel Analytics for performance
- Sentry for error tracking (agent task failures, API errors)
- Agent health dashboard: success rates, response times, error rates

### UI Polish
- Loading states and skeletons
- Error boundaries with retry
- Mobile responsiveness testing
- Accessibility pass (keyboard nav, screen readers, contrast)

---

## Phase Dependencies

| Phase | Focus | Depends On | Can Parallel With |
|-------|-------|------------|-------------------|
| 1 | Auth, RBAC, Multi-tenancy | Nothing | — |
| 2 | Agent autonomy, workflow, chat | Phase 1 | Phase 3 |
| 3 | Integration expansion | Phase 1 | Phase 2 |
| 4 | Vertical templates | Phases 2 & 3 | — |
| 5 | Onboarding, billing | Phases 1 & 4 | — |
| 6 | Testing, monitoring, polish | All phases (continuous) | Everything |
