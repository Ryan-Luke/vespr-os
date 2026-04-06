// Nova-powered onboarding conversation. Single useChat endpoint replaces
// the old step machine. Nova collects everything naturally, validates the
// API key inline, and calls complete_onboarding when ready.
//
// No message history parsing. The LLM reads the full conversation and
// knows what's been discussed. The system prompt tells it what to collect.

import { streamText, tool, jsonSchema, convertToModelMessages } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { anthropic as defaultAnthropic } from "@ai-sdk/anthropic"
import type { UIMessage } from "ai"

export const maxDuration = 30

const SYSTEM_PROMPT = `You are Nova onboarding a new user. The user's FIRST message is their name. Acknowledge it, then ask about their business type.

Every response: [short acknowledgment]. [next question]?

Collect in this order (the first one is already answered in their first message):
1. Name (already provided in first message)
2. Business type (just ask "What type of business is it?" and nothing else. The UI shows clickable buttons.)
3. What the business does
4. Business name (skippable)
5. Competitors (skippable)
6. Goal
7. Target scale
8. Timeline

Accept "skip" or "none" for items 4-8. When you have name + type + description, call complete_onboarding. No em dashes. Never say Great or Awesome. Keep every response to 1-2 sentences.`

export async function POST(req: Request) {
  const { messages, validatedApiKey } = await req.json() as {
    messages: UIMessage[]
    validatedApiKey?: string
  }

  // Extract the origin from the incoming request so the complete_onboarding
  // tool can self-fetch without depending on environment variables.
  const host = req.headers.get("host") ?? "localhost:3000"
  const protocol = host.includes("localhost") ? "http" : "https"
  const selfBaseUrl = `${protocol}://${host}`

  // Use the user's validated key so they pay for their own onboarding.
  // Falls back to platform key if somehow missing.
  const model = validatedApiKey
    ? createAnthropic({ apiKey: validatedApiKey })("claude-haiku-4-5")
    : defaultAnthropic("claude-haiku-4-5")

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      validate_api_key: tool({
        description: "Validate an Anthropic API key. Call this immediately when the user provides a key starting with sk-ant-.",
        inputSchema: jsonSchema<{ apiKey: string }>({
          type: "object",
          properties: { apiKey: { type: "string" } },
          required: ["apiKey"],
          additionalProperties: false,
        }),
        execute: async ({ apiKey }) => {
          try {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1,
                messages: [{ role: "user", content: "hi" }],
              }),
            })
            if (res.ok) {
              return { valid: true, apiKey }
            }
            const err = await res.json().catch(() => ({}))
            return { valid: false, error: (err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}` }
          } catch {
            return { valid: false, error: "Could not reach Anthropic" }
          }
        },
      }),

      complete_onboarding: tool({
        description: "Create the workspace and activate the team. Call this when you have: validated API key + name + business type + description. Other fields are optional but helpful.",
        inputSchema: jsonSchema<{
          anthropicKey: string
          userName: string
          businessName?: string
          businessType: string
          businessDescription: string
          competitors?: string
          businessGoal?: string
          targetScale?: string
          timeline?: string
        }>({
          type: "object",
          properties: {
            anthropicKey: { type: "string" },
            userName: { type: "string" },
            businessName: { type: "string" },
            businessType: { type: "string" },
            businessDescription: { type: "string" },
            competitors: { type: "string" },
            businessGoal: { type: "string" },
            targetScale: { type: "string" },
            timeline: { type: "string" },
          },
          required: ["anthropicKey", "userName", "businessType", "businessDescription"],
          additionalProperties: false,
        }),
        execute: async (data) => {
          try {
            const templateMap: Record<string, string> = {
              "e-commerce": "ecommerce", "ecommerce": "ecommerce",
              "agency": "agency", "agency / services": "agency",
              "saas": "saas", "saas / tech": "saas",
              "consulting": "consulting", "consulting / coaching": "consulting", "coaching": "consulting",
              "content creator": "content", "content": "content", "creator": "content",
              "content creator / info product": "content", "info product / course": "content", "info product": "content",
              "service-based": "service", "service": "service",
              "brick and mortar": "brick_and_mortar", "brick & mortar": "brick_and_mortar",
              "other": "agency", // Other uses the general-purpose agency template
            }
            // Strip emoji prefix from business type (e.g. "🏢 Agency" -> "agency")
            const cleanType = data.businessType.replace(/^[^\w]+/, "").trim().toLowerCase()
            const templateId = templateMap[cleanType] ?? "agency"

            // Use the host from the incoming request so this works in
            // production, preview, and local dev without env vars.
            const res = await fetch(`${selfBaseUrl}/api/onboarding`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                templateId,
                businessName: data.businessName ?? `${data.userName}'s Business`,
                ownerName: data.userName,
                businessDescription: data.businessDescription,
                businessGoal: data.businessGoal,
                targetScale: data.targetScale,
                timeline: data.timeline,
                competitors: data.competitors
                  ? data.competitors.split(",").map((c: string) => ({ label: c.trim(), url: c.trim() }))
                  : [],
                anthropicApiKey: data.anthropicKey,
              }),
            })

            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              return { success: false, error: (err as { error?: string }).error ?? "Onboarding failed" }
            }

            const result = await res.json()
            return {
              success: true,
              workspaceId: result.workspaceId,
              teams: result.teams,
              agents: result.agents,
              channels: result.channels,
              redirect: "/",
            }
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "Onboarding failed" }
          }
        },
      }),
    },
    maxOutputTokens: 800,
  })

  return result.toUIMessageStreamResponse()
}
