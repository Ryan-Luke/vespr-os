# Project Index: VESPR-OS (Business OS)

Generated: 2026-04-06

## Overview

**AI Agent Control Center for Business Owners.** A full-stack Next.js 16 app where autonomous AI agents (powered by Anthropic Claude) run business operations — sales, marketing, delivery, ops — through a Slack-like team interface with gamification, pixel-art office, and a 7-phase workflow engine.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.2 (App Router) |
| Runtime | React 19, TypeScript 5 |
| Database | Neon Postgres (serverless) via Drizzle ORM |
| AI | Vercel AI SDK 6 + @ai-sdk/anthropic |
| UI | Tailwind CSS 4, shadcn/ui, Recharts, BlockNote (rich editor), cmdk |
| Deployment | Vercel (with cron jobs) |
| Auth | Custom (password hash + session cookies) |

## Project Structure

```
src/
  app/
    (app)/              # Authenticated app shell (sidebar + workspace provider)
      dashboard/        # Home dashboard with KPIs and trophy feed
      chat/             # Slack-like agent chat interface
      teams/            # Department management + agent drill-down
      tasks/            # Task board (backlog/todo/in-progress/review/done)
      office/           # Pixel-art virtual office (isometric 2D engine)
      builder/          # Agent builder/creator
      roster/           # Agent roster with archetypes and evolution
      automations/      # Cron job and schedule management
      knowledge/        # Knowledge base (company wiki)
      decisions/        # Decision audit log
      settings/         # Workspace + theme settings
      integrations/     # SaaS integration picker
      business/         # Business profile + docs (BlockNote editor)
      feed/             # Trophy/activity feed
      compare/          # Agent comparison view
      timeline/         # Activity timeline
    api/                # 66 API routes (see below)
    t/[slug]/           # Public trainer profile page
    invite/[token]/     # Invite acceptance flow
    reset/              # Data reset page
  components/           # 66 React components
  hooks/
    use-data.ts         # Generic SWR-like data fetcher
  lib/
    db/
      schema.ts         # 25+ Drizzle tables (see Data Model)
      index.ts          # Neon serverless connection
      seed.ts           # Demo data seeder
      seed-activity.ts  # Activity log seeder
      wipe.ts           # Data wipe utility
    agents/
      autonomous.ts     # Core agent task runner (generateText + tools)
      cron-executor.ts  # Cron schedule runner
      web-tools.ts      # Web search/fetch tools for agents
    integrations/
      registry.ts       # Provider registry (GHL, Stripe, HubSpot, etc.)
      credentials.ts    # Encrypted credential storage
      crypto.ts         # AES-256-GCM encryption
      tools.ts          # Integration tool builder for agents
      clients/          # Per-provider API clients (Stripe, Linear, GHL)
      capabilities/     # Capability abstractions (CRM, payments, messaging, PM)
    approvals/
      executor.ts       # Human-in-the-loop approval executor
    auth/
      session.ts        # Cookie-based session management
      password.ts       # Password hashing
      current-user.ts   # Current user resolver
    pixel-office/       # Isometric pixel-art office engine
      engine/           # Game loop, renderer, character system
      sprites/          # Sprite data and caching
      layout/           # Furniture catalog, tile maps, serialization
      shared-assets/    # Asset manifest utilities
    workflow-engine.ts  # 7-phase business-building state machine
    gamification.ts     # XP, levels, milestones
    agent-mood.ts       # Agent mood/emotion system
    archetypes.ts       # 9 agent archetypes with evolution forms
    personality-presets.ts # Personality trait system (7 axes)
    workspace-context.tsx  # React context for active workspace
    workspace-server.ts    # Server-side workspace resolver
    types.ts            # Shared TypeScript interfaces
    api.ts              # Client-side API helper
    onboarding-starter-content.ts # Initial workspace setup data
  proxy.ts              # Dev proxy utility
public/
  assets/
    furniture/          # 25 isometric furniture sprites (PNG + manifest.json each)
    asset-index.json    # Master asset index
    furniture-catalog.json
    default-layout-1.json
scripts/
  seed-demo.ts          # Demo data seeder script
  seed-playbooks.ts     # Playbook seeder script
drizzle/
  0000_narrow_colleen_wing.sql  # Initial migration
  meta/                 # Drizzle migration snapshots
```

## Entry Points

- **Web App**: `src/app/layout.tsx` (root) + `src/app/(app)/layout.tsx` (app shell)
- **API**: 66 route handlers under `src/app/api/`
- **Chat AI**: `src/app/api/chat/route.ts` (streaming agent chat via Vercel AI SDK)
- **Agent Engine**: `src/lib/agents/autonomous.ts` (background task execution)
- **Workflow Engine**: `src/lib/workflow-engine.ts` (7-phase state machine)

