// The events a webhook can be sent. No server imports, so the dashboard's
// forms can list them.

export const WEBHOOK_EVENTS = {
  "booking.created": "A booking is made (or a request comes in, if you approve bookings)",
  "booking.confirmed": "You approve a booking request",
  "booking.rescheduled": "A booking moves to another time",
  "booking.cancelled": "A booking is cancelled or declined",
  "booking.completed": "A job is marked done",
  "booking.no_show": "A job is marked as a no-show",
  "booking.updated": "Anything else about a booking changes (price, service, notes, payment)",
  "lead.created": "Someone leaves their details without booking yet",
} as const;

export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;
export const WEBHOOK_EVENT_KEYS = Object.keys(WEBHOOK_EVENTS) as WebhookEvent[];

export function isWebhookEvent(value: unknown): value is WebhookEvent {
  return typeof value === "string" && value in WEBHOOK_EVENTS;
}
