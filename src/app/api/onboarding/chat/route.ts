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

const SYSTEM_PROMPT = `You are Nova, Chief of Staff. You are onboarding a new founder to their AI-powered business operating system. Your job is to have a natural, intelligent conversation to collect the information needed to set up their workspace and team.

You need to collect these items (in rough order):
1. Anthropic API key (starts with sk-ant-). This MUST come first. Without it nothing works. Tell them to get one at console.anthropic.com/settings/keys if they don't have it. Once they paste it, call validate_api_key immediately.
2. Their name
3. Business name (can skip)
4. Business type: e-commerce, agency, SaaS, consulting, content creator, service-based, or brick and mortar
5. What the business does (1-2 sentences)
6. Competitors they're watching (can skip)
7. Main business goal
8. Target scale (revenue, customers, market position)
9. Timeline to hit that target

RULES:
- Start with a short, warm greeting. "Hey, I'm Nova. I'll be your Chief of Staff." Then ask for the API key.
- Ask ONE thing at a time. Never dump a list of questions.
- If the user answers multiple things at once, acknowledge ALL of them and move to the next missing item. Never re-ask something they already told you.
- Example: if they say "200k in the next 12 months" that covers both target scale AND timeline. Acknowledge both and move on.
- Keep messages to 1-3 sentences. No em dashes. No fancy punctuation. Short human sentences.
- Show you're listening. Reference what they said specifically. "A fitness coaching business doing 50k a month, nice." Not "Great, thanks for sharing."
- Never start with "Great!" or "Awesome!" or "That's exciting!"
- Call extract_info EVERY TIME the user gives you new information. This saves it.
- When you have at minimum: validated API key + name + business type + description, call complete_onboarding.
- After complete_onboarding succeeds, tell them their team is being activated and they'll be redirected. Keep it short and confident.
- If complete_onboarding fails with "workspace already exists", tell them to go to /reset first and try again.`

export async function POST(req: Request) {
  const { messages } = await req.json() as { messages: UIMessage[] }

  // Onboarding always uses the platform's default key. The user's key
  // is validated via the validate_api_key tool and saved to the workspace
  // on complete_onboarding. A few onboarding messages on the platform key
  // is negligible cost.
  const model = defaultAnthropic("claude-haiku-4-5")

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
              "content creator": "content", "content": "content", "creator": "content", "content creator / info product": "content",
              "service-based": "service", "service": "service",
              "brick and mortar": "brick_and_mortar", "brick & mortar": "brick_and_mortar",
            }
            const templateId = templateMap[data.businessType.toLowerCase()] ?? "agency"

            // Build the onboarding URL. In production, use VERCEL_URL.
            const baseUrl = process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "http://localhost:3000"

            const res = await fetch(`${baseUrl}/api/onboarding`, {
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
    stopWhen: ({ steps }) => steps.length >= 4,
    maxOutputTokens: 400,
  })

  return result.toUIMessageStreamResponse()
}
