import { describe, it, expect } from "vitest"
import {
  canManageAgents, canManageIntegrations, canDeleteWorkspace,
  canManageBilling, canApproveActions, canChat, canManageSOPs,
  canInviteUsers,
} from "./rbac"

describe("RBAC permission checks", () => {
  it("owner can do everything", () => {
    expect(canManageAgents("owner")).toBe(true)
    expect(canManageIntegrations("owner")).toBe(true)
    expect(canDeleteWorkspace("owner")).toBe(true)
    expect(canManageBilling("owner")).toBe(true)
    expect(canApproveActions("owner")).toBe(true)
    expect(canChat("owner")).toBe(true)
    expect(canManageSOPs("owner")).toBe(true)
    expect(canInviteUsers("owner")).toBe(true)
  })

  it("admin can manage agents and integrations but not delete workspace", () => {
    expect(canManageAgents("admin")).toBe(true)
    expect(canManageIntegrations("admin")).toBe(true)
    expect(canDeleteWorkspace("admin")).toBe(false)
    expect(canManageBilling("admin")).toBe(false)
    expect(canInviteUsers("admin")).toBe(true)
  })

  it("member can chat and approve but not manage agents", () => {
    expect(canManageAgents("member")).toBe(false)
    expect(canManageIntegrations("member")).toBe(false)
    expect(canDeleteWorkspace("member")).toBe(false)
    expect(canApproveActions("member")).toBe(true)
    expect(canChat("member")).toBe(true)
    expect(canManageSOPs("member")).toBe(false)
    expect(canInviteUsers("member")).toBe(false)
  })
})
