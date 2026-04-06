// Nova onboarding chat. Uses generateText (not streaming) for reliability.
// Returns a simple JSON response. No streaming protocol complexity.

import { generateText, tool, jsonSchema } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { anthropic as defaultAnthropic } from "@ai-sdk/anthropic"

export const maxDuration = 30

const SYSTEM_PROMPT = `You are Nova, a warm and sharp Chief of Staff onboarding a new founder. Be friendly, excited, and human. You genuinely care about their business and you're pumped to help them build it.

The user's FIRST message is their name. Welcome them by name with real warmth. Then ask about their business type.

Every response: [warm acknowledgment that shows you care]. [next question]?

Collect in this order:
1. Name (first message)
2. Business type (ask "What type of business is it?" and nothing else. UI shows buttons.)
3. What the business does (if they say "not sure yet" or skip, accept it and move on)
4. Business name (skippable, say "totally fine" if they skip)
5. Competitors (skippable. UI shows input for Instagram handles or websites.)
6. Revenue or growth goal. Ask something specific like "What revenue are you targeting?" or "What does success look like in the next 12 months? Give me a number." Push for a concrete number, not a vague answer.
7. Timeline to hit that goal. Ask separately: "By when?"

Accept "skip", "not sure yet", "none", "pass" for any item. Move on immediately. Don't push.

When you have at minimum name + type, call complete_onboarding with everything collected. Pass the validated API key.

After complete_onboarding succeeds, tell them: "Your team is being activated right now. First up, you'll meet your Head of Research and Development. They'll help you build out and validate your offer. You're going to love this."

Tone: like a sharp friend who just joined your startup and is pumped to get to work. No em dashes. Never start with "Great!" or "Awesome!". Short sentences. 1-3 sentences per response. Always end with a question unless calling complete_onboarding.`

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
          description: "Create the workspace. Call when you have name + business type. The API key is injected automatically, do NOT ask the user for it.",
          inputSchema: jsonSchema<{
            userName: string
            businessName?: string
            businessType: string
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
            required: ["userName", "businessType"],
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

              // Call the onboarding POST handler directly. No self-fetch.
              // Self-fetch was broken by Vercel Deployment Protection.
              const { POST: onboardingPost } = await import("@/app/api/onboarding/route")
              const fakeRequest = new Request("http://localhost/api/onboarding", {
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
                  anthropicApiKey: validatedApiKey ?? "",
                }),
              })
              const res = await onboardingPost(fakeRequest)
              const onboardResult = await res.json()

              if (!onboardResult.success && !onboardResult.workspaceId) {
                return { success: false, error: onboardResult.error ?? "Onboarding failed" }
              }
              return { success: true, workspaceId: onboardResult.workspaceId }
            } catch (err) {
              return { success: false, error: err instanceof Error ? err.message : "Onboarding failed" }
            }
          },
        }),
      },
      maxOutputTokens: 800,
    })

    // Check if complete_onboarding was called THIS turn by looking for
    // the tool name in the result. Don't check the DB because a leftover
    // workspace from a previous attempt would trigger false completion.
    let onboardingComplete = false
    const toolCalls = result.toolCalls ?? []
    for (const tc of toolCalls) {
      if ((tc as any).toolName === "complete_onboarding") {
        onboardingComplete = true
      }
    }
    // Also check steps for multi-step tool calls
    for (const step of result.steps ?? []) {
      for (const tc of step.toolCalls ?? []) {
        if ((tc as any).toolName === "complete_onboarding") {
          onboardingComplete = true
        }
      }
    }

    return Response.json({
      response: result.text ?? "",
      onboardingComplete,
    })
  } catch (err) {
    return Response.json({
      response: "Something went wrong. Try sending your message again.",
      onboardingComplete: false,
      error: err instanceof Error ? err.message : "Unknown error",
    })
  }
}
