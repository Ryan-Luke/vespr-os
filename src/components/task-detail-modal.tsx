"use client"

import { useState, useEffect, useRef } from "react"
import {
  X, Loader2, Trash2, Clock, CheckCircle2, AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PixelAvatar } from "@/components/pixel-avatar"

interface DBAgent {
  id: string
  name: string
  role: string
  pixelAvatarIndex: number
  teamId: string | null
  status: string
}

interface DBTask {
  id: string
  title: string
  description: string | null
  assignedAgentId: string | null
  assignedToUser: boolean
  teamId: string | null
  status: string
  priority: string
  linkedMessageIds: string[]
  instructions: string | null
  resources: { label: string; url: string }[] | null
  blockedReason: string | null
  requirement: {
    type: "file" | "url" | "text" | "checkbox" | null
    label: string
    fulfilled?: boolean
    value?: string
    fulfilledAt?: string
  } | null
  createdAt: string
  completedAt: string | null
}

const statusOptions = [
  { id: "backlog", label: "Backlog", icon: <Clock className="h-3 w-3" />, color: "text-white", bg: "bg-[#635bff]" },
  { id: "todo", label: "To Do", icon: <AlertCircle className="h-3 w-3" />, color: "text-white", bg: "bg-[#635bff]" },
  { id: "in_progress", label: "In Progress", icon: <Loader2 className="h-3 w-3" />, color: "text-white", bg: "bg-[#635bff]" },
  { id: "review", label: "Review", icon: <CheckCircle2 className="h-3 w-3" />, color: "text-white", bg: "bg-[#635bff]" },
  { id: "done", label: "Done", icon: <CheckCircle2 className="h-3 w-3" />, color: "text-white", bg: "bg-[#635bff]" },
]

const priorityOptions = [
  { id: "urgent", label: "Urgent", dot: "bg-red-400", text: "text-red-400" },
  { id: "high", label: "High", dot: "bg-amber-400", text: "text-amber-400" },
  { id: "medium", label: "Medium", dot: "bg-[#635bff]", text: "text-[#635bff]" },
  { id: "low", label: "Low", dot: "bg-[rgba(255,255,255,0.08)]", text: "text-muted-foreground" },
]

interface TaskDetailModalProps {
  task: DBTask
  agents: DBAgent[]
  onClose: () => void
  onUpdate: (taskId: string, updates: Partial<DBTask>) => Promise<void>
}