## Key API Routes (66 total)

| Route | Purpose |
|-------|---------|
| `/api/chat` | Streaming AI chat with agent personality, SOPs, and memories |
| `/api/agents`, `/api/agents/create`, `/api/agents/[agentId]` | Agent CRUD |
| `/api/agent-tasks`, `/api/agent-tasks/run` | Autonomous task execution |
| `/api/tasks`, `/api/tasks/count` | Task board management |
| `/api/messages`, `/api/messages/find`, `/api/messages/unread` | Slack-like messaging |
| `/api/workflow/*` | Workflow phase advancement, gates, outputs, skip |
| `/api/teams` | Department/team management |
| `/api/auth/*` | Login, signup, logout, status |
| `/api/integrations/*` | SaaS integration management + credential storage |
| `/api/knowledge` | Knowledge base CRUD |
| `/api/sops`, `/api/sops/generate` | Standard Operating Procedures |
| `/api/approval-requests` | Human-in-the-loop approvals |
| `/api/decisions` | Audit trail |
| `/api/gamification` | XP, levels, milestones |
| `/api/evolution-events` | Agent evolution tracking |
| `/api/trophy-events` | Win feed |
| `/api/schedules` | Cron job management |
| `/api/memory`, `/api/company-memory` | Agent + shared memory |
| `/api/feedback` | Agent feedback (thumbs up/down) |
| `/api/workspaces` | Workspace CRUD |
| `/api/share-card/*` | Shareable trophy/evolution cards (image generation) |

## Data Model (25+ tables)

**Core Entities**: users, workspaces, teams, agents, channels, messages, tasks
**AI Systems**: agentMemories, companyMemories, agentSops, agentTasks, handoffEvents
**Workflow**: workflowPhaseRuns (7-phase state machine per workspace)
**Gamification**: milestones, trophyEvents, evolutionEvents, rosterUnlocks, agentBonds, agentTraits
**Governance**: approvalRequests, approvalLog, autoApprovals, decisionLog, agentFeedback
**Integrations**: integrations (encrypted credentials), knowledgeEntries
**Scheduling**: automations, agentSchedules
**Auth**: users, invites

## Core Architecture Concepts

1. **Autonomous Agent Engine** — Agents use `generateText` with tools (post to channels, create docs, hand off to departments, fire wins). Background execution, not just chat response.

2. **7-Phase Workflow Engine** — product -> research -> offer -> marketing -> monetization -> delivery -> operations. Each phase has a lead agent, required outputs, and a user buy-in gate.

3. **Human-in-the-Loop Approvals** — Agents request approval for high-stakes actions (send email, approve spend). Progressive autonomy: repeated approvals can auto-approve.

4. **Agent Identity System** — 9 archetypes (Scout, Closer, Analyst, etc.) with tiered evolution (common -> legendary). Personality is configurable across 7 axes.

5. **Integration Layer** — "Integrate, don't rebuild." SaaS credentials stored with AES-256-GCM encryption. Agents call external tools through adapter layer.

6. **Pixel Office** — Isometric 2D virtual office with character sprites, furniture placement, and game loop engine. Purely visual/fun.

7. **Gamification** — XP, levels, trophies, evolution moments, roster unlocks, agent bonds/synergy.

## Vercel Cron Jobs

| Schedule | Route | Purpose |
|----------|-------|---------|
| Every 5 min | `/api/cron/agent-schedules` | Execute agent cron schedules |
| Every 10 min | `/api/cron/agent-work` | Process queued agent tasks |
| Mon 9am | `/api/cron/weekly-reviews` | Generate weekly performance reviews |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Neon Postgres (pooled) |
| `DATABASE_URL_UNPOOLED` | Yes | Neon Postgres (direct) |
| `ANTHROPIC_API_KEY` | Yes | Claude API for AI agents |
| `AUTH_SECRET` | Yes | Session encryption key |
| `INTEGRATION_ENCRYPTION_KEY` | Yes | AES-256-GCM for credentials |
| `LINEAR_API_KEY` | No | Linear integration |

## Quick Start

1. `cp .env.example .env.local` — fill in Neon DB URL + Anthropic key
2. `npm install`
3. `npx drizzle-kit push` — create/migrate database tables
4. `npm run dev` — start on localhost:3000

## Test Coverage

- **Unit tests**: 0 files
- **Integration tests**: 0 files
- No test framework configured
