"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Zap, MessageSquare, GitBranch, Clock, Plus, Trash2,
  ChevronDown, Save, ArrowLeft, X, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────

type StepType = "trigger" | "action" | "condition" | "wait"

interface WorkflowStep {
  id: string
  type: StepType
  title: string
  subtitle: string
  config?: Record<string, string>
}

interface Workflow {
  id: string
  name: string
  steps: WorkflowStep[]
  createdAt: string
  updatedAt: string
}

interface WorkflowTemplate {
  name: string
  description: string
  steps: Omit<WorkflowStep, "id">[]
}

// ── Constants ──────────────────────────────────────────────────────

const STORAGE_KEY = "bos-workflows"

const STEP_META: Record<StepType, { icon: typeof Zap; label: string; color: string }> = {
  trigger: { icon: Zap, label: "Trigger", color: "text-amber-500/70" },
  action: { icon: MessageSquare, label: "Action", color: "text-blue-500/70" },
  condition: { icon: GitBranch, label: "Condition", color: "text-violet-500/70" },
  wait: { icon: Clock, label: "Wait", color: "text-emerald-500/70" },
}

const STEP_OPTIONS: Record<StepType, { title: string; subtitle: string }[]> = {
  trigger: [
    { title: "New task created", subtitle: "When a task is assigned to the queue" },
    { title: "Schedule", subtitle: "At a specific time or interval" },
    { title: "Message received", subtitle: "When a message arrives in a channel" },
    { title: "Approval needed", subtitle: "When an action requires approval" },
  ],
  action: [
    { title: "Send message", subtitle: "Post to a channel or DM" },
    { title: "Create task", subtitle: "Add a new task to the queue" },
    { title: "Update status", subtitle: "Change an agent or task status" },
    { title: "Notify owner", subtitle: "Send a notification to the owner" },
  ],
  condition: [
    { title: "Agent is idle", subtitle: "Check if agent has no active tasks" },
    { title: "Priority is high", subtitle: "Only continue if priority >= high" },
    { title: "Cost exceeds threshold", subtitle: "If spend > configured amount" },
    { title: "Time window", subtitle: "Only during business hours" },
  ],
  wait: [
    { title: "Wait 5 minutes", subtitle: "Pause execution briefly" },
    { title: "Wait 1 hour", subtitle: "Pause execution for an hour" },
    { title: "Wait until approved", subtitle: "Pause until manual approval" },
    { title: "Wait until next day", subtitle: "Resume the following morning" },
  ],
}

const TEMPLATES: WorkflowTemplate[] = [
  {
    name: "Morning standup",
    description: "Daily at 9 AM, each agent posts their status update",
    steps: [
      { type: "trigger", title: "Schedule", subtitle: "Daily at 9:00 AM" },
      { type: "action", title: "Send message", subtitle: "Each agent posts status to #standup" },
    ],
  },
  {
    name: "Escalation chain",
    description: "When a task is blocked for 2 hours and priority is high, notify Nova",
    steps: [
      { type: "trigger", title: "New task created", subtitle: "Task blocked for 2 hours" },
      { type: "condition", title: "Priority is high", subtitle: "Only continue if priority >= high" },
      { type: "action", title: "Notify owner", subtitle: "Alert Nova about blocked task" },
    ],
  },
  {
    name: "Cost alert",
    description: "When agent cost exceeds $50/day, pause the agent and notify owner",
    steps: [
      { type: "trigger", title: "Schedule", subtitle: "Check every 4 hours" },
      { type: "condition", title: "Cost exceeds threshold", subtitle: "If agent cost > $50/day" },
      { type: "action", title: "Update status", subtitle: "Pause the agent" },
      { type: "action", title: "Notify owner", subtitle: "Send cost alert notification" },
    ],
  },
]

// ── Helpers ─────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function loadWorkflows(): Workflow[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveWorkflows(workflows: Workflow[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows))
}

// ── Components ──────────────────────────────────────────────────────

