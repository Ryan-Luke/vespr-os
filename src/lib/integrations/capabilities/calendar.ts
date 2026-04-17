// Calendar capability. Agents can check availability and draft booking
// requests for approval. Booking meetings is approval-gated because
// it creates real calendar events and sends invites to external people.

import { listIntegrations } from "@/lib/integrations/credentials"

export interface CalendarAvailabilitySlot {
  start: string   // ISO datetime
  end: string     // ISO datetime
}

export interface CalendarAvailabilityInput {
  dateFrom: string   // ISO date (YYYY-MM-DD)
  dateTo: string     // ISO date (YYYY-MM-DD)
  eventTypeId?: number
}

export interface CalendarBookingInput {
  eventTypeId: number
  start: string           // ISO datetime
  name: string            // attendee name
  email: string           // attendee email
  notes?: string          // booking notes
  timeZone?: string       // defaults to UTC
  metadata?: Record<string, string>
}

export interface CalendarBooking {
  id: number
  uid: string
  title: string
  startTime: string    // ISO
  endTime: string      // ISO
  attendeeEmail: string
  status: string       // "ACCEPTED", "PENDING", "CANCELLED"
  meetingUrl: string | null
}

export interface CalendarClient {
  providerKey: string

  /**
   * Get available time slots for a date range. Read-only, no approval needed.
   */
  getAvailability(workspaceId: string, input: CalendarAvailabilityInput): Promise<CalendarAvailabilitySlot[]>

  /**
   * Create a booking. Called ONLY by the approval executor.
   */
  createBooking(workspaceId: string, input: CalendarBookingInput): Promise<CalendarBooking>

  /**
   * List upcoming bookings. Read-only.
   */
  listBookings(workspaceId: string, limit: number): Promise<CalendarBooking[]>

  /**
   * Cancel a booking by UID. Called ONLY by the approval executor.
   */
  cancelBooking(workspaceId: string, uid: string, reason?: string): Promise<{ ok: true }>
}

const CALENDAR_PROVIDER_KEYS = ["calcom"] as const
export type CalendarProviderKey = typeof CALENDAR_PROVIDER_KEYS[number]

export async function getConnectedCalendarKey(workspaceId: string): Promise<CalendarProviderKey | null> {
  const connected = await listIntegrations(workspaceId)
  const connectedKeys = new Set(
    connected.filter((i) => i.status === "connected").map((i) => i.providerKey),
  )
  for (const key of CALENDAR_PROVIDER_KEYS) {
    if (connectedKeys.has(key)) return key
  }
  return null
}

export async function getCalendarClient(workspaceId: string): Promise<CalendarClient | null> {
  const key = await getConnectedCalendarKey(workspaceId)
  if (!key) return null
  switch (key) {
    case "calcom":
      return (await import("@/lib/integrations/clients/calcom")).calcomClient
    default:
      return null
  }
}
