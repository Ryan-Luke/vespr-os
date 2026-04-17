import { vi } from "vitest"

/**
 * Creates a mock DB instance with chainable methods.
 * Use `mockResolvedValue` on terminal methods to control return values.
 */
export function createMockDb() {
  const mock: Record<string, any> = {}
  const chainMethods = [
    "select", "insert", "update", "delete",
    "from", "where", "set", "values",
    "returning", "limit", "orderBy",
    "groupBy", "offset", "innerJoin",
    "leftJoin", "rightJoin",
  ]
  for (const method of chainMethods) {
    mock[method] = vi.fn().mockReturnValue(mock)
  }
  // Terminal methods return empty by default
  mock.returning = vi.fn().mockResolvedValue([])
  mock.limit = vi.fn().mockResolvedValue([])
  mock.execute = vi.fn().mockResolvedValue([])
  return mock
}

/**
 * Creates a fake user for testing.
 */
export function fakeUser(overrides: Partial<{
  id: string
  email: string
  name: string
  role: string
  avatarEmoji: string
}> = {}) {
  return {
    id: overrides.id ?? "user-1",
    email: overrides.email ?? "test@example.com",
    name: overrides.name ?? "Test User",
    role: overrides.role ?? "owner",
    avatarEmoji: overrides.avatarEmoji ?? "👤",
  }
}

/**
 * Creates a fake workspace for testing.
 */
export function fakeWorkspace(overrides: Partial<{
  id: string
  name: string
  slug: string
}> = {}) {
  return {
    id: overrides.id ?? "ws-1",
    name: overrides.name ?? "Test Workspace",
    slug: overrides.slug ?? "test-workspace",
    icon: "🏢",
    isActive: true,
    createdAt: new Date(),
  }
}
