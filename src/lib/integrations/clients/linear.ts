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

import type { PMClient, PMTask, PMTaskInput } from "@/lib/integrations/capabilities/pm"

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

export const linearPMClient: PMClient = {
  providerKey: "linear",
  createTask: pmCreateTask,
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