export function TaskDetailModal({ task, agents, onClose, onUpdate }: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [instructions, setInstructions] = useState(task.instructions ?? "")
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [assignedAgentId, setAssignedAgentId] = useState(task.assignedAgentId ?? "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Track whether any field has changed
  const hasChanges =
    title !== task.title ||
    description !== (task.description ?? "") ||
    instructions !== (task.instructions ?? "") ||
    status !== task.status ||
    priority !== task.priority ||
    assignedAgentId !== (task.assignedAgentId ?? "")

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => {
      overlayRef.current?.classList.remove("opacity-0")
      panelRef.current?.classList.remove("translate-y-4", "opacity-0")
    })
  }, [])

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  async function handleSave() {
    if (!hasChanges || saving) return
    setSaving(true)
    const updates: Record<string, unknown> = {}
    if (title !== task.title) updates.title = title
    if (description !== (task.description ?? "")) updates.description = description || null
    if (instructions !== (task.instructions ?? "")) updates.instructions = instructions || null
    if (status !== task.status) {
      updates.status = status
      if (status === "done" && task.status !== "done") {
        updates.completedAt = new Date().toISOString()
      }
    }
    if (priority !== task.priority) updates.priority = priority
    if (assignedAgentId !== (task.assignedAgentId ?? "")) {
      updates.assignedAgentId = assignedAgentId || null
    }
    await onUpdate(task.id, updates as Partial<DBTask>)
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    await onUpdate(task.id, { status: "done", completedAt: new Date().toISOString() } as Partial<DBTask>)
    setDeleting(false)
    onClose()
  }

  const assignedAgent = assignedAgentId ? agents.find((a) => a.id === assignedAgentId) : null
  const currentStatus = statusOptions.find((s) => s.id === status)
  const currentPriority = priorityOptions.find((p) => p.id === priority)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm opacity-0 transition-opacity duration-200"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="relative bg-[#1a1a2e] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl rounded-2xl shadow-2xl w-full max-w-[600px] mx-4 max-h-[85vh] overflow-y-auto translate-y-4 opacity-0 transition-all duration-200"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-lg font-semibold outline-none border-b border-transparent focus:border-border transition-colors pb-1 pr-8"
              placeholder="Task title"
            />
          </div>

          {/* Status + Priority row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Status</span>
              <div className="flex gap-0.5">
                {statusOptions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStatus(s.id)}
                    className={cn(
                      "h-7 px-2.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-colors",
                      status === s.id
                        ? "btn-primary"
                        : "btn-secondary text-muted-foreground/60 hover:text-muted-foreground",
                    )}
                  >
                    {s.icon}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Priority selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Priority</span>
            <div className="flex gap-0.5">
              {priorityOptions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPriority(p.id)}
                  className={cn(
                    "h-7 px-2.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-colors",
                    priority === p.id
                      ? "btn-primary"
                      : "btn-secondary text-muted-foreground/60 hover:text-muted-foreground",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned agent */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Assigned To</span>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setAssignedAgentId("")}
                className={cn(
                  "h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors",
                  !assignedAgentId
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50",
                )}
              >
                Unassigned
              </button>
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAssignedAgentId(a.id)}
                  className={cn(
                    "h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors",
                    assignedAgentId === a.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <PixelAvatar characterIndex={a.pixelAvatarIndex} size={14} className="rounded-sm" />
                  {a.name}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add a description..."
              className="w-full rounded-lg bg-[#16213e] border border-[rgba(255,255,255,0.08)] rounded-xl focus:border-[#635bff] px-3 py-2 text-[13px] outline-none resize-none transition-colors"
            />
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Instructions</span>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="Add instructions for the agent..."
              className="w-full rounded-lg bg-[#16213e] border border-[rgba(255,255,255,0.08)] rounded-xl focus:border-[#635bff] px-3 py-2 text-[13px] outline-none resize-none transition-colors"
            />
          </div>

          {/* Blocked reason */}
          {task.blockedReason && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Blocked Reason</span>
              <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[13px] text-red-400">
                {task.blockedReason}
              </div>
            </div>
          )}

          {/* Requirement / Deliverable */}
          {task.requirement?.type && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Requirement</span>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded",
                    task.requirement.fulfilled
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400",
                  )}>
                    {task.requirement.fulfilled ? "Fulfilled" : `Needs ${task.requirement.type}`}
                  </span>
                  <span className="text-[13px] text-foreground/80">{task.requirement.label}</span>
                </div>
                {task.requirement.fulfilled && task.requirement.value && (
                  <p className="text-[12px] text-muted-foreground mt-1.5">Value: {task.requirement.value}</p>
                )}
                {task.requirement.fulfilledAt && (
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    Fulfilled {new Date(task.requirement.fulfilledAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1 border-t border-border">
            <span>Created {new Date(task.createdAt).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}</span>
            {task.completedAt && (
              <span>Completed {new Date(task.completedAt).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}</span>
            )}
            {task.assignedToUser && <span className="text-amber-400 font-medium">Assigned to you</span>}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-red-400">Archive this task?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1"
                  >
                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Yes, archive
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="h-7 px-2.5 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleDelete}
                  className="h-7 px-2.5 rounded-md text-[11px] font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Archive
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="h-8 px-3 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={cn(
                  "h-8 px-4 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5",
                  hasChanges
                    ? "bg-[#635bff] text-white hover:bg-[#5b52e0]"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
