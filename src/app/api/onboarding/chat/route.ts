// Nova onboarding chat. Uses generateText (not streaming) for reliability.
// Returns a simple JSON response. No streaming protocol complexity.

import { generateText, tool, jsonSchema } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { anthropic as defaultAnthropic } from "@ai-sdk/anthropic"

export const maxDuration = 30

const SYSTEM_PROMPT = `You are Nova onboarding a new user. The user's FIRST message is their name. Acknowledge it warmly in one sentence, then ask about their business type.

Every response: [short acknowledgment]. [next question]?

Collect in this order (first one is already in their first message):
1. Name (first message)
2. Business type (ask "What type of business is it?" and nothing else. UI shows buttons.)
3. What the business does
4. Business name (skippable)
5. Competitors (skippable)
6. Goal
7. Target scale
8. Timeline

Accept "skip" or "none" for items 4-8. When you have name + type + description, call complete_onboarding. No em dashes. Never say Great or Awesome. Keep responses to 1-2 sentences. Always end with a question unless calling complete_onboarding.`

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export async function POST(req: Request) {
  const { messages, validatedApiKey } = await req.json() as {
    messages: ChatMessage[]
    validatedApiKey?: string
  }

  const host = req.headers.get("host") ?? "localhost:3000"
  const protocol = host.includes("localhost") ? "http" : "https"
  const selfBaseUrl = `${protocol}://${host}`

  const model = validatedApiKey
    ? createAnthropic({ apiKey: validatedApiKey })("claude-haiku-4-5")
    : defaultAnthropic("claude-haiku-4-5")

  try {
    const result = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: {
        complete_onboarding: tool({
          description: "Create the workspace. Call when you have name + business type + description.",
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
                "content creator": "content", "content": "content",
                "info product / course": "content", "info product": "content",
                "service-based": "service", "service": "service",
                "brick and mortar": "brick_and_mortar", "brick & mortar": "brick_and_mortar",
                "other": "agency",
              }
              const cleanType = data.businessType.replace(/^[^\w]+/, "").trim().toLowerCase()
              const templateId = templateMap[cleanType] ?? "agency"

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

              const onboardResult = await res.json()
              return { success: true, workspaceId: onboardResult.workspaceId }
            } catch (err) {
              return { success: false, error: err instanceof Error ? err.message : "Onboarding failed" }
            }
          },
        }),
      },
      maxOutputTokens: 800,
    })

    // Check if complete_onboarding was called by looking at step tool results
    let onboardingComplete = false
    let workspaceId: string | null = null
    for (const step of result.steps ?? []) {
      for (const tr of step.toolResults ?? []) {
        const res = tr as any
        if (res?.success) {
          onboardingComplete = true
          workspaceId = res?.workspaceId ?? null
        }
      }
    }

    return Response.json({
      response: result.text ?? "",
      onboardingComplete,
      workspaceId,
    })
  } catch (err) {
    return Response.json({
      response: "Something went wrong. Try sending your message again.",
      onboardingComplete: false,
      error: err instanceof Error ? err.message : "Unknown error",
    })
  }
}
