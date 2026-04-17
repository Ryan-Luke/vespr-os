// Asana project management client.
//
// Uses Personal Access Token (PAT) auth with the REST API.
//
// Docs: https://developers.asana.com/reference/rest-api-reference

import { getCredentials } from "@/lib/integrations/credentials"
import type {
  PMClient,
  PMTask,
  PMTaskInput,
  PMTaskUpdateInput,
  PMComment,
  PMTaskDetail,
} from "@/lib/integrations/capabilities/pm"

const ASANA_API = "https://app.asana.com/api/1.0"

interface AsanaCreds {
  apiKey: string
  workspaceGid: string
}

async function loadAsanaCreds(workspaceId: string): Promise<AsanaCreds> {
  const creds = await getCredentials(workspaceId, "asana")
  if (!creds?.api_key || !creds?.workspace_gid) {
    throw new Error("Asana is not connected for this workspace. Connect it via the integration picker first.")
  }
  return { apiKey: creds.api_key, workspaceGid: creds.workspace_gid }
}

async function callAsana<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(ASANA_API + path, {
    ...init,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errors = (payload as { errors?: { message?: string }[] })?.errors
    const msg = errors?.[0]?.message ?? `Asana HTTP ${res.status}`
    throw new Error(`Asana API error: ${msg}`)
  }
  return (payload as { data: T }).data
}

// ── Task mapping ─────────────────────────────────────────

interface AsanaTaskRaw {
  gid: string
  name: string
  notes?: string | null
  permalink_url?: string | null
  assignee?: { name?: string } | null
  assignee_status?: string | null
  completed?: boolean
  created_at?: string | null
  modified_at?: string | null
  memberships?: { section?: { name?: string } }[]
}

function toTask(raw: AsanaTaskRaw): PMTask {
  return {
    id: raw.gid,
    identifier: raw.gid,
    title: raw.name,
    url: raw.permalink_url ?? `https://app.asana.com/0/0/${raw.gid}`,
  }
}

async function createTask(workspaceId: string, input: PMTaskInput): Promise<PMTask> {
  const { apiKey, workspaceGid } = await loadAsanaCreds(workspaceId)

  // Find the first project in the workspace to attach the task
  const projects = await callAsana<{ gid: string }[]>(
    apiKey,
    `/workspaces/${encodeURIComponent(workspaceGid)}/projects?limit=1&opt_fields=gid`,
  )
  const projectGid = projects[0]?.gid

  const body: Record<string, unknown> = {
    name: input.title,
    notes: input.description ?? "",
    workspace: workspaceGid,
  }
  if (projectGid) {
    body.projects = [projectGid]
  }

  const data = await callAsana<AsanaTaskRaw>(
    apiKey,
    "/tasks",
    {
      method: "POST",
      body: JSON.stringify({ data: body }),
    },
  )
  return toTask(data)
}

async function updateTask(workspaceId: string, taskId: string, input: PMTaskUpdateInput): Promise<PMTask> {
  const { apiKey } = await loadAsanaCreds(workspaceId)

  const body: Record<string, unknown> = {}
  if (input.title !== undefined) body.name = input.title
  if (input.description !== undefined) body.notes = input.description
  if (input.assigneeId !== undefined) body.assignee = input.assigneeId

  const data = await callAsana<AsanaTaskRaw>(
    apiKey,
    `/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ data: body }),
    },
  )

  // If stateId (section GID) provided, move the task to that section
  if (input.stateId) {
    await callAsana(
      apiKey,
      `/sections/${encodeURIComponent(input.stateId)}/addTask`,
      {
        method: "POST",
        body: JSON.stringify({ data: { task: taskId } }),
      },
    )
  }

  return toTask(data)
}

async function addComment(workspaceId: string, taskId: string, body: string): Promise<PMComment> {
  const { apiKey } = await loadAsanaCreds(workspaceId)

  const data = await callAsana<{
    gid: string
    text: string
    created_by?: { name?: string }
    created_at?: string
  }>(
    apiKey,
    `/tasks/${encodeURIComponent(taskId)}/stories`,
    {
      method: "POST",
      body: JSON.stringify({ data: { text: body } }),
    },
  )

  return {
    id: data.gid,
    body: data.text,
    authorName: data.created_by?.name ?? null,
    createdAt: data.created_at ?? null,
  }
}

async function listTasks(workspaceId: string, limit: number): Promise<PMTask[]> {
  const { apiKey, workspaceGid } = await loadAsanaCreds(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 100)

  const data = await callAsana<AsanaTaskRaw[]>(
    apiKey,
    `/tasks?workspace=${encodeURIComponent(workspaceGid)}&assignee=me&limit=${clamped}&opt_fields=gid,name,permalink_url`,
  )
  return data.map(toTask)
}

async function getTask(workspaceId: string, taskId: string): Promise<PMTaskDetail> {
  const { apiKey } = await loadAsanaCreds(workspaceId)

  const data = await callAsana<AsanaTaskRaw & {
    notes?: string
  }>(
    apiKey,
    `/tasks/${encodeURIComponent(taskId)}?opt_fields=gid,name,notes,permalink_url,assignee.name,completed,created_at,modified_at,memberships.section.name`,
  )

  // Fetch stories (comments) separately
  const stories = await callAsana<{
    gid: string
    text?: string
    type?: string
    created_by?: { name?: string }
    created_at?: string
  }[]>(
    apiKey,
    `/tasks/${encodeURIComponent(taskId)}/stories?opt_fields=gid,text,type,created_by.name,created_at`,
  )
  const comments: PMComment[] = (stories ?? [])
    .filter((s) => s.type === "comment")
    .slice(0, 20)
    .map((s) => ({
      id: s.gid,
      body: s.text ?? "",
      authorName: s.created_by?.name ?? null,
      createdAt: s.created_at ?? null,
    }))

  const sectionName = data.memberships?.[0]?.section?.name ?? null

  return {
    id: data.gid,
    identifier: data.gid,
    title: data.name,
    url: data.permalink_url ?? `https://app.asana.com/0/0/${data.gid}`,
    description: data.notes ?? null,
    status: sectionName ?? (data.completed ? "Completed" : "Open"),
    priority: null, // Asana uses custom fields for priority
    assigneeName: data.assignee?.name ?? null,
    createdAt: data.created_at ?? null,
    updatedAt: data.modified_at ?? null,
    comments,
  }
}

export const asanaPMClient: PMClient = {
  providerKey: "asana",
  createTask,
  updateTask,
  addComment,
  listTasks,
  getTask,
}
