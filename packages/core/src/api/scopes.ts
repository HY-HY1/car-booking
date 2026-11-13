import type { Scope } from "./types";

// What an API key may do. No server imports: the dashboard's key form and the
// docs list these. Keep in step with the api_keys_scopes_check constraint
// (supabase/migrations/20261113120000_api_v1.sql).

export const API_SCOPES: Record<Scope, { label: string; detail: string; personal: boolean }> = {
  "catalog:read": {
    label: "Services, prices and availability",
    detail: "Business details, the catalogue, quotes, the service area and free times. No customer details.",
    personal: false,
  },
  "bookings:read": {
    label: "Read bookings",
    detail: "Bookings, with each customer's name, contact details and address.",
    personal: true,
  },
  "customers:read": {
    label: "Read customers",
    detail: "Your customer list, with contact details, vehicles and marketing choices.",
    personal: true,
  },
  "leads:read": {
    label: "Read enquiries",
    detail: "Enquiries from people who haven't booked yet, with their contact details.",
    personal: true,
  },
  "leads:write": {
    label: "Add enquiries",
    detail: "Send enquiries from a form on your own website into your dashboard.",
    personal: true,
  },
  "webhooks:write": {
    label: "Manage webhooks",
    detail: "Add and remove webhooks, for tools such as Zapier. Webhooks carry booking and customer details.",
    personal: true,
  },
};

export const SCOPE_KEYS = Object.keys(API_SCOPES) as Scope[];
export const DEFAULT_SCOPES: Scope[] = ["catalog:read"];

export function isScope(value: unknown): value is Scope {
  return typeof value === "string" && value in API_SCOPES;
}

// The scopes from a form or a stored row: known ones only, in the usual
// order, never empty.
export function cleanScopes(values: unknown[]): Scope[] {
  const picked = SCOPE_KEYS.filter((s) => values.includes(s));
  return picked.length ? picked : DEFAULT_SCOPES;
}
