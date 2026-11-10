// Working leads and how they're doing. No database access.

export const LOST_REASONS = {
  price: "Too expensive",
  went_elsewhere: "Went with someone else",
  no_reply: "Stopped replying",
  not_needed: "No longer needed",
  out_of_area: "Outside our area",
  other: "Other",
} as const;
export type LostReason = keyof typeof LOST_REASONS;

export const isLostReason = (value: unknown): value is LostReason => typeof value === "string" && Object.hasOwn(LOST_REASONS, value);

export type SourceRow = { source: string; total: number; booked: number; rate: number };

// Leads and how many booked, per place they came from, busiest first.
export function conversionBySource(leads: { source: string; status: string }[]): SourceRow[] {
  const bySource = new Map<string, { total: number; booked: number }>();
  for (const lead of leads) {
    const row = bySource.get(lead.source) ?? { total: 0, booked: 0 };
    row.total += 1;
    if (lead.status === "booked") row.booked += 1;
    bySource.set(lead.source, row);
  }
  return [...bySource.entries()]
    .map(([source, r]) => ({ source, ...r, rate: Math.round((r.booked / r.total) * 100) }))
    .sort((a, b) => b.total - a.total);
}

// How many leads were lost for each reason, most common first.
export function lostReasonCounts(leads: { status: string; lost_reason: string | null }[]) {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    if (lead.status !== "lost") continue;
    const reason = lead.lost_reason ?? "unknown";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}
