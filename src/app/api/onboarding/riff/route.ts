// Nova's contextual riff during onboarding.
// Uses the user's own Anthropic API key (passed in request) so the platform
// doesn't spend its own credits during setup. Generates a short, intelligent
// acknowledgment that references what the user just said, then transitions
// to the next question.

import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"

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
      system: `You are Nova, the Chief of Staff onboarding a new founder to VESPR OS. Your job is to make the setup conversation feel intelligent and personal — not like a form.

Rules:
- Write ONE short acknowledgment (1-2 sentences max) that references what the user JUST said in a specific, non-generic way. Show you heard them.
- Then transition naturally into the next question.
- Do NOT repeat the next question word-for-word. Paraphrase it to fit the conversation flow.
- Tone: warm, sharp, direct. Like a great COO. No emoji unless the user used one first.
- Never start with "Great!" or "Awesome!" — those are lazy.
- Reference prior context when relevant (e.g. if you already know the business name, use it).
- Keep it under 240 characters total.

Output format: just the message text. No labels, no JSON, no prefixes.`,
      prompt: `Context so far:
${contextLines.join("\n")}

The user just answered the "${stepJustAnswered}" question with: "${latestAnswer}"

The next question we need to ask is about: "${nextQuestion}"

Write Nova's acknowledgment + transition into the next topic.`,
      maxOutputTokens: 200,
    })

    return Response.json({
      riff: result.text.trim(),
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