function StepCard({
  step,
  onRemove,
}: {
  step: WorkflowStep
  onRemove: () => void
}) {
  const meta = STEP_META[step.type]
  const Icon = meta.icon

  return (
    <div className="group bg-card rounded-md p-3 flex items-start gap-3 transition-colors hover:bg-accent/30">
      <div className={cn("mt-0.5 shrink-0", meta.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
            {meta.label}
          </span>
        </div>
        <p className="text-[13px] font-medium mt-0.5 truncate">{step.title}</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{step.subtitle}</p>
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-all shrink-0"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

function AddStepButton({ onAdd }: { onAdd: (step: Omit<WorkflowStep, "id">) => void }) {
  const [open, setOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<StepType | null>(null)

  const handleSelect = (type: StepType) => {
    setSelectedType(type)
  }

  const handlePickOption = (option: { title: string; subtitle: string }) => {
    if (!selectedType) return
    onAdd({ type: selectedType, title: option.title, subtitle: option.subtitle })
    setOpen(false)
    setSelectedType(null)
  }

  const handleClose = () => {
    setOpen(false)
    setSelectedType(null)
  }

  return (
    <div className="relative flex flex-col items-center">
      {/* Connecting line segment */}
      <div className="h-3 border-l-2 border-border ml-0" />

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="h-6 w-6 rounded-full border border-dashed border-border hover:border-muted-foreground/30 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
        >
          <Plus className="h-3 w-3" />
        </button>
      ) : (
        <div className="w-full bg-card rounded-md border border-border p-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {!selectedType ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                  Add step
                </span>
                <button onClick={handleClose} className="text-muted-foreground/40 hover:text-muted-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
              {(Object.keys(STEP_META) as StepType[]).map((type) => {
                const meta = STEP_META[type]
                const Icon = meta.icon
                return (
                  <button
                    key={type}
                    onClick={() => handleSelect(type)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left hover:bg-accent/50 transition-colors"
                  >
                    <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                    <span className="text-xs font-medium">{meta.label}</span>
                    <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground/30 -rotate-90" />
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-1 pb-1">
                <button
                  onClick={() => setSelectedType(null)}
                  className="text-muted-foreground/40 hover:text-muted-foreground"
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
                <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                  {STEP_META[selectedType].label}
                </span>
                <button onClick={handleClose} className="ml-auto text-muted-foreground/40 hover:text-muted-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
              {STEP_OPTIONS[selectedType].map((option) => (
                <button
                  key={option.title}
                  onClick={() => handlePickOption(option)}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <p className="text-xs font-medium">{option.title}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">{option.subtitle}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Connecting line segment */}
      <div className="h-3 border-l-2 border-border ml-0" />
    </div>
  )
}

// ── Main Builder ────────────────────────────────────────────────────

function WorkflowCanvas({
  workflow,
  onChange,
  onSave,
  onBack,
}: {
  workflow: Workflow
  onChange: (w: Workflow) => void
  onSave: () => void
  onBack: () => void
}) {
  const [name, setName] = useState(workflow.name)

  const addStep = useCallback(
    (index: number, step: Omit<WorkflowStep, "id">) => {
      const newStep: WorkflowStep = { ...step, id: uid() }
      const steps = [...workflow.steps]
      steps.splice(index, 0, newStep)
      onChange({ ...workflow, steps, updatedAt: new Date().toISOString() })
    },
    [workflow, onChange]
  )

  const removeStep = useCallback(
    (id: string) => {
      onChange({
        ...workflow,
        steps: workflow.steps.filter((s) => s.id !== id),
        updatedAt: new Date().toISOString(),
      })
    },
    [workflow, onChange]
  )

  const handleSave = () => {
    onChange({ ...workflow, name, updatedAt: new Date().toISOString() })
    onSave()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-lg font-semibold tracking-tight bg-transparent border-none outline-none placeholder:text-muted-foreground/30 flex-1"
          placeholder="Workflow name..."
        />
        <button
          onClick={handleSave}
          className="h-7 px-2.5 rounded-md text-xs font-medium bg-primary text-primary-foreground flex items-center gap-1 hover:bg-primary/90 transition-colors"
        >
          <Save className="h-3 w-3" />
          Save
        </button>
      </div>

      {/* Canvas */}
      <div className="max-w-md mx-auto py-4">
        {workflow.steps.length === 0 ? (
          <div className="flex flex-col items-center">
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground/50">Add your first step</p>
            </div>
            <AddStepButton onAdd={(step) => addStep(0, step)} />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Add before first */}
            <AddStepButton onAdd={(step) => addStep(0, step)} />

            {workflow.steps.map((step, i) => (
              <div key={step.id} className="w-full flex flex-col items-center">
                <div className="w-full">
                  <StepCard step={step} onRemove={() => removeStep(step.id)} />
                </div>
                <AddStepButton onAdd={(s) => addStep(i + 1, s)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step count */}
      {workflow.steps.length > 0 && (
        <div className="text-center">
          <span className="text-[11px] text-muted-foreground/40">
            {workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Exported Builder ────────────────────────────────────────────────

export function WorkflowBuilder() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setWorkflows(loadWorkflows())
    setLoaded(true)
  }, [])

  const persistAndSet = useCallback((updated: Workflow[]) => {
    setWorkflows(updated)
    saveWorkflows(updated)
  }, [])

  const createNew = () => {
    const w: Workflow = {
      id: uid(),
      name: "New workflow",
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setEditing(w)
  }

  const installTemplate = (template: WorkflowTemplate) => {
    const w: Workflow = {
      id: uid(),
      name: template.name,
      steps: template.steps.map((s) => ({ ...s, id: uid() })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updated = [...workflows, w]
    persistAndSet(updated)
  }

  const handleSave = () => {
    if (!editing) return
    const exists = workflows.find((w) => w.id === editing.id)
    const updated = exists
      ? workflows.map((w) => (w.id === editing.id ? editing : w))
      : [...workflows, editing]
    persistAndSet(updated)
    setEditing(null)
  }

  const handleDelete = (id: string) => {
    persistAndSet(workflows.filter((w) => w.id !== id))
  }

  if (!loaded) {
    return <div className="py-12 text-center text-xs text-muted-foreground/40">Loading...</div>
  }

  // ── Editing view ──
  if (editing) {
    return (
      <WorkflowCanvas
        workflow={editing}
        onChange={setEditing}
        onSave={handleSave}
        onBack={() => setEditing(null)}
      />
    )
  }

  // ── List view ──
  return (
    <div className="space-y-6">
      {/* Templates */}
      <div>
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-3">
          Templates
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {TEMPLATES.map((t) => {
            const installed = workflows.some((w) => w.name === t.name)
            return (
              <button
                key={t.name}
                onClick={() => !installed && installTemplate(t)}
                disabled={installed}
                className={cn(
                  "text-left bg-card rounded-md p-3 transition-colors",
                  installed
                    ? "opacity-50 cursor-default"
                    : "hover:bg-accent/30 cursor-pointer"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-3 w-3 text-amber-500/70" />
                  <span className="text-xs font-medium">{t.name}</span>
                  {installed && <Check className="h-3 w-3 text-emerald-500/70 ml-auto" />}
                </div>
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                  {t.description}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {t.steps.map((s, i) => {
                    const Icon = STEP_META[s.type].icon
                    return (
                      <div key={i} className="flex items-center gap-1">
                        {i > 0 && (
                          <div className="w-3 h-px bg-border" />
                        )}
                        <div className={cn("h-4 w-4 rounded flex items-center justify-center bg-muted/50", STEP_META[s.type].color)}>
                          <Icon className="h-2.5 w-2.5" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Saved workflows */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
            Your workflows
          </h3>
          <button
            onClick={createNew}
            className="h-6 px-2 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-1 transition-colors"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>

        {workflows.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-xs text-muted-foreground/40">
              No workflows yet. Start from a template or create your own.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {workflows.map((w) => (
              <div
                key={w.id}
                className="group bg-card rounded-md p-3 flex items-center gap-3 transition-colors hover:bg-accent/30"
              >
                <button
                  onClick={() => setEditing(w)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium truncate">{w.name}</span>
                    <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                      {w.steps.length} step{w.steps.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    {w.steps.map((s) => {
                      const Icon = STEP_META[s.type].icon
                      return (
                        <div key={s.id} className={cn("h-4 w-4 rounded flex items-center justify-center bg-muted/50", STEP_META[s.type].color)}>
                          <Icon className="h-2.5 w-2.5" />
                        </div>
                      )
                    })}
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(w.id)}
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-all shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
