// Cal.com calendar client.
//
// Uses the Cal.com v2 API with API key auth.
//
// Docs: https://cal.com/docs/enterprise-features/api

import { getCredentials } from "@/lib/integrations/credentials"
import type {
  CalendarClient,
  CalendarAvailabilityInput,
  CalendarAvailabilitySlot,
  CalendarBookingInput,
  CalendarBooking,
} from "@/lib/integrations/capabilities/calendar"

const CALCOM_API = "https://api.cal.com/v2"

async function callCalCom<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = new URL(CALCOM_API + path)
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "cal-api-version": "2024-08-13",
      ...(init.headers ?? {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (payload as { message?: string })?.message ??
      (payload as { error?: string })?.error ??
      `Cal.com HTTP ${res.status}`
    throw new Error(`Cal.com API error: ${msg}`)
  }
  return payload as T
}

async function loadCalComKey(workspaceId: string): Promise<string> {
  const creds = await getCredentials(workspaceId, "calcom")
  if (!creds?.api_key) {
    throw new Error(
      "Cal.com is not connected for this workspace. Connect it via the integration picker first.",
    )
  }
  return creds.api_key
}

// ── Availability ─────────────────────────────────────────

async function getAvailability(
  workspaceId: string,
  input: CalendarAvailabilityInput,
): Promise<CalendarAvailabilitySlot[]> {
  const apiKey = await loadCalComKey(workspaceId)
  const params = new URLSearchParams({
    startTime: input.dateFrom,
    endTime: input.dateTo,
  })
  if (input.eventTypeId) {
    params.set("eventTypeId", String(input.eventTypeId))
  }

  const data = await callCalCom<{
    status: string
    data: {
      slots: Record<string, { time: string }[]>
    }
  }>(apiKey, `/slots?${params.toString()}`)

  const slots: CalendarAvailabilitySlot[] = []
  for (const [, daySlots] of Object.entries(data.data?.slots ?? {})) {
    for (const slot of daySlots) {
      slots.push({
        start: slot.time,
        end: slot.time, // Cal.com slots are start times; duration comes from event type
      })
    }
  }
  return slots
}

// ── Bookings ─────────────────────────────────────────────

interface CalComBookingRaw {
  id: number
  uid: string
  title?: string
  startTime?: string
  endTime?: string
  attendees?: { email: string; name?: string }[]
  status?: string
  metadata?: { videoCallUrl?: string }
}

function toCalendarBooking(raw: CalComBookingRaw): CalendarBooking {
  return {
    id: raw.id,
    uid: raw.uid,
    title: raw.title ?? "Booking",
    startTime: raw.startTime ?? "",
    endTime: raw.endTime ?? "",
    attendeeEmail: raw.attendees?.[0]?.email ?? "",
    status: raw.status ?? "PENDING",
    meetingUrl: raw.metadata?.videoCallUrl ?? null,
  }
}

async function createBooking(
  workspaceId: string,
  input: CalendarBookingInput,
): Promise<CalendarBooking> {
  const apiKey = await loadCalComKey(workspaceId)

  const data = await callCalCom<{ status: string; data: CalComBookingRaw }>(
    apiKey,
    "/bookings",
    {
      method: "POST",
      body: JSON.stringify({
        eventTypeId: input.eventTypeId,
        start: input.start,
        attendee: {
          name: input.name,
          email: input.email,
          timeZone: input.timeZone ?? "UTC",
        },
        notes: input.notes,
        metadata: input.metadata,
      }),
    },
  )

  return toCalendarBooking(data.data)
}

async function listBookings(workspaceId: string, limit: number): Promise<CalendarBooking[]> {
  const apiKey = await loadCalComKey(workspaceId)
  const clamped = Math.min(Math.max(limit, 1), 100)
  const data = await callCalCom<{ status: string; data: CalComBookingRaw[] }>(
    apiKey,
    `/bookings?limit=${clamped}&status=upcoming`,
  )
  return (data.data ?? []).map(toCalendarBooking)
}

async function cancelBooking(
  workspaceId: string,
  uid: string,
  reason?: string,
): Promise<{ ok: true }> {
  const apiKey = await loadCalComKey(workspaceId)
  await callCalCom(
    apiKey,
    `/bookings/${encodeURIComponent(uid)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        cancellationReason: reason ?? "Cancelled by agent",
      }),
    },
  )
  return { ok: true }
}

export const calcomClient: CalendarClient = {
  providerKey: "calcom",
  getAvailability,
  createBooking,
  listBookings,
  cancelBooking,
}
