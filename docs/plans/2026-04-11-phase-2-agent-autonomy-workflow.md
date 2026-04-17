# Phase 2: Agent Autonomy & Workflow Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make agents meaningfully smarter — auto-advance workflow phases, recover from failures, persist chat history, and enable agent-to-agent consultation.

**Architecture:** Workflow engine gains completion detection and gate notification. Agent tasks get retry/recovery via cron. Chat threads are persisted to the messages table and loaded on reconnect. A new `consult_agent` tool enables inter-agent communication.

**Tech Stack:** Vercel AI SDK, Drizzle ORM, Next.js API routes

**Depends on:** Phase 1 (Auth, RBAC & Multi-Tenancy) complete.

---

## Task 1: Auto-Phase Advancement

### Step 1.1 — Add `checkPhaseCompletion()` to workflow engine

**File:** `src/lib/workflow-engine.ts`

**Why:** After any output is recorded via `upsertPhaseOutput()`, we need to check if ALL required outputs for the phase are now "provided" or "confirmed". If so, transition the phase run to "gate_ready" status. Today this check doesn't exist — advancement is fully manual.

**Test first (failing):**

Create the test file:

```bash
mkdir -p src/__tests__
```

**File:** `src/__tests__/workflow-engine.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// We'll mock the DB layer so tests run without Postgres
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

// Import after mocks are set up
import { checkPhaseCompletion, getPhase } from "@/lib/workflow-engine"
import type { PhaseRunState } from "@/lib/workflow-engine"

describe("checkPhaseCompletion", () => {
  it("returns false when some outputs are still empty", async () => {
    const outputs: PhaseRunState["outputs"] = {
      target_customer: { status: "provided", value: "SMBs" },
      problem_solved: { status: "provided", value: "Manual invoicing" },
      offer_sketch: { status: "empty" },
      price_range: { status: "empty" },
    }
    const result = await checkPhaseCompletion("product", outputs)
    expect(result).toBe(false)
  })

  it("returns true when all outputs are provided", async () => {
    const outputs: PhaseRunState["outputs"] = {
      target_customer: { status: "provided", value: "SMBs" },
      problem_solved: { status: "provided", value: "Manual invoicing" },
      offer_sketch: { status: "provided", value: "AI invoicing tool" },
      price_range: { status: "confirmed", value: "$99/mo" },
    }
    const result = await checkPhaseCompletion("product", outputs)
    expect(result).toBe(true)
  })

  it("returns true when all outputs are confirmed", async () => {
    const outputs: PhaseRunState["outputs"] = {
      target_customer: { status: "confirmed", value: "SMBs" },
      problem_solved: { status: "confirmed", value: "Manual invoicing" },
      offer_sketch: { status: "confirmed", value: "AI invoicing tool" },
      price_range: { status: "confirmed", value: "$99/mo" },
    }
    const result = await checkPhaseCompletion("product", outputs)
    expect(result).toBe(true)
  })

  it("ignores outputs not in the phase definition", async () => {
    // If there's an extra key in outputs that isn't a required output, it shouldn't matter
    const outputs: PhaseRunState["outputs"] = {
      target_customer: { status: "provided", value: "SMBs" },
      problem_solved: { status: "provided", value: "Manual invoicing" },
      offer_sketch: { status: "provided", value: "AI invoicing tool" },
      price_range: { status: "provided", value: "$99/mo" },
      some_extra_key: { status: "empty" },
    }
    const result = await checkPhaseCompletion("product", outputs)
    expect(result).toBe(true)
  })
})
```

**Run to verify fail:**

```bash
npx vitest run src/__tests__/workflow-engine.test.ts
```

**Expected:** Fails because `checkPhaseCompletion` doesn't exist yet.

**Implement:**

**File:** `src/lib/workflow-engine.ts`

Find this block (around line 462):

```typescript
  await db
    .update(workflowPhaseRuns)
    .set({ outputs: nextOutputs, updatedAt: now })
    .where(eq(workflowPhaseRuns.id, existing.id))
}
```

Replace with:

```typescript
  await db
    .update(workflowPhaseRuns)
    .set({ outputs: nextOutputs, updatedAt: now })
    .where(eq(workflowPhaseRuns.id, existing.id))

  // After updating, check if this phase is now complete
  await maybeTransitionToGateReady(workspaceId, phaseKey, nextOutputs)
}
```

Now add the new functions. Find this line near the end of `upsertPhaseOutput` (the closing `}` of the function), and add the following AFTER it, BEFORE `export async function recordPhaseGate`:

```typescript
/**
 * Pure logic check: are all required outputs for a phase filled?
 * Returns true if every required output has status "provided" or "confirmed".
 * This is exported for testing — the side-effectful wrapper is maybeTransitionToGateReady.
 */
export function checkPhaseCompletion(
  phaseKey: PhaseKey,
  outputs: PhaseRunState["outputs"],
): boolean {
  const phase = getPhase(phaseKey)
  for (const spec of phase.requiredOutputs) {
    const entry = outputs[spec.key]
    if (!entry || entry.status === "empty") return false
  }
  return true
}

/**
 * After an output is recorded, check if all required outputs are filled.
 * If so, update the phase run status to "gate_ready" and insert a
 * notification into activity_log so the NotificationBell picks it up.
 */
async function maybeTransitionToGateReady(
  workspaceId: string,
  phaseKey: PhaseKey,
  outputs: PhaseRunState["outputs"],
): Promise<void> {
  if (!checkPhaseCompletion(phaseKey, outputs)) return

  const phase = getPhase(phaseKey)

  // Update the phase run row to gate_ready
  await db
    .update(workflowPhaseRuns)
    .set({ status: "gate_ready", updatedAt: new Date() })
    .where(
      and(
        eq(workflowPhaseRuns.workspaceId, workspaceId),
        eq(workflowPhaseRuns.phaseKey, phaseKey),
      ),
    )

  // Insert a notification into activity_log so the bell picks it up.
  // We also insert into the dedicated notifications table (Task 2).
  const { activityLog } = await import("@/lib/db/schema")
  await db.insert(activityLog).values({
    agentName: "Workflow Engine",
    action: "phase_gate_ready",
    description: `Phase "${phase.label}" is ready for your review. All required outputs are captured.`,
    metadata: { phaseKey, workspaceId },
  }).catch(() => {})
}
```

**Update the `PhaseStatus` type** to include `"gate_ready"`. Find:

```typescript
export type PhaseStatus = "pending" | "active" | "completed" | "skipped"
```

Replace with:

```typescript
export type PhaseStatus = "pending" | "active" | "gate_ready" | "completed" | "skipped"
```

**Also update the schema comment** in `src/lib/db/schema.ts`. Find:

```typescript
  status: text("status").notNull().default("pending"), // "pending" | "active" | "completed" | "skipped"
```

Replace with (inside the `workflowPhaseRuns` table definition):

```typescript
  status: text("status").notNull().default("pending"), // "pending" | "active" | "gate_ready" | "completed" | "skipped"
```

**Run to verify pass:**

```bash
npx vitest run src/__tests__/workflow-engine.test.ts
```

**Expected:** All 4 tests pass.

### Step 1.2 — Wire `checkPhaseCompletion` into `record_phase_output` tool

The `record_phase_output` tool in the chat route calls `upsertPhaseOutput()` which now internally calls `maybeTransitionToGateReady()`. No change needed in the chat route itself — the completion check is baked into the workflow engine.

**Verify:** Read `src/app/api/chat/route.ts` lines 326-366 — both the `decision` and `artifact` branches call `upsertPhaseOutput()`, which now triggers the auto-check.

**No code change needed here.** The wiring happened in Step 1.1 by adding the `maybeTransitionToGateReady` call inside `upsertPhaseOutput`.

### Step 1.3 — Commit

