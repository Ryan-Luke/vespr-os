// Linear API client (first integration adapter implementation).
//
// Uses the stored API key from the integrations table. Plaintext credentials
// never leave this module.
//
// Docs: https://developers.linear.app/docs/graphql/working-with-the-graphql-api

import { getCredentials } from "@/lib/integrations/credentials"

const LINEAR_GRAPHQL = "https://api.linear.app/graphql"

async function callLinear<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Linear expects the raw API key, no Bearer prefix
      "Authorization": apiKey,
    },
    body: JSON.stringify({ query, variables }),
  })
  const payload = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(`Linear API error: ${payload.errors.map((e) => e.message).join("; ")}`)
  }
  if (!payload.data) {
    throw new Error("Linear API returned no data")
  }
  return payload.data
}

export interface CreateLinearIssueInput {
  title: string
  description?: string
  teamId?: string       // if omitted, defaults to the first team the user belongs to
  priority?: 0 | 1 | 2 | 3 | 4 // 0=none, 1=urgent, 2=high, 3=normal, 4=low
}

export interface CreateLinearIssueResult {
  id: string
  identifier: string    // e.g. "ENG-123"
  title: string
  url: string
}

/**
 * Create a Linear issue using stored workspace credentials.
 * Throws if credentials are missing, invalid, or the request fails.
 */
export async function createLinearIssue(
  workspaceId: string,
  input: CreateLinearIssueInput,
): Promise<CreateLinearIssueResult> {
  const creds = await getCredentials(workspaceId, "linear")
  if (!creds?.api_key) {
    throw new Error("Linear is not connected for this workspace. Connect it via the integration picker first.")
  }
  const apiKey = creds.api_key

  // Resolve team ID if not provided. Linear requires a teamId on issue create.
  let teamId = input.teamId
  if (!teamId) {
    const teamsData = await callLinear<{ teams: { nodes: { id: string }[] } }>(
      apiKey,
      `query { teams(first: 1) { nodes { id } } }`,
    )
    teamId = teamsData.teams.nodes[0]?.id
    if (!teamId) {
      throw new Error("No Linear teams found for this API key. Check the key's workspace access.")
    }
  }

  const data = await callLinear<{
    issueCreate: {
      success: boolean
      issue: { id: string; identifier: string; title: string; url: string } | null
    }
  }>(
    apiKey,
    `mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier title url }
      }
    }`,
    {
      input: {
        teamId,
        title: input.title,
        description: input.description,
        priority: input.priority,
      },
    },
  )

  if (!data.issueCreate.success || !data.issueCreate.issue) {
    throw new Error("Linear rejected the issue create mutation")
  }
  return data.issueCreate.issue
}

// ── PM capability adapter ─────────────────────────────────
// Exposes Linear as a drop-in PMClient so agents can call `pm_create_task`
// without caring which project management tool is connected.

import type { PMClient, PMTask, PMTaskInput, PMTaskUpdateInput, PMComment, PMTaskDetail } from "@/lib/integrations/capabilities/pm"

async function pmCreateTask(workspaceId: string, input: PMTaskInput): Promise<PMTask> {
  const issue = await createLinearIssue(workspaceId, {
    title: input.title,
    description: input.description,
    priority: input.priority,
  })
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
  }
}

async function pmUpdateTask(workspaceId: string, taskId: string, input: PMTaskUpdateInput): Promise<PMTask> {
  const creds = await getCredentials(workspaceId, "linear")
  if (!creds?.api_key) throw new Error("Linear is not connected for this workspace.")
  const apiKey = creds.api_key

  const issueInput: Record<string, unknown> = {}
  if (input.title !== undefined) issueInput.title = input.title
  if (input.description !== undefined) issueInput.description = input.description
  if (input.priority !== undefined) issueInput.priority = input.priority
  if (input.stateId !== undefined) issueInput.stateId = input.stateId
  if (input.assigneeId !== undefined) issueInput.assigneeId = input.assigneeId

  const data = await callLinear<{
    issueUpdate: {
      success: boolean
      issue: { id: string; identifier: string; title: string; url: string } | null
    }
  }>(
    apiKey,
    `mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue { id identifier title url }
      }
    }`,
    { id: taskId, input: issueInput },
  )

  if (!data.issueUpdate.success || !data.issueUpdate.issue) {
    throw new Error("Linear rejected the issue update")
  }
  return data.issueUpdate.issue
}

