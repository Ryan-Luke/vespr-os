import { describe, it, expect } from "vitest"
import { createSessionCookie, verifySessionCookie } from "./session"
import {
  canManageAgents, canManageIntegrations, canDeleteWorkspace,
  canManageBilling, canApproveActions, canChat, canInviteUsers,
  canManageSOPs, canManageSchedules, canManageWorkspace,
  canRemoveUsers, canManageTasks, canViewDecisions,
} from "./rbac"
import type { WorkspaceRole } from "./with-auth"

describe("Auth Integration: session round-trip", () => {
  it("creates a session with workspaceId and verifies all fields", async () => {
    const cookie = await createSessionCookie("user-abc", "ws-123", "admin")
    const session = await verifySessionCookie(cookie)

    expect(session).not.toBeNull()
    expect(session!.userId).toBe("user-abc")
    expect(session!.workspaceId).toBe("ws-123")
    expect(session!.role).toBe("admin")
  })

  it("rejects a cookie with tampered workspaceId", async () => {
    const cookie = await createSessionCookie("user-1", "ws-1", "owner")
    // Tamper by changing a character in the payload
    const [payload, sig] = cookie.split(".")
    const tampered = payload.slice(0, -1) + (payload.slice(-1) === "a" ? "b" : "a")
    const result = await verifySessionCookie(`${tampered}.${sig}`)
    expect(result).toBeNull()
  })

  it("switches workspace by creating a new session", async () => {
    const cookie1 = await createSessionCookie("user-1", "ws-A", "owner")
    const session1 = await verifySessionCookie(cookie1)
    expect(session1!.workspaceId).toBe("ws-A")

    const cookie2 = await createSessionCookie("user-1", "ws-B", "member")
    const session2 = await verifySessionCookie(cookie2)
    expect(session2!.workspaceId).toBe("ws-B")
    expect(session2!.role).toBe("member")
  })
})

describe("Auth Integration: RBAC hierarchy", () => {
  const allPermissions = [
    { name: "manageAgents", fn: canManageAgents },
    { name: "manageIntegrations", fn: canManageIntegrations },
    { name: "deleteWorkspace", fn: canDeleteWorkspace },
    { name: "manageBilling", fn: canManageBilling },
    { name: "approveActions", fn: canApproveActions },
    { name: "chat", fn: canChat },
    { name: "inviteUsers", fn: canInviteUsers },
    { name: "removeUsers", fn: canRemoveUsers },
    { name: "manageSOPs", fn: canManageSOPs },
    { name: "manageSchedules", fn: canManageSchedules },
    { name: "manageWorkspace", fn: canManageWorkspace },
    { name: "manageTasks", fn: canManageTasks },
    { name: "viewDecisions", fn: canViewDecisions },
  ]

  const roles: WorkspaceRole[] = ["owner", "admin", "member"]

  it("owner has all permissions", () => {
    for (const perm of allPermissions) {
      expect(perm.fn("owner"), `owner should have ${perm.name}`).toBe(true)
    }
  })

  it("member permissions are a subset of admin", () => {
    for (const perm of allPermissions) {
      if (perm.fn("member")) {
        expect(perm.fn("admin"), `admin should have ${perm.name} since member does`).toBe(true)
      }
    }
  })

  it("admin permissions are a subset of owner", () => {
    for (const perm of allPermissions) {
      if (perm.fn("admin")) {
        expect(perm.fn("owner"), `owner should have ${perm.name} since admin does`).toBe(true)
      }
    }
  })

  it("member cannot manage agents or integrations", () => {
    expect(canManageAgents("member")).toBe(false)
    expect(canManageIntegrations("member")).toBe(false)
    expect(canManageSOPs("member")).toBe(false)
    expect(canManageSchedules("member")).toBe(false)
    expect(canInviteUsers("member")).toBe(false)
  })

  it("only owner can delete workspace and manage billing", () => {
    expect(canDeleteWorkspace("owner")).toBe(true)
    expect(canDeleteWorkspace("admin")).toBe(false)
    expect(canDeleteWorkspace("member")).toBe(false)
    expect(canManageBilling("owner")).toBe(true)
    expect(canManageBilling("admin")).toBe(false)
    expect(canManageBilling("member")).toBe(false)
  })
})

describe("Auth Integration: workspace isolation", () => {
  it("sessions for different workspaces have different workspaceIds", async () => {
    const cookieA = await createSessionCookie("user-1", "ws-alpha", "owner")
    const cookieB = await createSessionCookie("user-1", "ws-beta", "member")

    const sessionA = await verifySessionCookie(cookieA)
    const sessionB = await verifySessionCookie(cookieB)

    expect(sessionA!.workspaceId).toBe("ws-alpha")
    expect(sessionB!.workspaceId).toBe("ws-beta")
    expect(sessionA!.workspaceId).not.toBe(sessionB!.workspaceId)
  })

  it("same user can have different roles in different workspaces", async () => {
    const cookieA = await createSessionCookie("user-1", "ws-1", "owner")
    const cookieB = await createSessionCookie("user-1", "ws-2", "member")

    const sessionA = await verifySessionCookie(cookieA)
    const sessionB = await verifySessionCookie(cookieB)

    expect(sessionA!.role).toBe("owner")
    expect(sessionB!.role).toBe("member")
  })
})