```bash
git add src/lib/workflow-engine.ts src/lib/db/schema.ts src/__tests__/workflow-engine.test.ts
git commit -m "feat: auto-phase advancement — detect completion and transition to gate_ready

After any phase output is recorded via upsertPhaseOutput(), the workflow
engine now checks if ALL required outputs are provided/confirmed. If so,
the phase transitions to gate_ready status and a notification is logged.

Adds checkPhaseCompletion() (pure logic, exported for tests) and
maybeTransitionToGateReady() (side-effectful DB wrapper).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Phase Gate UI Notification

### Step 2.1 — Create `notifications` table in schema

**File:** `src/lib/db/schema.ts`

Find the end of the `activityLog` table definition (after line 578):

```typescript
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

Add after it:

```typescript

// ── Notifications ────────────────────────────────────────
// Actionable notifications for the workspace owner. These are distinct
// from the activity log (which is a firehose). Notifications are things
// that need the user's attention: phase gates, failed tasks, approvals.
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  type: text("type").notNull(), // "phase_gate_ready" | "agent_task_failed" | "approval_needed" | "milestone"
  title: text("title").notNull(),
  description: text("description"),
  actionUrl: text("action_url"), // where to navigate when clicked
  read: boolean("read").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

### Step 2.2 — Generate and run migration

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

**Expected output:** Migration generated for `notifications` table. Push applies it to the database.

### Step 2.3 — Create `/api/notifications/route.ts`

```bash
mkdir -p src/app/api/notifications
```

**File:** `src/app/api/notifications/route.ts`

```typescript
import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"

// GET /api/notifications — fetch recent notifications, unread first
export async function GET(req: Request) {
  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get("unread") === "true"

  const conditions = unreadOnly
    ? [eq(notifications.read, false)]
    : []

  const rows = await db
    .select()
    .from(notifications)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(notifications.createdAt))
    .limit(50)

  return Response.json(rows)
}

// PATCH /api/notifications — mark notifications as read
// Body: { ids: string[] } or { all: true }
export async function PATCH(req: Request) {
  const body = await req.json() as { ids?: string[]; all?: boolean }

  if (body.all) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.read, false))
  } else if (body.ids && body.ids.length > 0) {
    for (const id of body.ids) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, id))
    }
  } else {
    return Response.json({ error: "Provide ids[] or all:true" }, { status: 400 })
  }

  return Response.json({ ok: true })
}
```

### Step 2.4 — Insert notification when phase hits gate_ready

**File:** `src/lib/workflow-engine.ts`

Find the `maybeTransitionToGateReady` function. Replace the activity_log insert block:

```typescript
  // Insert a notification into activity_log so the bell picks it up.
  // We also insert into the dedicated notifications table (Task 2).
  const { activityLog } = await import("@/lib/db/schema")
  await db.insert(activityLog).values({
    agentName: "Workflow Engine",
    action: "phase_gate_ready",
    description: `Phase "${phase.label}" is ready for your review. All required outputs are captured.`,
    metadata: { phaseKey, workspaceId },
  }).catch(() => {})
```

Replace with:

```typescript
  // Insert into both activity_log (firehose) and notifications (actionable).
  const { activityLog, notifications } = await import("@/lib/db/schema")
  await db.insert(activityLog).values({
    agentName: "Workflow Engine",
    action: "phase_gate_ready",
    description: `Phase "${phase.label}" is ready for your review. All required outputs are captured.`,
    metadata: { phaseKey, workspaceId },
  }).catch(() => {})

  await db.insert(notifications).values({
    workspaceId,
    type: "phase_gate_ready",
    title: `Phase ready: ${phase.label}`,
    description: `All required outputs for "${phase.label}" are captured. Review and approve to advance.`,
    actionUrl: "/dashboard",
    metadata: { phaseKey },
  }).catch(() => {})
```

### Step 2.5 — Update `NotificationBell` to also fetch from notifications table

The existing `NotificationBell` component (`src/components/notification-bell.tsx`) pulls from `/api/activity`. We'll augment it to also pull from `/api/notifications` and merge the two, giving priority to actionable notifications.

**File:** `src/components/notification-bell.tsx`

Find the `ActivityEntry` interface (line 10-18):

```typescript
interface ActivityEntry {
  id: string
  agentId: string | null
  agentName: string
  action: string
  description: string
  metadata: Record<string, unknown>
  createdAt: string
}
```

Replace with:

```typescript
interface ActivityEntry {
  id: string
  agentId: string | null
  agentName: string
  action: string
  description: string
  metadata: Record<string, unknown>
  createdAt: string
}

interface NotificationEntry {
  id: string
  type: string
  title: string
  description: string | null
  actionUrl: string | null
  read: boolean
  createdAt: string
}
```

Find the `fetchActivity` callback (lines 98-107):

```typescript
  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/activity")
      if (!res.ok) return
      const data: ActivityEntry[] = await res.json()
      setEntries(data.slice(0, 20))
    } catch {
      /* silent */
    }
  }, [])
```

Replace with:

```typescript
  const [actionableNotifs, setActionableNotifs] = useState<NotificationEntry[]>([])

  const fetchActivity = useCallback(async () => {
    try {
      const [actRes, notifRes] = await Promise.all([
        fetch("/api/activity"),
        fetch("/api/notifications?unread=true"),
      ])
      if (actRes.ok) {
        const data: ActivityEntry[] = await actRes.json()
        setEntries(data.slice(0, 20))
      }
      if (notifRes.ok) {
        const data: NotificationEntry[] = await notifRes.json()
        setActionableNotifs(data)
      }
    } catch {
      /* silent */
    }
  }, [])
```

Find the unread count derivation (lines 138-141):

```typescript
  const unreadCount = entries.filter(
    (e) => new Date(e.createdAt).getTime() > readAt
  ).length
```

Replace with:

```typescript
  const activityUnread = entries.filter(
    (e) => new Date(e.createdAt).getTime() > readAt
  ).length
  const unreadCount = activityUnread + actionableNotifs.filter((n) => !n.read).length
```

Find `handleMarkAllRead` (lines 143-147):

```typescript
  function handleMarkAllRead() {
    const ts = Date.now()
    setReadAt(ts)
    setReadAtState(ts)
  }
```

Replace with:

```typescript
  function handleMarkAllRead() {
    const ts = Date.now()
    setReadAt(ts)
    setReadAtState(ts)
    // Also mark server-side notifications as read
    if (actionableNotifs.length > 0) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      }).catch(() => {})
      setActionableNotifs([])
    }
  }
```

Find `handleNotificationClick` (lines 149-153):

```typescript
  function handleNotificationClick(entry: ActivityEntry) {
    const cat = categorize(entry.action)
    setOpen(false)
    router.push(categoryNav[cat])
  }
```

Replace with:

```typescript
  function handleNotificationClick(entry: ActivityEntry) {
    const cat = categorize(entry.action)
    setOpen(false)
    router.push(categoryNav[cat])
  }

  function handleActionableClick(notif: NotificationEntry) {
    // Mark as read
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [notif.id] }),
    }).catch(() => {})
    setActionableNotifs((prev) => prev.filter((n) => n.id !== notif.id))
    setOpen(false)
    router.push(notif.actionUrl ?? "/dashboard")
  }
