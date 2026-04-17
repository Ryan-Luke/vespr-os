// Tests for OAuth2 PKCE helpers.

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  generateAuthUrl,
  exchangeCode,
  refreshToken,
  isTokenExpired,
  encryptTokens,
  decryptTokens,
} from "./oauth"

// Set required env var for crypto
process.env.INTEGRATION_ENCRYPTION_KEY = "a".repeat(64)

const mockFetch = vi.fn()
global.fetch = mockFetch

describe("OAuth2 PKCE", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe("generateCodeVerifier", () => {
    it("returns a URL-safe string of correct length", () => {
      const verifier = generateCodeVerifier()
      expect(verifier.length).toBeGreaterThanOrEqual(32)
      expect(verifier.length).toBeLessThanOrEqual(128)
      expect(/^[a-zA-Z0-9\-._~]+$/.test(verifier)).toBe(true)
    })

    it("generates unique values", () => {
      const v1 = generateCodeVerifier()
      const v2 = generateCodeVerifier()
      expect(v1).not.toBe(v2)
    })
  })

  describe("generateCodeChallenge", () => {
    it("returns a base64url-encoded SHA256 hash", () => {
      const verifier = "test-verifier-string"
      const challenge = generateCodeChallenge(verifier)
      expect(challenge).toBeTruthy()
      expect(challenge).not.toBe(verifier)
      expect(generateCodeChallenge(verifier)).toBe(challenge)
    })
  })

  describe("generateState", () => {
    it("returns a 32-character hex string", () => {
      const state = generateState()
      expect(state).toHaveLength(32)
      expect(/^[a-f0-9]+$/.test(state)).toBe(true)
    })
  })

  describe("generateAuthUrl", () => {
    it("builds a correct authorization URL with PKCE params", () => {
      const result = generateAuthUrl({
        config: {
          providerKey: "test_provider",
          authorizeUrl: "https://auth.example.com/authorize",
          tokenUrl: "https://auth.example.com/token",
          clientId: "client-123",
          scopes: ["read", "write"],
        },
        redirectUri: "https://myapp.com/api/integrations/oauth/callback",
        workspaceId: "ws-1",
      })

      expect(result.authorizationUrl).toContain("https://auth.example.com/authorize?")
      expect(result.authorizationUrl).toContain("client_id=client-123")
      expect(result.authorizationUrl).toContain("response_type=code")
      expect(result.authorizationUrl).toContain("scope=read+write")
      expect(result.authorizationUrl).toContain("code_challenge_method=S256")
      expect(result.authorizationUrl).toContain("code_challenge=")
      expect(result.authorizationUrl).toContain("state=")
      expect(result.state).toHaveLength(32)
      expect(result.codeVerifier).toBeTruthy()
    })
  })

  describe("exchangeCode", () => {
    it("sends POST to token URL with PKCE verifier", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: "at-123",
          refresh_token: "rt-456",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "read write",
        }),
      })

      const result = await exchangeCode({
        config: {
          providerKey: "test",
          authorizeUrl: "https://auth.example.com/authorize",
          tokenUrl: "https://auth.example.com/token",
          clientId: "client-123",
          scopes: [],
        },
        code: "auth-code-xxx",
        codeVerifier: "verifier-yyy",
        redirectUri: "https://myapp.com/callback",
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("https://auth.example.com/token")
      expect(init.method).toBe("POST")
      expect(init.body).toContain("code=auth-code-xxx")
      expect(init.body).toContain("code_verifier=verifier-yyy")

      expect(result.access_token).toBe("at-123")
      expect(result.refresh_token).toBe("rt-456")
      expect(result.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it("throws on token exchange failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "invalid_grant", error_description: "Code expired" }),
      })

      await expect(
        exchangeCode({
          config: {
            providerKey: "test",
            authorizeUrl: "https://a.com/auth",
            tokenUrl: "https://a.com/token",
            clientId: "c",
            scopes: [],
          },
          code: "bad-code",
          codeVerifier: "v",
          redirectUri: "https://r.com",
        }),
      ).rejects.toThrow("Code expired")
    })
  })

  describe("refreshToken", () => {
    it("exchanges refresh token for new access token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: "new-at-789",
          refresh_token: "new-rt-012",
          expires_in: 7200,
          token_type: "Bearer",
        }),
      })

      const result = await refreshToken({
        config: {
          providerKey: "test",
          authorizeUrl: "https://a.com/auth",
          tokenUrl: "https://a.com/token",
          clientId: "c",
          scopes: [],
        },
        refreshToken: "old-rt-456",
      })

      expect(result.access_token).toBe("new-at-789")
      expect(result.refresh_token).toBe("new-rt-012")
    })

    it("keeps old refresh token if not returned", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: "new-at",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      })

      const result = await refreshToken({
        config: {
          providerKey: "test",
          authorizeUrl: "https://a.com/auth",
          tokenUrl: "https://a.com/token",
          clientId: "c",
          scopes: [],
        },
        refreshToken: "keep-this-rt",
      })

      expect(result.refresh_token).toBe("keep-this-rt")
    })
  })

  describe("isTokenExpired", () => {
    it("returns false when no expiry info", () => {
      expect(isTokenExpired({ access_token: "at", token_type: "Bearer" })).toBe(false)
    })

    it("returns false when token is fresh", () => {
      expect(isTokenExpired({
        access_token: "at",
        token_type: "Bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      })).toBe(false)
    })

    it("returns true when token expires within 5 minutes", () => {
      expect(isTokenExpired({
        access_token: "at",
        token_type: "Bearer",
        expires_at: Math.floor(Date.now() / 1000) + 60,
      })).toBe(true)
    })

    it("returns true when token is expired", () => {
      expect(isTokenExpired({
        access_token: "at",
        token_type: "Bearer",
        expires_at: Math.floor(Date.now() / 1000) - 60,
      })).toBe(true)
    })
  })

  describe("encryptTokens / decryptTokens", () => {
    it("round-trips tokens through encryption", () => {
      const tokens = {
        access_token: "at-123",
        refresh_token: "rt-456",
        expires_at: 1744454400,
        token_type: "Bearer" as const,
        scope: "read write",
      }
      const encrypted = encryptTokens(tokens)
      expect(typeof encrypted).toBe("string")
      expect(encrypted).not.toContain("at-123")

      const decrypted = decryptTokens(encrypted)
      expect(decrypted).toEqual(tokens)
    })
  })
})
