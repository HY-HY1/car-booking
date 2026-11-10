// The activity log's vocabulary, with no database access so pages and tests
// can use it. An action is its area and what happened: "booking.cancelled".

export const ACTIVITY_AREAS = {
  booking: "Bookings",
  payment: "Payments",
  customer: "Customers",
  pricing: "Pricing",
  settings: "Settings",
  team: "Team",
  account: "Logins",
} as const;

export type ActivityArea = keyof typeof ACTIVITY_AREAS;
export type ActivityAction = `${ActivityArea}.${string}`;
export type ActivityEntity = { type: "booking" | "customer"; id: string };

export function parseActivityArea(value: unknown): ActivityArea | null {
  return typeof value === "string" && Object.hasOwn(ACTIVITY_AREAS, value) ? (value as ActivityArea) : null;
}

export const ACTIVITY_RETENTION_MONTHS = 24;
