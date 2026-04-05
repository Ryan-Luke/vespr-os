import { ImageResponse } from "next/og"
import { db } from "@/lib/db"
import { trophyEvents } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const TYPE_ACCENTS: Record<string, { color: string; label: string }> = {
  deal_closed: { color: "#10b981", label: "DEAL CLOSED" },
  meeting_booked: { color: "#3b82f6", label: "MEETING BOOKED" },
  milestone: { color: "#f59e0b", label: "MILESTONE" },
  evolution: { color: "#a855f7", label: "EVOLUTION" },
  first: { color: "#f97316", label: "FIRST" },
  capability_unlocked: { color: "#06b6d4", label: "NEW CAPABILITY" },
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const eventId = url.searchParams.get("id")
  if (!eventId) return new Response("id required", { status: 400 })

  const [event] = await db.select().from(trophyEvents).where(eq(trophyEvents.id, eventId)).limit(1)
  if (!event) return new Response("Not found", { status: 404 })

  const accent = TYPE_ACCENTS[event.type] || { color: "#f59e0b", label: event.type.toUpperCase() }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, #0a0a0a 0%, #000000 100%)`,
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Border glow */}
        <div
          style={{
            position: "absolute",
            inset: "24px",
            border: `3px solid ${accent.color}`,
            borderRadius: "28px",
            opacity: 0.4,
            pointerEvents: "none",
          }}
        />

        {/* Type badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "22px",
            color: accent.color,
            fontWeight: 800,
            letterSpacing: "8px",
          }}
        >
          <div style={{ width: "48px", height: "3px", background: accent.color }} />
          <span>🏆 {accent.label}</span>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: "64px",
            fontWeight: 900,
            color: "#ffffff",
            marginTop: "56px",
            lineHeight: 1.1,
            maxWidth: "1040px",
          }}
        >
          {event.title}
        </div>

        {/* Description */}
        {event.description && (
          <div
            style={{
              display: "flex",
              fontSize: "28px",
              color: "#94a3b8",
              marginTop: "32px",
              lineHeight: 1.4,
              maxWidth: "1040px",
            }}
          >
            {event.description}
          </div>
        )}

        {/* Amount (if deal) */}
        {event.amount && (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              marginTop: "40px",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "96px", fontWeight: 900, color: accent.color, lineHeight: 1 }}>
              ${event.amount.toLocaleString()}
            </span>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            left: "104px",
            right: "104px",
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
          {event.agentName && <span>by {event.agentName}</span>}
          <span>{new Date(event.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