```

Find the items rendering section. Locate the `{entries.map((entry) => {` block (around line 198). Add actionable notifications BEFORE the activity entries. Find:

```typescript
          {entries.length === 0 ? (
```

Replace with:

```typescript
          {actionableNotifs.length === 0 && entries.length === 0 ? (
```

Find the `<div>` that contains the entries map (the else branch). Replace:

```typescript
            <div>
              {entries.map((entry) => {
```

With:

```typescript
            <div>
              {/* Actionable notifications — phase gates, failures, etc. */}
              {actionableNotifs.map((notif) => (
                <button
                  key={`notif-${notif.id}`}
                  onClick={() => handleActionableClick(notif)}
                  className="flex items-start gap-2.5 px-3 py-2 hover:bg-accent transition-colors w-full text-left border-l-2 border-l-amber-500"
                >
                  <div className="shrink-0 mt-0.5 h-6 w-6 rounded-sm bg-amber-500/15 flex items-center justify-center text-[10px]">
                    {notif.type === "phase_gate_ready" ? "🚀" : notif.type === "agent_task_failed" ? "⚠️" : "📢"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] leading-tight font-medium text-foreground">
                      {notif.title}
                    </span>
                    {notif.description && (
                      <p className="text-[13px] leading-snug mt-0.5 text-foreground/80 line-clamp-2">
                        {notif.description}
                      </p>
                    )}
                    <span className="text-[11px] text-muted-foreground/60 mt-0.5 block">
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>
                </button>
              ))}
              {/* Activity log entries */}
              {entries.map((entry) => {
```

### Step 2.6 — Commit

```bash
git add src/lib/db/schema.ts src/app/api/notifications/route.ts src/components/notification-bell.tsx src/lib/workflow-engine.ts
git commit -m "feat: notifications table and phase gate notifications in bell

Adds a dedicated notifications table for actionable alerts (phase gates,
task failures). NotificationBell now fetches from both /api/activity and
/api/notifications, showing actionable items at the top with amber
highlight. Phase gate_ready transitions create a notification.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Agent Task Retry & Error Recovery

### Step 3.1 — Add `retryCount` and `maxRetries` columns to `agentTasks`

**File:** `src/lib/db/schema.ts`

Find the `agentTasks` table definition. Locate the `error` column (line 543):

```typescript
  error: text("error"),
```

Add after it:

```typescript
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
```

### Step 3.2 — Generate and run migration

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

**Expected:** Migration adds `retry_count` (default 0) and `max_retries` (default 3) to `agent_tasks`.

### Step 3.3 — Write failing test for retry logic

**File:** `src/__tests__/agent-task-retry.test.ts`

```typescript
import { describe, it, expect } from "vitest"

// Pure logic: given a task's current state, should it be retried?
// We extract the logic into a testable function.
interface TaskRetryInput {
  status: string
  updatedAt: Date
  retryCount: number
  maxRetries: number
}

interface TaskRetryResult {
  action: "retry" | "fail" | "skip"
  reason?: string
}

function evaluateTaskRetry(task: TaskRetryInput, now: Date): TaskRetryResult {
  // Only look at "running" tasks
  if (task.status !== "running") return { action: "skip" }

  // Check if stuck: updatedAt older than 2 minutes
  const stuckThresholdMs = 2 * 60 * 1000
  const elapsed = now.getTime() - task.updatedAt.getTime()
  if (elapsed < stuckThresholdMs) return { action: "skip", reason: "not stuck yet" }

  // Stuck. Check retry budget.
  if (task.retryCount >= task.maxRetries) {
    return { action: "fail", reason: "Max retries exceeded" }
  }

  return { action: "retry" }
}

describe("evaluateTaskRetry", () => {
  const now = new Date("2026-04-11T12:00:00Z")

  it("skips non-running tasks", () => {
    const result = evaluateTaskRetry({
      status: "completed",
      updatedAt: new Date("2026-04-11T11:50:00Z"),
      retryCount: 0,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("skip")
  })

  it("skips running tasks that are not stuck yet (< 2 min)", () => {
    const result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:59:00Z"), // 1 min ago
      retryCount: 0,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("skip")
    expect(result.reason).toBe("not stuck yet")
  })

  it("retries a stuck task with retry budget remaining", () => {
    const result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:55:00Z"), // 5 min ago
      retryCount: 1,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("retry")
  })

  it("fails a stuck task that has exhausted retries", () => {
    const result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:55:00Z"), // 5 min ago
      retryCount: 3,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("fail")
    expect(result.reason).toBe("Max retries exceeded")
  })

  it("retries at the boundary (retryCount = maxRetries - 1)", () => {
    const result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:55:00Z"),
      retryCount: 2,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("retry")
  })
})

// Re-export for use in cron route
export { evaluateTaskRetry }
export type { TaskRetryInput, TaskRetryResult }
```

**Run to verify pass** (these are pure-logic tests with no mocks needed):

```bash
npx vitest run src/__tests__/agent-task-retry.test.ts
```

**Expected:** All 5 tests pass immediately (pure function).

### Step 3.4 — Extract `evaluateTaskRetry` into a shared module

**File:** `src/lib/agents/task-retry.ts`

```typescript
// Pure retry evaluation logic for agent tasks.
// Extracted so it can be tested independently and used by the cron route.

export interface TaskRetryInput {
  status: string
  updatedAt: Date
  retryCount: number
  maxRetries: number
}

export interface TaskRetryResult {
  action: "retry" | "fail" | "skip"
  reason?: string
}

const STUCK_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Evaluate whether a task should be retried, failed, or skipped.
 * Pure function — no DB access. Used by the cron route and tests.
 */
export function evaluateTaskRetry(task: TaskRetryInput, now: Date): TaskRetryResult {
  if (task.status !== "running") return { action: "skip" }

  const elapsed = now.getTime() - task.updatedAt.getTime()
  if (elapsed < STUCK_THRESHOLD_MS) return { action: "skip", reason: "not stuck yet" }

  if (task.retryCount >= task.maxRetries) {
    return { action: "fail", reason: "Max retries exceeded" }
  }

  return { action: "retry" }
}
```

Update the test to import from the shared module:

**File:** `src/__tests__/agent-task-retry.test.ts`

Replace the first lines up to the `function evaluateTaskRetry` definition. Replace the entire file with:

```typescript
import { describe, it, expect } from "vitest"
import { evaluateTaskRetry } from "@/lib/agents/task-retry"

describe("evaluateTaskRetry", () => {
  const now = new Date("2026-04-11T12:00:00Z")

  it("skips non-running tasks", () => {
    const result = evaluateTaskRetry({
      status: "completed",
      updatedAt: new Date("2026-04-11T11:50:00Z"),
      retryCount: 0,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("skip")
  })

  it("skips running tasks that are not stuck yet (< 2 min)", () => {
    const result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:59:00Z"), // 1 min ago
      retryCount: 0,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("skip")
    expect(result.reason).toBe("not stuck yet")
  })

  it("retries a stuck task with retry budget remaining", () => {
    const result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:55:00Z"), // 5 min ago
      retryCount: 1,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("retry")
  })

  it("fails a stuck task that has exhausted retries", () => {
    const result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:55:00Z"), // 5 min ago
      retryCount: 3,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("fail")
    expect(result.reason).toBe("Max retries exceeded")
  })

  it("retries at the boundary (retryCount = maxRetries - 1)", () => {
    const result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:55:00Z"),
      retryCount: 2,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("retry")
  })
})
```

### Step 3.5 — Update cron `/api/cron/agent-work` to detect and handle stuck tasks

**File:** `src/app/api/cron/agent-work/route.ts`

Add this import at the top of the file, after existing imports:

```typescript
import { agentTasks as agentTasksTable, activityLog as activityLogTable, notifications as notificationsTable } from "@/lib/db/schema"
import { evaluateTaskRetry } from "@/lib/agents/task-retry"
import { sql } from "drizzle-orm"
import { runAgentTask } from "@/lib/agents/autonomous"
```

Note: `runAgentTask` is not currently imported in this file. The `agents/autonomous` import needs to be added, and `desc` and `eq` are already imported.

Find the very beginning of the `GET` handler, right after the cron verification:

```typescript
export async function GET(req: Request) {
  if (!verifyCron(req)) return Response.json({ error: "Unauthorized" }, { status: 401 })
```

Add after the cron check, before `const allAgents`:

```typescript
  // ── Phase 2: Stuck task recovery ─���───────────────────────────
  // Before doing regular agent-work, check for stuck/failed tasks.
  const recoveryResults: { taskId: string; action: string; error?: string }[] = []
  try {
    const stuckCandidates = await db.select().from(agentTasksTable)
      .where(eq(agentTasksTable.status, "running"))
      .limit(20)

    const now = new Date()
    for (const task of stuckCandidates) {
      const evaluation = evaluateTaskRetry({
        status: task.status,
        updatedAt: task.updatedAt,
        retryCount: task.retryCount ?? 0,
        maxRetries: task.maxRetries ?? 3,
      }, now)

      if (evaluation.action === "retry") {
        // Re-queue the task
        await db.update(agentTasksTable).set({
          status: "queued",
          retryCount: (task.retryCount ?? 0) + 1,
          error: null,
          updatedAt: now,
        }).where(eq(agentTasksTable.id, task.id))

        // Actually re-run it
        runAgentTask({
          agentId: task.agentId,
          channelId: task.channelId ?? "",
          workspaceId: task.workspaceId ?? "",
          prompt: task.prompt,
          context: (task.context ?? {}) as Record<string, unknown>,
        }).catch(() => {})

        recoveryResults.push({ taskId: task.id, action: "retried" })
      } else if (evaluation.action === "fail") {
        // Mark permanently failed
        await db.update(agentTasksTable).set({
          status: "failed",
          error: evaluation.reason ?? "Max retries exceeded",
          updatedAt: now,
        }).where(eq(agentTasksTable.id, task.id))

        // Create notification for the user
        await db.insert(notificationsTable).values({
          workspaceId: task.workspaceId,
          type: "agent_task_failed",
          title: "Agent task failed",
          description: `Task failed after ${task.maxRetries ?? 3} retries: "${task.prompt.slice(0, 80)}..."`,
          actionUrl: "/dashboard",
          metadata: { taskId: task.id, agentId: task.agentId },
        }).catch(() => {})

        // Also log to activity
        await db.insert(activityLogTable).values({
          agentId: task.agentId,
          agentName: "System",
          action: "agent_error",
          description: `Agent task failed permanently: "${task.prompt.slice(0, 60)}..."`,
          metadata: { taskId: task.id },
        }).catch(() => {})

        recoveryResults.push({ taskId: task.id, action: "failed", error: evaluation.reason })
      }
    }
  } catch (e) {
    recoveryResults.push({ taskId: "system", action: "error", error: String(e) })
  }

  // ── Regular agent work (existing logic below) ────────────────
```

At the end of the function, update the return to include recovery results. Find:

```typescript
  return Response.json({ ok: true, channel: channel.name, agentCount: posting.length, results })
```

Replace with:

```typescript
  return Response.json({ ok: true, channel: channel.name, agentCount: posting.length, results, recoveryResults })
```

### Step 3.6 — Commit

```bash
git add src/lib/db/schema.ts src/lib/agents/task-retry.ts src/__tests__/agent-task-retry.test.ts src/app/api/cron/agent-work/route.ts
git commit -m "feat: agent task retry and error recovery via cron

Adds retryCount and maxRetries columns to agentTasks. The agent-work cron
now detects stuck tasks (running > 2 min), re-queues them with incremented
retryCount, and permanently fails tasks that exceed maxRetries. Failed
tasks create a user notification.

Pure retry logic extracted to src/lib/agents/task-retry.ts with tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Agent Task Error Surfacing

### Step 4.1 — Create `AgentIssues` component

**File:** `src/components/agent-issues.tsx`

```typescript
"use client"

import { useState, useEffect, useCallback } from "react"
import { AlertCircle, RotateCw, ChevronDown, ChevronUp } from "lucide-react"
import { PixelAvatar } from "@/components/pixel-avatar"
import { cn } from "@/lib/utils"

interface FailedTask {
  id: string
  agentId: string
  agentName?: string
  prompt: string
  error: string | null
  retryCount: number
  maxRetries: number
  createdAt: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function AgentIssues({ workspaceId }: { workspaceId: string }) {
  const [tasks, setTasks] = useState<FailedTask[]>([])
  const [expanded, setExpanded] = useState(true)
  const [retrying, setRetrying] = useState<string | null>(null)

  const fetchFailedTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent-tasks?workspaceId=${workspaceId}&status=failed`)
      if (!res.ok) return
      const data = await res.json()
      // Filter to last 7 days
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const recent = (data.tasks ?? []).filter(
        (t: FailedTask) => new Date(t.createdAt).getTime() > weekAgo
      )
      setTasks(recent.slice(0, 10))
    } catch {
      /* silent */
    }
  }, [workspaceId])

  useEffect(() => {
    fetchFailedTasks()
    const interval = setInterval(fetchFailedTasks, 60000)
    return () => clearInterval(interval)
  }, [fetchFailedTasks])

  async function handleRetry(taskId: string) {
    setRetrying(taskId)
    try {
      const res = await fetch("/api/agent-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      })
      if (res.ok) {
        // Remove from list optimistically
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
      }
    } catch {
      /* silent */
    } finally {
      setRetrying(null)
    }
  }

  if (tasks.length === 0) return null

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-[13px] font-medium text-foreground">
            Agent Issues ({tasks.length})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-red-500/10 divide-y divide-red-500/10">
          {tasks.map((task) => (
            <div key={task.id} className="px-4 py-2.5 flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <div className="h-6 w-6 rounded-sm bg-red-500/15 flex items-center justify-center text-[10px] text-red-500">
                  !!
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground leading-tight line-clamp-1">
                  {task.prompt.slice(0, 100)}{task.prompt.length > 100 ? "..." : ""}
                </p>
                <p className="text-[11px] text-red-400 mt-0.5 line-clamp-1">
                  {task.error ?? "Unknown error"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {timeAgo(task.createdAt)} · {task.retryCount}/{task.maxRetries} retries
                </p>
              </div>
              <button
                onClick={() => handleRetry(task.id)}
                disabled={retrying === task.id}
                className={cn(
                  "shrink-0 h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors",
                  retrying === task.id
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-accent hover:bg-accent/80 text-foreground"
                )}
              >
                <RotateCw className={cn("h-3 w-3", retrying === task.id && "animate-spin")} />
                Retry
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Step 4.2 — Wire into dashboard page

**File:** `src/app/(app)/dashboard/page.tsx`

Add the import at the top, after the other component imports:

```typescript
import { AgentIssues } from "@/components/agent-issues"
```

Find the `<WorkflowPhaseWidget />` line (around line 78):

```typescript
        <WorkflowPhaseWidget />
```

Add after it:

```typescript
        {activeWs && <AgentIssues workspaceId={activeWs.id} />}
```

### Step 4.3 — Commit

```bash
git add src/components/agent-issues.tsx src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: agent issues dashboard section with retry button

Adds AgentIssues component that shows failed agent tasks from the last
7 days. Each entry shows the task prompt, error message, retry count,
and a Retry button. Wired into the dashboard below WorkflowPhaseWidget.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Chat Persistence — Save Conversations

### Step 5.1 — Save user messages to the messages table

Currently, only agent responses are saved in `onFinish`. User messages need to be saved too, and both need a consistent `threadId` to link the conversation.

**File:** `src/app/api/chat/route.ts`

Find the beginning of the POST handler where it parses the request body (line 24):

```typescript
  const { messages, agentId, channelId }: { messages: UIMessage[]; agentId: string; channelId?: string } =
    await req.json()
```

Replace with:

```typescript
  const { messages, agentId, channelId, threadId }: { messages: UIMessage[]; agentId: string; channelId?: string; threadId?: string } =
    await req.json()
```

Now, after the request is parsed and before the system prompt is built, save the user's latest message to the DB. Find:

```typescript
  let systemPrompt = "You are a helpful AI team member. Be concise and casual like on Slack."
```

Add BEFORE it:

```typescript
  // ── Chat Persistence: save user message ─────────────────────
  // Save the latest user message to the messages table so conversation
  // history persists across page reloads. We save it before streaming
  // so it's always in the DB even if the agent response fails.
  if (channelId) {
    const lastUserMsg = messages[messages.length - 1]
    if (lastUserMsg?.role === "user") {
      const textPart = lastUserMsg.parts?.find((p: any) => p.type === "text") as any
      const userText = textPart?.text || ""
      if (userText.trim()) {
        try {
          await db.insert(messages_table).values({
            channelId,
            threadId: threadId ?? null,
            senderUserId: "user", // will be replaced with actual userId from auth in Phase 1
            senderName: "You",
            senderAvatar: "👤",
            content: userText,
            messageType: "text",
          })
        } catch {
          // Best-effort. Chat still works if save fails.
        }
      }
    }
  }

```

### Step 5.2 — Include `threadId` in agent response saves

Find the `onFinish` callback (around line 412):

```typescript
    async onFinish({ text }) {
      // Save agent response to the channel so DB fetches pick it up
      if (agent && text && channelId) {
        try {
          await db.insert(messages_table).values({
            channelId,
            senderAgentId: agent.id,
            senderName: agent.name,
            senderAvatar: agent.avatar,
            content: text,
            messageType: "text",
          })
        } catch {}
      }
```

Replace with:

```typescript
    async onFinish({ text }) {
      // Save agent response to the channel so DB fetches pick it up
      if (agent && text && channelId) {
        try {
          await db.insert(messages_table).values({
            channelId,
            threadId: threadId ?? null,
            senderAgentId: agent.id,
            senderName: agent.name,
            senderAvatar: agent.avatar,
            content: text,
            messageType: "text",
          })
        } catch {}
      }
```

### Step 5.3 — Pass `channelId` and `threadId` from the DM chat UI

**File:** `src/app/(app)/page.tsx`

The `DMChat` component needs to:
1. Get or create a channel for DM conversations with this agent
2. Generate a stable `threadId` for the conversation session
3. Pass both to the chat API

Find the DMChat function definition (around line 522):

```typescript
function DMChat({ agent }: { agent: DBAgent }) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", body: { agentId: agent.id } }), [agent.id])
  const { messages, sendMessage, status } = useChat({ transport })
```

Replace with:

```typescript
function DMChat({ agent, channelId }: { agent: DBAgent; channelId?: string }) {
  // Generate a stable threadId per agent DM session. Persists across re-renders
  // but resets when the component unmounts (new DM session).
  const threadId = useMemo(() => crypto.randomUUID(), [agent.id])
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: { agentId: agent.id, channelId: channelId ?? null, threadId },
  }), [agent.id, channelId, threadId])
  const { messages, sendMessage, status } = useChat({ transport })
```

Now find where `DMChat` is rendered. Search for `<DMChat agent=` in the page component. It will look something like:

```typescript
<DMChat agent={dmAgent} />
```

We need to pass the `channelId`. The channel for a DM is typically the agent's DM channel. We need to find or create it. For now, we can derive it from `dbChannels` — DM channels have `type: "agent"`. Find the rendering of DMChat and replace:

```typescript
                    <DMChat agent={dmAgent} />
```

With:

```typescript
                    <DMChat agent={dmAgent} channelId={dbChannels.find((c) => c.type === "agent" && c.name === dmAgent.name.toLowerCase().replace(/\s+/g, "-"))?.id} />
```

If the DM channel lookup is more complex in the actual code, the key principle is: find the channel whose name matches the agent's name slug and whose type is "agent" (or "direct"), and pass its `id`.

### Step 5.4 — Commit

```bash
git add src/app/api/chat/route.ts src/app/\(app\)/page.tsx
git commit -m "feat: persist user messages to messages table with threadId

User messages are now saved to the messages table before streaming the
agent response. Both user and agent messages carry a consistent threadId
per DM session. The DMChat component generates a stable threadId per
agent and passes channelId to the API for DB persistence.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Chat Persistence — Load History

### Step 6.1 — Create API endpoint for chat history

The existing `/api/messages` endpoint already returns all messages for a channel. We need to support a `threadId` filter and return messages in chronological order.

**File:** `src/app/api/messages/route.ts`

Find the GET handler:

```typescript
export async function GET(req: Request) {
  const url = new URL(req.url)
  const channelId = url.searchParams.get("channelId")
  const includeThreads = url.searchParams.get("includeThreads") === "true"

  if (!channelId) {
    return Response.json({ error: "channelId required" }, { status: 400 })
  }

  // Fetch all messages for the channel (including thread replies for counting)
  const allMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.channelId, channelId))
    .orderBy(messages.createdAt)

  if (includeThreads) {
    return Response.json(allMessages)
  }

  // Default: return all messages (top-level + thread replies) so client can compute thread counts
  return Response.json(allMessages)
}
```

Replace the entire GET handler with:

```typescript
export async function GET(req: Request) {
  const url = new URL(req.url)
  const channelId = url.searchParams.get("channelId")
  const threadId = url.searchParams.get("threadId")
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200)
  const includeThreads = url.searchParams.get("includeThreads") === "true"

  if (!channelId) {
    return Response.json({ error: "channelId required" }, { status: 400 })
  }

  const conditions = [eq(messages.channelId, channelId)]
  if (threadId) {
    conditions.push(eq(messages.threadId, threadId))
  }

  const allMessages = await db
    .select()
    .from(messages)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .orderBy(messages.createdAt)
    .limit(limit)

  return Response.json(allMessages)
}
```

Add `and` to the imports at the top of the file. Find:

```typescript
import { eq, desc, and, isNull } from "drizzle-orm"
```

This already imports `and`. Good. No change needed.

### Step 6.2 — Load history in DMChat component

**File:** `src/app/(app)/page.tsx`

The `useChat` hook from `@ai-sdk/react` accepts an `initialMessages` option. We need to fetch DB messages on mount and convert them to the `UIMessage` format.

Find the DMChat function (updated in Task 5):

```typescript
function DMChat({ agent, channelId }: { agent: DBAgent; channelId?: string }) {
  // Generate a stable threadId per agent DM session. Persists across re-renders
  // but resets when the component unmounts (new DM session).
  const threadId = useMemo(() => crypto.randomUUID(), [agent.id])
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: { agentId: agent.id, channelId: channelId ?? null, threadId },
  }), [agent.id, channelId, threadId])
  const { messages, sendMessage, status } = useChat({ transport })
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
```

Replace with:

```typescript
function DMChat({ agent, channelId }: { agent: DBAgent; channelId?: string }) {
  const [historyMessages, setHistoryMessages] = useState<UIMessage[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // Load chat history from DB on mount
  useEffect(() => {
    if (!channelId) { setHistoryLoaded(true); return }
    async function loadHistory() {
      try {
        const res = await fetch(`/api/messages?channelId=${channelId}&limit=50`)
        if (!res.ok) { setHistoryLoaded(true); return }
        const dbMessages: DBMessage[] = await res.json()
        // Convert DB messages to UIMessage format for useChat
        const uiMessages: UIMessage[] = dbMessages.map((m) => ({
          id: m.id,
          role: m.senderAgentId ? "assistant" as const : "user" as const,
          content: m.content,
          parts: [{ type: "text" as const, text: m.content }],
          createdAt: new Date(m.createdAt),
        }))
        setHistoryMessages(uiMessages)
      } catch {
        // silent — chat works without history
      } finally {
        setHistoryLoaded(true)
      }
    }
    loadHistory()
  }, [channelId, agent.id])

  // No threadId for history loading — we load all DM messages.
  // New messages get a threadId for future filtering if needed.
  const threadId = useMemo(() => crypto.randomUUID(), [agent.id])
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: { agentId: agent.id, channelId: channelId ?? null, threadId },
  }), [agent.id, channelId, threadId])
  const { messages, sendMessage, status } = useChat({
    transport,
    initialMessages: historyLoaded ? historyMessages : [],
  })
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
```

Add `UIMessage` to the imports. Check if it's already imported from `@ai-sdk/react` or `ai`. Find the import line for `useChat`:

```typescript
import { useChat } from "@ai-sdk/react"
```

Replace with:

```typescript
import { useChat, type UIMessage } from "@ai-sdk/react"
```

**Note:** If `UIMessage` is not exported from `@ai-sdk/react` in this version, import it from `ai`:

```typescript
import { UIMessage } from "ai"
```

Check which package exports it by looking at existing imports in the chat route (`src/app/api/chat/route.ts` line 1 imports `UIMessage` from `"ai"`).

### Step 6.3 — Show loading state while history loads

In the DMChat return JSX, find the empty state (where it shows "Chat with {agent.name}"):

```typescript
        {messages.length === 0 && (
```

Replace with:

```typescript
        {!historyLoaded && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-xs">Loading conversation...</span>
          </div>
        )}
        {historyLoaded && messages.length === 0 && (
```

### Step 6.4 — Commit

```bash
git add src/app/api/messages/route.ts src/app/\(app\)/page.tsx
git commit -m "feat: load chat history from DB on DM open

DMChat now fetches the last 50 messages from the messages table on mount
and passes them as initialMessages to the useChat hook. Messages API
gains threadId filter and configurable limit. Shows a loading spinner
while history loads.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Agent-to-Agent Consultation (`consult_agent` tool)

### Step 7.1 — Write failing test

**File:** `src/__tests__/consult-agent.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// Test the consultation logic in isolation.
// We verify: agent lookup, system prompt building, depth limiting.

// Mock the DB
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
      }),
    }),
  },
}))

// Mock generateText
vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "Consultation response" }),
  tool: vi.fn((spec) => spec),
  jsonSchema: vi.fn((s) => s),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue("mock-model"),
}))

import { buildConsultationTool, MAX_CONSULTATION_DEPTH } from "@/lib/agents/consultation"

describe("consult_agent tool", () => {
  it("exports MAX_CONSULTATION_DEPTH as 1", () => {
    expect(MAX_CONSULTATION_DEPTH).toBe(1)
  })

  it("builds a tool with correct schema", () => {
    const tool = buildConsultationTool("agent-1", "ws-1", 0)
    expect(tool).toBeDefined()
    expect(tool.inputSchema).toBeDefined()
    expect(tool.inputSchema.properties.agentName).toBeDefined()
    expect(tool.inputSchema.properties.question).toBeDefined()
  })

  it("returns null when depth exceeds max", () => {
    const tool = buildConsultationTool("agent-1", "ws-1", MAX_CONSULTATION_DEPTH)
    expect(tool).toBeNull()
  })
})
```

**Run to verify fail:**

```bash
npx vitest run src/__tests__/consult-agent.test.ts
```

**Expected:** Fails because `@/lib/agents/consultation` doesn't exist.

### Step 7.2 — Implement consultation module

**File:** `src/lib/agents/consultation.ts`

```typescript
// Agent-to-agent consultation tool.
// Allows one agent to ask another agent a question and get back a response.
// Depth-limited to prevent infinite recursion (max 1 level deep).
//
// Example: Marketing Lead asks Finance Lead "What pricing model works
// best for this market segment?" — Finance Lead responds with analysis.

import { generateText, tool, jsonSchema } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/lib/db"
import { agents, agentSops, agentMemories, companyMemories } from "@/lib/db/schema"
import { eq, desc, ilike } from "drizzle-orm"
import { traitsToPromptStyle } from "@/lib/personality-presets"
import type { PersonalityTraits } from "@/lib/personality-presets"

export const MAX_CONSULTATION_DEPTH = 1

/**
 * Build a consult_agent tool for an agent. Returns null if the current
 * consultation depth has reached the maximum (prevents infinite recursion).
 *
 * @param agentId - The ID of the agent that will USE this tool (the asker)
 * @param workspaceId - Current workspace
 * @param currentDepth - How deep we are in the consultation chain (0 = top-level chat)
 */
export function buildConsultationTool(
  agentId: string,
  workspaceId: string,
  currentDepth: number,
): ReturnType<typeof tool> | null {
  if (currentDepth >= MAX_CONSULTATION_DEPTH) return null

  return tool({
    description:
      "Consult another agent on your team by asking them a question. Use this when you need expertise outside your domain — e.g., ask the Finance Lead about pricing, ask the Marketing Lead about positioning, ask the Analyst about market data. The other agent will respond with their analysis. You can then use their input in your work. One-shot: no back-and-forth conversation, just a single question and answer.",
    inputSchema: jsonSchema<{ agentName: string; question: string }>({
      type: "object",
      properties: {
        agentName: {
          type: "string",
          description: "The name of the agent to consult (e.g., 'Priya', 'Nova', 'Marcus'). Case-insensitive partial match.",
        },
        question: {
          type: "string",
          description: "The specific question to ask. Be detailed — include context so the other agent can give a useful answer.",
          minLength: 10,
          maxLength: 2000,
        },
      },
      required: ["agentName", "question"],
      additionalProperties: false,
    }),
    execute: async ({ agentName, question }) => {
      try {
        // Find the target agent by name (case-insensitive partial match)
        const [targetAgent] = await db
          .select()
          .from(agents)
          .where(ilike(agents.name, `%${agentName}%`))
          .limit(1)

        if (!targetAgent) {
          return {
            ok: false,
            error: `Agent "${agentName}" not found. Available agents can be found in the team channels.`,
          }
        }

        // Don't consult yourself
        if (targetAgent.id === agentId) {
          return { ok: false, error: "You can't consult yourself. Pick a different agent." }
        }

        // Build the target agent's system prompt (same as autonomous.ts pattern)
        const sops = await db.select().from(agentSops)
          .where(eq(agentSops.agentId, targetAgent.id))
          .orderBy(agentSops.sortOrder)

        const memories = await db.select().from(agentMemories)
          .where(eq(agentMemories.agentId, targetAgent.id))
          .orderBy(desc(agentMemories.importance))
          .limit(10)

        const sharedMemories = await db.select().from(companyMemories)
          .orderBy(desc(companyMemories.importance))
          .limit(8)

        const personalityStyle = traitsToPromptStyle(
          targetAgent.personality as PersonalityTraits,
          targetAgent.personalityPresetId ?? undefined,
          (targetAgent.personalityConfig as any) ?? null,
        )

        let systemPrompt = `You are ${targetAgent.name}, ${targetAgent.role}.${targetAgent.systemPrompt ? " " + targetAgent.systemPrompt : ""}
Your skills: ${(targetAgent.skills as string[]).join(", ")}
${personalityStyle}

CONTEXT: Another agent on your team is consulting you. Answer their question with your domain expertise. Be specific, direct, and actionable. This is an internal consultation, not a user-facing conversation.`

        if (sops.length > 0) {
          systemPrompt += `\n\nYour SOPs:\n${sops.map((s) => `### ${s.title}\n${s.content}`).join("\n\n")}`
        }
        if (memories.length > 0) {
          systemPrompt += `\n\nYour memories:\n${memories.map((m) => `- [${m.memoryType}] ${m.content}`).join("\n")}`
        }
        if (sharedMemories.length > 0) {
          systemPrompt += `\n\nCompany knowledge:\n${sharedMemories.map((m) => `- [${m.category}] ${m.title}: ${m.content}`).join("\n")}`
        }

        // Get the asking agent's name for context
        const [askingAgent] = await db
          .select({ name: agents.name, role: agents.role })
          .from(agents)
          .where(eq(agents.id, agentId))
          .limit(1)

        const prompt = `${askingAgent?.name ?? "A teammate"} (${askingAgent?.role ?? "unknown role"}) is asking you:\n\n${question}`

        const result = await generateText({
          model: anthropic("claude-haiku-4-5"),
          system: systemPrompt,
          prompt,
          maxOutputTokens: 1000,
          // No tools — consultations are text-only, no side effects
        })

        return {
          ok: true,
          consultedAgent: targetAgent.name,
          consultedRole: targetAgent.role,
          response: result.text,
        }
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Consultation failed",
        }
      }
    },
  })
}
```

### Step 7.3 — Wire consultation tool into both autonomous and chat contexts

**File:** `src/lib/agents/autonomous.ts`

Add the import at the top:

```typescript
import { buildConsultationTool } from "@/lib/agents/consultation"
```

Find the `buildAutonomousTools` function (line 152). At the end of the returned object (just before the closing `}` of the return, after `set_department_goal`), we need to conditionally add the consultation tool.

Actually, the cleaner approach is to add it to the tools object after it's built. Find the `buildAutonomousTools` function return statement and the closing of the function. Then find `buildAutonomousToolsForChat`:

```typescript
/**
 * Public version of the autonomous tools for use in the CHAT route.
 * Same tools as the background runner, so agents can produce documents,
 * post wins, and hand off mid-conversation with the user.
 */
export function buildAutonomousToolsForChat(agentId: string, workspaceId: string) {
  return buildAutonomousTools(agentId, workspaceId)
}
```

Replace with:

```typescript
/**
 * Public version of the autonomous tools for use in the CHAT route.
 * Same tools as the background runner, so agents can produce documents,
 * post wins, and hand off mid-conversation with the user.
 * Includes consult_agent at depth 0 (allows one level of consultation).
 */
export function buildAutonomousToolsForChat(agentId: string, workspaceId: string) {
  const tools = buildAutonomousTools(agentId, workspaceId)
  const consultTool = buildConsultationTool(agentId, workspaceId, 0)
  if (consultTool) {
    return { ...tools, consult_agent: consultTool }
  }
  return tools
}
```

Also add the consultation tool to `runAgentTask`. Find where `allTools` is assembled inside `runAgentTask` (around line 676):

```typescript
    const allTools = { ...autonomousTools, ...integrationTools, ...webTools }
```

Replace with:

```typescript
    const consultTool = buildConsultationTool(input.agentId, input.workspaceId, 0)
    const allTools = {
      ...autonomousTools,
      ...integrationTools,
      ...webTools,
      ...(consultTool ? { consult_agent: consultTool } : {}),
    }
```

Add the import at the top of the file (already done above).

### Step 7.4 — Run tests

```bash
npx vitest run src/__tests__/consult-agent.test.ts
```

**Expected:** All 3 tests pass.

### Step 7.5 — Commit

```bash
git add src/lib/agents/consultation.ts src/lib/agents/autonomous.ts src/__tests__/consult-agent.test.ts
git commit -m "feat: agent-to-agent consultation via consult_agent tool

Agents can now consult other agents by name with a question. The target
agent's full context (personality, SOPs, memories, company knowledge) is
loaded and a one-shot generateText call produces the response. Depth is
capped at 1 to prevent infinite recursion.

Available in both autonomous tasks and live chat contexts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Increase Agent Output Limits

### Step 8.1 — Make `maxOutputTokens` dynamic in chat route

**File:** `src/app/api/chat/route.ts`

Find the `streamText` call (around line 402):

```typescript
  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 500,
    tools: mergedTools,
```

Replace with:

```typescript
  // Phase leads doing guided phase work need more output space for
  // detailed strategies, document creation, and multi-step tool chains.
  // General chat stays at 500 to keep responses snappy.
  const isPhaseLeadChat = !!phaseCtx
  const maxTokens = isPhaseLeadChat ? 2048 : 500

  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: maxTokens,
    tools: mergedTools,
```

### Step 8.2 — Commit

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: increase maxOutputTokens to 2048 for phase lead chats

Phase leads doing guided workflow work now get 2048 output tokens instead
of 500. This gives them room for detailed strategies, document creation
via create_document, and multi-step tool chains. General chat stays at
500 for snappy responses.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Integration Tests

### Step 9.1 — Set up Vitest configuration

First, check if `vitest` is installed. If not:

```bash
npm install -D vitest @vitest/coverage-v8
```

**File:** `vitest.config.ts` (create at project root)

```typescript
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
})
```

Add test script to `package.json`:

**File:** `package.json`

Find the `"scripts"` block:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
```

Replace with:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

### Step 9.2 — Write workflow integration test

**File:** `src/__tests__/integration/workflow-full-cycle.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mock DB Layer ──────────────────────────────────────────────
// These tests verify the full workflow logic chain without hitting
// a real database. We mock Drizzle's query builder pattern.

const mockPhaseRun = {
  id: "run-1",
  workspaceId: "ws-1",
  phaseKey: "product",
  status: "active",
  outputs: {},
  gateDecision: null,
  skipContext: null,
  enteredAt: new Date(),
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

let currentOutputs: Record<string, any> = {}
let currentStatus = "active"

vi.mock("@/lib/db", () => {
  const chainable = (resolvedValue: any) => {
    const chain: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => Promise.resolve(resolvedValue)),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "new-id" }]),
    }
    return chain
  }

  return {
    db: {
      select: vi.fn().mockImplementation(() => chainable([{
        ...mockPhaseRun,
        outputs: currentOutputs,
        status: currentStatus,
      }])),
      insert: vi.fn().mockImplementation(() => chainable([{ id: "new-id" }])),
      update: vi.fn().mockImplementation(() => {
        const chain = chainable([])
        // Capture the set() call to track status changes
        chain.set = vi.fn().mockImplementation((updates: any) => {
          if (updates.status) currentStatus = updates.status
          if (updates.outputs) currentOutputs = updates.outputs
          return chain
        })
        return chain
      }),
    },
  }
})

import { checkPhaseCompletion, getPhase, PHASES } from "@/lib/workflow-engine"
import type { PhaseRunState } from "@/lib/workflow-engine"

describe("Workflow Full Cycle", () => {
  beforeEach(() => {
    currentOutputs = {}
    currentStatus = "active"
  })

  it("product phase has 4 required outputs", () => {
    const phase = getPhase("product")
    expect(phase.requiredOutputs).toHaveLength(4)
    expect(phase.requiredOutputs.map((o) => o.key)).toEqual([
      "target_customer",
      "problem_solved",
      "offer_sketch",
      "price_range",
    ])
  })

  it("checkPhaseCompletion returns false with 3 of 4 outputs", () => {
    const outputs: PhaseRunState["outputs"] = {
      target_customer: { status: "provided", value: "SMBs" },
      problem_solved: { status: "provided", value: "Manual invoicing" },
      offer_sketch: { status: "provided", value: "AI invoicing" },
      // price_range missing
    }
    expect(checkPhaseCompletion("product", outputs)).toBe(false)
  })

  it("checkPhaseCompletion returns true with all 4 outputs", () => {
    const outputs: PhaseRunState["outputs"] = {
      target_customer: { status: "provided", value: "SMBs" },
      problem_solved: { status: "provided", value: "Manual invoicing" },
      offer_sketch: { status: "provided", value: "AI invoicing" },
      price_range: { status: "confirmed", value: "$99/mo" },
    }
    expect(checkPhaseCompletion("product", outputs)).toBe(true)
  })

  it("all 7 phases are defined with correct ordering", () => {
    expect(PHASES).toHaveLength(7)
    const keys = PHASES.map((p) => p.key)
    expect(keys).toEqual([
      "product", "research", "offer", "marketing",
      "monetization", "delivery", "operations",
    ])
    // Verify chain
    for (let i = 0; i < PHASES.length - 1; i++) {
      expect(PHASES[i].nextPhase).toBe(PHASES[i + 1].key)
    }
    expect(PHASES[PHASES.length - 1].nextPhase).toBeNull()
  })

  it("research phase requires 3 artifact outputs", () => {
    const phase = getPhase("research")
    expect(phase.requiredOutputs).toHaveLength(3)
    expect(phase.requiredOutputs.every((o) => o.kind === "artifact")).toBe(true)
  })
})
```

### Step 9.3 — Write retry integration test

**File:** `src/__tests__/integration/task-retry-cycle.test.ts`

```typescript
import { describe, it, expect } from "vitest"
import { evaluateTaskRetry } from "@/lib/agents/task-retry"

describe("Task Retry Full Cycle", () => {
  const now = new Date("2026-04-11T12:00:00Z")

  it("simulates a task going through retry cycle to completion", () => {
    // Step 1: Task is running and recently updated — not stuck
    let result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:59:30Z"), // 30s ago
      retryCount: 0,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("skip")

    // Step 2: Task gets stuck (no update for 5 minutes)
    result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:55:00Z"), // 5 min ago
      retryCount: 0,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("retry")

    // Step 3: After retry, task gets stuck again (retry 1)
    result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:55:00Z"),
      retryCount: 1,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("retry")

    // Step 4: Third time stuck (retry 2)
    result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:55:00Z"),
      retryCount: 2,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("retry")

    // Step 5: Fourth time stuck — maxRetries reached, permanent failure
    result = evaluateTaskRetry({
      status: "running",
      updatedAt: new Date("2026-04-11T11:55:00Z"),
      retryCount: 3,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("fail")
    expect(result.reason).toBe("Max retries exceeded")
  })

  it("completed tasks are never retried", () => {
    const result = evaluateTaskRetry({
      status: "completed",
      updatedAt: new Date("2026-04-10T00:00:00Z"), // old
      retryCount: 0,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("skip")
  })

  it("failed tasks are never retried by the evaluator", () => {
    // Manual retry is done via the API endpoint, not the evaluator
    const result = evaluateTaskRetry({
      status: "failed",
      updatedAt: new Date("2026-04-10T00:00:00Z"),
      retryCount: 3,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("skip")
  })

  it("queued tasks are not retried", () => {
    const result = evaluateTaskRetry({
      status: "queued",
      updatedAt: new Date("2026-04-10T00:00:00Z"),
      retryCount: 0,
      maxRetries: 3,
    }, now)
    expect(result.action).toBe("skip")
  })
})
```

### Step 9.4 — Write consultation integration test

**File:** `src/__tests__/integration/consultation.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest"

// Mock DB
vi.mock("@/lib/db", () => {
  const makeAgent = (name: string, role: string) => ({
    id: `agent-${name.toLowerCase()}`,
    name,
    role,
    systemPrompt: null,
    skills: ["consulting"],
    personality: { formality: 40, humor: 30, energy: 50, warmth: 60, directness: 50, confidence: 50, verbosity: 40 },
    personalityPresetId: null,
    personalityConfig: null,
  })

  const agents = [
    makeAgent("Nova", "Chief of Staff"),
    makeAgent("Priya", "Marketing Lead"),
    makeAgent("Marcus", "Finance Lead"),
  ]

  const chainable = (data: any[]) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockImplementation((n: number) => {
        // Simple name matching for test
        return Promise.resolve(data.slice(0, n))
      }),
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    })),
  })

  return {
    db: {
      select: vi.fn().mockImplementation(() => chainable(agents)),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "mem-1" }]),
        }),
      }),
    },
  }
})

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "Based on our market analysis, I recommend tiered pricing at $49/$99/$199." }),
  tool: vi.fn((spec) => spec),
  jsonSchema: vi.fn((s) => s),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue("mock-model"),
}))

vi.mock("@/lib/personality-presets", () => ({
  traitsToPromptStyle: vi.fn().mockReturnValue("Style: Professional and direct."),
}))

import { buildConsultationTool, MAX_CONSULTATION_DEPTH } from "@/lib/agents/consultation"

describe("Agent Consultation Integration", () => {
  it("depth 0 builds a usable tool", () => {
    const tool = buildConsultationTool("agent-nova", "ws-1", 0)
    expect(tool).not.toBeNull()
    expect(tool!.description).toContain("Consult another agent")
  })

  it("depth 1 (at max) returns null — no further nesting", () => {
    const tool = buildConsultationTool("agent-nova", "ws-1", 1)
    expect(tool).toBeNull()
  })

  it("depth 2 returns null", () => {
    const tool = buildConsultationTool("agent-nova", "ws-1", 2)
    expect(tool).toBeNull()
  })

  it("MAX_CONSULTATION_DEPTH is 1", () => {
    expect(MAX_CONSULTATION_DEPTH).toBe(1)
  })
})
```

### Step 9.5 — Run all tests

```bash
npx vitest run
```

**Expected output:**

```
 ✓ src/__tests__/workflow-engine.test.ts (4 tests)
 ✓ src/__tests__/agent-task-retry.test.ts (5 tests)
 ✓ src/__tests__/consult-agent.test.ts (3 tests)
 ✓ src/__tests__/integration/workflow-full-cycle.test.ts (5 tests)
 ✓ src/__tests__/integration/task-retry-cycle.test.ts (4 tests)
 ✓ src/__tests__/integration/consultation.test.ts (4 tests)

Test Files  6 passed (6)
Tests  25 passed (25)
```

### Step 9.6 — Commit

```bash
git add vitest.config.ts package.json src/__tests__/
git commit -m "test: integration tests for workflow, retry, and consultation

Adds Vitest configuration and integration test suite:
- Workflow full cycle: phase definitions, completion detection, ordering
- Task retry cycle: stuck detection, retry budget, permanent failure
- Agent consultation: depth limiting, tool building

25 tests total, all passing with mocked DB layer.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Summary

| Task | Files Changed | What It Does |
|------|---------------|-------------|
| **1. Auto-Phase Advancement** | `workflow-engine.ts`, `schema.ts` | `checkPhaseCompletion()` + `maybeTransitionToGateReady()` auto-detect when all phase outputs are filled and transition to `gate_ready` |
| **2. Phase Gate Notification** | `schema.ts`, `notifications/route.ts`, `notification-bell.tsx`, `workflow-engine.ts` | `notifications` table, REST API, bell component shows actionable phase gate alerts |
| **3. Task Retry & Recovery** | `schema.ts`, `task-retry.ts`, `cron/agent-work/route.ts` | `retryCount`/`maxRetries` columns, cron detects stuck tasks, re-queues or permanently fails them |
| **4. Error Surfacing** | `agent-issues.tsx`, `dashboard/page.tsx` | Dashboard section showing failed tasks with retry buttons |
| **5. Chat Save** | `chat/route.ts`, `page.tsx` | User messages saved to DB before streaming, agent responses include `threadId` |
| **6. Chat Load** | `messages/route.ts`, `page.tsx` | DM loads last 50 messages from DB on mount via `initialMessages` |
| **7. consult_agent** | `consultation.ts`, `autonomous.ts` | Agent-to-agent one-shot consultation, depth-limited to 1 |
| **8. Output Limits** | `chat/route.ts` | Phase leads get 2048 tokens, general chat stays at 500 |
| **9. Integration Tests** | `vitest.config.ts`, `package.json`, `src/__tests__/` | 25 tests covering workflow, retry, and consultation logic |

### New Files Created
- `src/__tests__/workflow-engine.test.ts`
- `src/__tests__/agent-task-retry.test.ts`
- `src/__tests__/consult-agent.test.ts`
- `src/__tests__/integration/workflow-full-cycle.test.ts`
- `src/__tests__/integration/task-retry-cycle.test.ts`
- `src/__tests__/integration/consultation.test.ts`
- `src/lib/agents/task-retry.ts`
- `src/lib/agents/consultation.ts`
- `src/app/api/notifications/route.ts`
- `src/components/agent-issues.tsx`
- `vitest.config.ts`

### Modified Files
- `src/lib/workflow-engine.ts` — `PhaseStatus` type, `checkPhaseCompletion()`, `maybeTransitionToGateReady()`
- `src/lib/db/schema.ts` — `notifications` table, `retryCount`/`maxRetries` columns, status comment update
- `src/lib/agents/autonomous.ts` — `consult_agent` tool in both `buildAutonomousToolsForChat()` and `runAgentTask()`
- `src/app/api/chat/route.ts` — User message persistence, threadId support, dynamic maxOutputTokens
- `src/app/api/messages/route.ts` — threadId filter, configurable limit
- `src/app/api/cron/agent-work/route.ts` ��� Stuck task detection and retry/fail logic
- `src/app/(app)/page.tsx` — DMChat loads history, passes channelId/threadId
- `src/app/(app)/dashboard/page.tsx` — AgentIssues widget
- `src/components/notification-bell.tsx` — Actionable notifications from dedicated table
- `package.json` — test/test:watch scripts

### Database Migrations Required
1. Add `notifications` table
2. Add `retry_count` (integer, default 0) and `max_retries` (integer, default 3) to `agent_tasks`
3. `workflow_phase_runs.status` now supports `"gate_ready"` value (no migration needed — text column)

### Post-Implementation Verification
```bash
# Run all tests
npm test

# Verify build
npm run build

# Verify migrations
npx drizzle-kit push
```
