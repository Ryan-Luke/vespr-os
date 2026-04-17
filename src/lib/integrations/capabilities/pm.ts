// Project Management capability. Lets agents create tasks/issues in whichever
// PM tool the user has connected. Same pattern as CRM capability.

import { listIntegrations } from "@/lib/integrations/credentials"

export interface PMTaskInput {
  title: string
  description?: string
  priority?: 0 | 1 | 2 | 3 | 4 // 0 none, 1 urgent, 2 high, 3 normal, 4 low
  tags?: string[]
}

export interface PMTask {
  id: string
  identifier: string  // human-readable ID like LIN-123 or a URL-friendly slug
  title: string
  url: string | null
}

export interface PMTaskUpdateInput {
  title?: string
  description?: string
  priority?: 0 | 1 | 2 | 3 | 4
  stateId?: string       // status/state ID (e.g., Linear state UUID, Asana section GID)
  assigneeId?: string
}

export interface PMComment {
  id: string
  body: string
  authorName: string | null
  createdAt: string | null
}

export interface PMTaskDetail extends PMTask {
  description: string | null
  status: string | null
  priority: number | null
  assigneeName: string | null
  createdAt: string | null
  updatedAt: string | null
  comments: PMComment[]
}

export interface PMClient {
  providerKey: string

  // Existing
  createTask(workspaceId: string, input: PMTaskInput): Promise<PMTask>

  // NEW
  updateTask(workspaceId: string, taskId: string, input: PMTaskUpdateInput): Promise<PMTask>
  addComment(workspaceId: string, taskId: string, body: string): Promise<PMComment>
  listTasks(workspaceId: string, limit: number): Promise<PMTask[]>
  getTask(workspaceId: string, taskId: string): Promise<PMTaskDetail>
}

const PM_PROVIDER_KEYS = ["linear", "clickup", "asana", "trello", "notion"] as const
export type PMProviderKey = typeof PM_PROVIDER_KEYS[number]

export async function getConnectedPMKey(workspaceId: string): Promise<PMProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of PM_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

export async function getPMClient(workspaceId: string): Promise<PMClient | null> {
  const key = await getConnectedPMKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "linear":
      return (await import("@/lib/integrations/clients/linear")).linearPMClient
    case "asana":
      return (await import("@/lib/integrations/clients/asana")).asanaPMClient
    case "clickup":
    case "trello":
    case "notion":
      return null
    default:
      return null
  }
}