async function pmAddComment(workspaceId: string, taskId: string, body: string): Promise<PMComment> {
  const creds = await getCredentials(workspaceId, "linear")
  if (!creds?.api_key) throw new Error("Linear is not connected for this workspace.")
  const apiKey = creds.api_key

  const data = await callLinear<{
    commentCreate: {
      success: boolean
      comment: { id: string; body: string; user: { name: string } | null; createdAt: string } | null
    }
  }>(
    apiKey,
    `mutation($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment { id body user { name } createdAt }
      }
    }`,
    { input: { issueId: taskId, body } },
  )

  if (!data.commentCreate.success || !data.commentCreate.comment) {
    throw new Error("Linear rejected the comment create")
  }
  const c = data.commentCreate.comment
  return {
    id: c.id,
    body: c.body,
    authorName: c.user?.name ?? null,
    createdAt: c.createdAt,
  }
}

async function pmListTasks(workspaceId: string, limit: number): Promise<PMTask[]> {
  const creds = await getCredentials(workspaceId, "linear")
  if (!creds?.api_key) throw new Error("Linear is not connected for this workspace.")
  const apiKey = creds.api_key
  const clamped = Math.min(Math.max(limit, 1), 50)

  const data = await callLinear<{
    issues: {
      nodes: { id: string; identifier: string; title: string; url: string }[]
    }
  }>(
    apiKey,
    `query($first: Int!) {
      issues(first: $first, orderBy: createdAt) {
        nodes { id identifier title url }
      }
    }`,
    { first: clamped },
  )

  return data.issues.nodes.map((i) => ({
    id: i.id,
    identifier: i.identifier,
    title: i.title,
    url: i.url,
  }))
}

async function pmGetTask(workspaceId: string, taskId: string): Promise<PMTaskDetail> {
  const creds = await getCredentials(workspaceId, "linear")
  if (!creds?.api_key) throw new Error("Linear is not connected for this workspace.")
  const apiKey = creds.api_key

  const data = await callLinear<{
    issue: {
      id: string
      identifier: string
      title: string
      description: string | null
      url: string
      priority: number | null
      state: { name: string } | null
      assignee: { name: string } | null
      createdAt: string
      updatedAt: string
      comments: {
        nodes: { id: string; body: string; user: { name: string } | null; createdAt: string }[]
      }
    }
  }>(
    apiKey,
    `query($id: String!) {
      issue(id: $id) {
        id identifier title description url priority
        state { name }
        assignee { name }
        createdAt updatedAt
        comments(first: 20) {
          nodes { id body user { name } createdAt }
        }
      }
    }`,
    { id: taskId },
  )

  const i = data.issue
  return {
    id: i.id,
    identifier: i.identifier,
    title: i.title,
    url: i.url,
    description: i.description,
    status: i.state?.name ?? null,
    priority: i.priority,
    assigneeName: i.assignee?.name ?? null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    comments: i.comments.nodes.map((c) => ({
      id: c.id,
      body: c.body,
      authorName: c.user?.name ?? null,
      createdAt: c.createdAt,
    })),
  }
}

export const linearPMClient: PMClient = {
  providerKey: "linear",
  createTask: pmCreateTask,
  updateTask: pmUpdateTask,
  addComment: pmAddComment,
  listTasks: pmListTasks,
  getTask: pmGetTask,
}

/** Delete a Linear issue by its ID. Used for cleanup in smoke tests. */
export async function deleteLinearIssue(workspaceId: string, issueId: string): Promise<boolean> {
  const creds = await getCredentials(workspaceId, "linear")
  if (!creds?.api_key) return false
  const data = await callLinear<{ issueDelete: { success: boolean } }>(
    creds.api_key,
    `mutation($id: String!) { issueDelete(id: $id) { success } }`,
    { id: issueId },
  )
  return data.issueDelete.success
}
