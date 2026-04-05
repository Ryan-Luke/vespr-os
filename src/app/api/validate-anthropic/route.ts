// Validates an Anthropic API key by making a cheap test call.
// Used during onboarding to confirm the user's key works before saving it.

export async function POST(req: Request) {
  const { apiKey } = await req.json() as { apiKey: string }
  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    return Response.json({ valid: false, error: "Key must start with sk-ant-" })
  }

  try {
    // Hit Anthropic's /v1/models endpoint — cheapest validation call,
    // no generation cost. Just confirms the key is authorized.
    const res = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    })

    if (res.ok) {
      return Response.json({ valid: true })
    }

    if (res.status === 401) {
      return Response.json({ valid: false, error: "Key is invalid or revoked" })
    }

    const body = await res.text().catch(() => "")
    return Response.json({ valid: false, error: `Anthropic returned ${res.status}: ${body.slice(0, 200)}` })
  } catch (e) {
    return Response.json({ valid: false, error: "Couldn't reach Anthropic. Check your network and try again." })
  }
}
