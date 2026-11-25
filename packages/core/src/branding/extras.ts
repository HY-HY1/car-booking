import { z } from "zod";
import { formatPence, type DepositRule } from "../booking/config";
import { formatNotice, type CancellationPolicy } from "../settings/policy";

// Three extras on the booking pages, each switched on and worded in
// Settings → Booking page → Trust and enquiries. Kept in
// tenants.branding.extras, so no migration.
//
// - The deposit and cancellation line by the booking buttons, worked out
//   from the business's own rules unless the owner writes their own.
// - The jobs completed count in the hero, counted from finished bookings
//   (plus any the owner did before joining), shown once it's worth saying.
// - The enquiry page, for jobs the instant quote doesn't fit; each one
//   arrives under Leads.

export const MAX_POLICY_LINE = 120;
export const MAX_JOBS_LABEL = 40;
export const MAX_JOBS_BEFORE = 100_000;
export const MAX_ENQUIRY_INTRO = 300;
// The count stays hidden until there are at least this many: "3 cars
// cleaned" would put people off rather than reassure them.
export const JOBS_COUNT_MIN = 50;
export const DEFAULT_JOBS_LABEL = "jobs completed";

export type PageExtras = {
  policy_line: { show: boolean; text?: string };
  jobs_count: { show: boolean; label: string; before: number };
  enquiries: { show: boolean; intro?: string };
};

export const EXTRAS_DEFAULTS: PageExtras = {
  policy_line: { show: true },
  jobs_count: { show: false, label: DEFAULT_JOBS_LABEL, before: 0 },
  enquiries: { show: true },
};

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional().catch(undefined);

export const extrasSchema = z
  .object({
    policy_line: z
      .object({ show: z.boolean().catch(true), text: optionalText(MAX_POLICY_LINE) })
      .catch(EXTRAS_DEFAULTS.policy_line),
    jobs_count: z
      .object({
        show: z.boolean().catch(false),
        label: z.string().trim().min(1).max(MAX_JOBS_LABEL).catch(DEFAULT_JOBS_LABEL),
        before: z.number().int().min(0).max(MAX_JOBS_BEFORE).catch(0),
      })
      .catch(EXTRAS_DEFAULTS.jobs_count),
    enquiries: z.object({ show: z.boolean().catch(true), intro: optionalText(MAX_ENQUIRY_INTRO) }).catch(EXTRAS_DEFAULTS.enquiries),
  })
  .catch(EXTRAS_DEFAULTS);

// The line by the booking buttons, from the business's own rules:
// "£20 deposit · free cancellation up to 2 days before". Short, as it sits
// under a button; the terms page has the detail.
export function policySummary(deposit: DepositRule, policy: CancellationPolicy | null): string {
  const takesDeposit = deposit.type !== "none";
  const parts: string[] = [];
  if (deposit.type === "none") parts.push("No deposit");
  else if (deposit.type === "percent") parts.push(`${Math.round(deposit.value)}% deposit`);
  else if (deposit.type === "fixed") parts.push(`${formatPence(deposit.value_pence)} deposit`);
  else parts.push("Pay when you book");

  if (policy) {
    const notice = formatNotice(policy.cutoff_hours);
    if (!takesDeposit || policy.refund_before_cutoff === "full") {
      parts.push(policy.cutoff_hours === 0 ? "free cancellation any time" : `free cancellation up to ${notice}`);
    } else {
      parts.push(deposit.type === "full" ? "non-refundable" : "deposit non-refundable");
    }
  }
  const line = parts.join(" · ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

// What shows: the owner's own wording, or the summary.
export function policyLineText(extras: PageExtras, deposit: DepositRule | undefined, policy: CancellationPolicy | null) {
  if (!extras.policy_line.show) return null;
  if (extras.policy_line.text) return extras.policy_line.text;
  return deposit ? policySummary(deposit, policy) : null;
}

// A count rounded down to a tidy figure, so it reads as a milestone and
// never overstates: 437 → 400, 1,262 → 1,200, 72 → 70.
export function roundedDown(n: number) {
  const step = n < 100 ? 10 : n < 1000 ? 50 : 100;
  return Math.floor(n / step) * step;
}

// "400+ jobs completed", or null while it's off or under the minimum.
export function jobsCountText(extras: PageExtras, completed: number): string | null {
  const { show, label, before } = extras.jobs_count;
  const total = completed + before;
  if (!show || total < JOBS_COUNT_MIN) return null;
  return `${roundedDown(total).toLocaleString("en-GB")}+ ${label}`;
}
