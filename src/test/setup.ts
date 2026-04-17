/**
 * Global test setup for Vitest.
 * Sets env vars and provides common mocks.
 */

process.env.AUTH_SECRET = "test-secret-must-be-at-least-16-chars-long"
process.env.NODE_ENV = "test"
process.env.INTEGRATION_ENCRYPTION_KEY = "0".repeat(64)

// Mock next/headers — not available outside Next.js runtime
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))
