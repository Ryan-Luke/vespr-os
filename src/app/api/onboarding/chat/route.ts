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

const SYSTEM_PROMPT = `You are Nova, Chief of Staff. You are onboarding a new founder to their AI-powered business operating system. The API key is already connected. Your job is to have a natural, intelligent conversation to collect the information needed to set up their workspace and team.

You need to collect these items. Items marked OPTIONAL can be skipped.

REQUIRED:
1. Their name
2. Business type (the user will see clickable buttons for this, so just ask "What type of business is it?" and nothing else. Do NOT list the options in your message. The UI handles that.)
3. What the business does (1-2 sentences)

OPTIONAL (ask, but accept "skip", "none", "pass", "not sure", "later", or anything dismissive):
4. Business name (they might not have one yet)
5. Competitors they're watching
6. Main business goal
7. Target scale (revenue, customers, market position)
8. Timeline to hit that target

RULES:
- The user just connected their API key. Start by asking their name. Keep it warm and brief. One sentence.
- Ask ONE thing at a time. Never dump a list of questions.
- For OPTIONAL items, phrase the question so it's clear they can skip. Examples: "Do you have a business name yet, or still working on that?" or "Any competitors you're keeping an eye on? Totally fine to skip this one."
- If someone says skip, none, not yet, pass, not sure, or anything similar, accept it immediately and move on. Don't push. Don't ask "are you sure?"
- If the user answers multiple things at once, acknowledge ALL of them and move to the next missing item. Never re-ask something they already told you.
- Example: if they say "200k in the next 12 months" that covers both target scale AND timeline. Acknowledge both and move on.
- Keep messages to 1-3 sentences. No em dashes. No fancy punctuation. Short human sentences.
- Show you're listening. Reference what they said specifically. "A fitness coaching business doing 50k a month, nice." Not "Great, thanks for sharing."
- Never start with "Great!" or "Awesome!" or "That's exciting!"
- Call extract_info EVERY TIME the user gives you new information. This saves it.
- When you have at minimum the 3 REQUIRED items (name + business type + description), call complete_onboarding. Don't wait for all optional items. If the user seems ready to go, launch it.
- After complete_onboarding succeeds, tell them their team is being activated and they'll be redirected. Keep it short and confident.
- If complete_onboarding fails with "workspace already exists", tell them to go to /reset first and try again.`

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

      extract_info: tool({
        description: "Save business information the user just shared. Call this EVERY TIME the user provides any new info (name, business type, description, goal, etc). Only include fields that were actually mentioned in the user's latest message.",
        inputSchema: jsonSchema<{
          userName?: string
          businessName?: string
          businessType?: string
          businessDescription?: string
          competitors?: string
          businessGoal?: string
          targetScale?: string
          timeline?: string
        }>({
          type: "object",
          properties: {
            userName: { type: "string" },
            businessName: { type: "string" },
            businessType: { type: "string" },
            businessDescription: { type: "string" },
            competitors: { type: "string" },
            businessGoal: { type: "string" },
            targetScale: { type: "string" },
            timeline: { type: "string" },
          },
          additionalProperties: false,
        }),
        execute: async (info) => ({ ...info, saved: true }),
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
    // Nova needs room for: extract_info tool call + text response + possible
    // complete_onboarding call. 10 steps gives plenty of headroom.
    stopWhen: ({ steps }) => steps.length >= 10,
    maxOutputTokens: 600,
  })

  return result.toUIMessageStreamResponse()
}
