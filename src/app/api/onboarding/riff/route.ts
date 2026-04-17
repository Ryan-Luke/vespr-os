// Nova's contextual riff during onboarding.
// Uses the user's own Anthropic API key (passed in request) so the platform
// doesn't spend its own credits during setup. Generates a short, intelligent
// acknowledgment that references what the user just said, then transitions
// to the next question.

import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { withAuth } from "@/lib/auth/with-auth"

interface OnboardingContext {
  userName?: string
  businessName?: string
  businessType?: string
  businessDescription?: string
  competitors?: Array<{ label: string; url: string }>
  businessGoal?: string
  targetScale?: string
  timeline?: string
}

export async function POST(req: Request) {
  await withAuth()
  const { apiKey, stepJustAnswered, latestAnswer, nextQuestion, context } = await req.json() as {
    apiKey: string
    stepJustAnswered: string  // e.g. "business_name", "business_type"
    latestAnswer: string
    nextQuestion: string       // the static question to route to
    context: OnboardingContext
  }

  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    return Response.json({
      riff: "",
      nextQuestion,
      fallback: true,
    })
  }

  try {
    const anthropic = createAnthropic({ apiKey })

    const contextLines: string[] = []
    if (context.userName) contextLines.push(`User's name: ${context.userName}`)
    if (context.businessName) contextLines.push(`Business name: ${context.businessName}`)
    if (context.businessType) contextLines.push(`Business type: ${context.businessType}`)
    if (context.businessDescription) contextLines.push(`What the business does: ${context.businessDescription}`)
    if (context.competitors && context.competitors.length > 0) contextLines.push(`Competitors: ${context.competitors.map((c) => c.label).join(", ")}`)
    if (context.businessGoal) contextLines.push(`Goal: ${context.businessGoal}`)
    if (context.targetScale) contextLines.push(`Target scale: ${context.targetScale}`)
    if (context.timeline) contextLines.push(`Timeline: ${context.timeline}`)

    const result = await generateText({
      model: anthropic("claude-haiku-4-5"),
      system: `You are Nova, the Chief of Staff onboarding a new founder. Your job is to make the setup feel like a real conversation, not a form. You are smart, warm, sharp, direct. Think great COO.

Your task has TWO parts:

1. Write a short acknowledgment (1-2 sentences, under 240 chars) that shows you heard what the user said in a specific, non-generic way. No em dashes. No fancy punctuation. Short human sentences. Never start with "Great" or "Awesome". No emoji unless the user used one first.

2. Decide if the user's answer ALREADY covers the next question. Example: if the user said "200k in the next 12 months" and the next question is about timeline, that answer already covers timeline — no need to ask. Set covers_next to true. Be strict though: only set true if the answer genuinely answers the next topic.

Output STRICT JSON with exactly these fields and nothing else:
{"riff": "your acknowledgment text", "covers_next": true|false}

No markdown. No code fence. No commentary. Just the JSON object.`,
      prompt: `Context so far:
${contextLines.join("\n")}

The user just answered the "${stepJustAnswered}" question with: "${latestAnswer}"

The next question we need to ask is about: "${nextQuestion}"

Return the JSON.`,
      maxOutputTokens: 300,
    })

    // Parse the JSON. Be defensive: strip any accidental code fences and
    // fall back to the full text as the riff if JSON parse fails.
    let riff = ""
    let coversNext = false
    try {
      const cleaned = result.text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim()
      const parsed = JSON.parse(cleaned) as { riff?: string; covers_next?: boolean }
      riff = (parsed.riff ?? "").trim()
      coversNext = Boolean(parsed.covers_next)
    } catch {
      riff = result.text.trim()
      coversNext = false
    }

    return Response.json({
      riff,
      coversNext,
      fallback: false,
    })
  } catch (e) {
    return Response.json({
      riff: "",
      fallback: true,
      error: e instanceof Error ? e.message : "Unknown error",
    })
  }
}
