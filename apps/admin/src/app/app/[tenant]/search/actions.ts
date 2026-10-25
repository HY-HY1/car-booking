"use server";

import { formatDate } from "@leadgen/core/customer-fields";
import { requireTenant } from "@/lib/auth";
import { searchDashboard } from "@/lib/search";
import { appUrl } from "@/lib/urls";

export type LiveResult = {
  id: string;
  // Shown as "Customer: Harvey".
  kind: "Customer" | "Booking" | "Lead";
  label: string;
  detail?: string;
  href: string;
};

const SHOWN = { customers: 5, bookings: 4, leads: 3 };

// Powers the dropdown under the search box. Same lookup as the results page,
// trimmed to a few of each kind.
export async function liveSearchAction(slug: string, q: string): Promise<LiveResult[]> {
  const { tenant, can } = await requireTenant(slug);
  // Searching finds customers and enquiries, so it's office and up.
  if (!can("customers.view")) return [];
  const term = String(q ?? "").trim().slice(0, 100);
  if (term.length < 2) return [];

  const r = await searchDashboard(tenant.id, term);
  const base = appUrl(`/${slug}`);
  return [
    ...r.customers.slice(0, SHOWN.customers).map((c) => ({
      id: `c-${c.id}`,
      kind: "Customer" as const,
      label: c.name,
      detail: c.email ?? c.phone ?? c.postcode ?? undefined,
      href: `${base}/customers/${c.id}`,
    })),
    ...r.bookings.slice(0, SHOWN.bookings).map((b) => ({
      id: `b-${b.id}`,
      kind: "Booking" as const,
      label: [b.customer?.name, b.service?.name].filter(Boolean).join(" · ") || "Booking",
      detail: [formatDate(b.starts_at), b.postcode].filter(Boolean).join(" · "),
      href: `${base}/bookings/${b.id}`,
    })),
    ...r.leads.slice(0, SHOWN.leads).map((l) => ({
      id: `l-${l.id}`,
      kind: "Lead" as const,
      label: l.customer?.name ?? "Lead",
      detail: formatDate(l.created_at),
      href: `${base}/leads`,
    })),
  ];
}
