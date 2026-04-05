import { ImageResponse } from "next/og"
import { db } from "@/lib/db"
import { evolutionEvents, agents } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { ARCHETYPES, TIER_STYLES, type ArchetypeId, type Tier } from "@/lib/archetypes"

const TIER_COLORS: Record<Tier, { bg: string; border: string; text: string; accent: string }> = {
  common:     { bg: "#1a1a1a", border: "#334155", text: "#cbd5e1", accent: "#64748b" },
  uncommon:   { bg: "#0b1a12", border: "#10b981", text: "#6ee7b7", accent: "#10b981" },
  rare:       { bg: "#0b1220", border: "#3b82f6", text: "#93c5fd", accent: "#3b82f6" },
  epic:       { bg: "#1a0b20", border: "#a855f7", text: "#d8b4fe", accent: "#a855f7" },
  legendary:  { bg: "#1a1208", border: "#f59e0b", text: "#fcd34d", accent: "#f59e0b" },
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const eventId = url.searchParams.get("id")
  if (!eventId) return new Response("id required", { status: 400 })

  const [event] = await db.select().from(evolutionEvents).where(eq(evolutionEvents.id, eventId)).limit(1)
  if (!event) return new Response("Not found", { status: 404 })

  const [agent] = await db.select().from(agents).where(eq(agents.id, event.agentId)).limit(1)
  if (!agent) return new Response("Agent not found", { status: 404 })

  const archetype = ARCHETYPES[(agent.archetype || "operator") as ArchetypeId] || ARCHETYPES.operator
  const tier = (agent.tier || "common") as Tier
  const colors = TIER_COLORS[tier] || TIER_COLORS.common

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, ${colors.bg} 0%, #000000 100%)`,
          padding: "60px",
          position: "relative",
        }}
      >
        {/* Border glow */}
        <div
          style={{
            position: "absolute",
            inset: "20px",
            border: `3px solid ${colors.border}`,
            borderRadius: "24px",
            pointerEvents: "none",
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "24px", color: colors.accent, fontWeight: 700, letterSpacing: "6px", textTransform: "uppercase" }}>
            ⚡ EVOLUTION
          </div>
        </div>

        {/* Agent name + archetype */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "40px" }}>
          <div style={{ fontSize: "72px", fontWeight: 900, color: "#ffffff", lineHeight: 1 }}>
            {agent.nickname || agent.name}
          </div>
          <div style={{ fontSize: "32px", color: colors.text, marginTop: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <span>{archetype.icon}</span>
            <span>{event.fromForm} → {event.toForm}</span>
          </div>
        </div>

        {/* Tier badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "48px",
            padding: "12px 24px",
            background: colors.bg,
            border: `2px solid ${colors.border}`,
            borderRadius: "100px",
            alignSelf: "flex-start",
          }}
        >
          <span style={{ fontSize: "20px", fontWeight: 700, color: colors.text, letterSpacing: "3px", textTransform: "uppercase" }}>
            {TIER_STYLES[tier].label}
          </span>
        </div>

        {/* Trigger */}
        <div style={{ marginTop: "56px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "18px", color: "#64748b", textTransform: "uppercase", letterSpacing: "2px" }}>
            Crossed
          </div>
          <div style={{ fontSize: "36px", color: "#ffffff", fontWeight: 700, marginTop: "8px" }}>
            {event.triggerValue.toLocaleString()} {event.triggerMetric.replace(/_/g, " ")}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "80px",
            right: "80px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "18px",
            color: "#475569",
            letterSpacing: "4px",
            textTransform: "uppercase",
          }}
        >
          <span>VESPR OS</span>
          <span>{new Date(event.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
