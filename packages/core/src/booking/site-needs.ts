import { z } from "zod";

// What a business needs at the customer's address to do a mobile job
// (Settings → Hours & rules → At the customer's address), stored as
// booking_settings.site_requirements:
//
//   { "water": true, "power": false }
//
// Missing (before migration 20261123120000_site_requirements.sql) or broken
// means nothing is required. When one is required, the booking form asks
// for it as a plain yes or no, a "no" can't book a mobile job, and the
// booking page's home says so up front.

export type SiteNeeds = { water: boolean; power: boolean };

export const NO_SITE_NEEDS: SiteNeeds = { water: false, power: false };

const siteNeedsSchema = z.object({
  water: z.boolean().catch(false),
  power: z.boolean().catch(false),
});

export function siteNeedsOf(raw: unknown): SiteNeeds {
  const parsed = siteNeedsSchema.safeParse(raw);
  return parsed.success ? parsed.data : NO_SITE_NEEDS;
}

export const hasSiteNeeds = (needs: SiteNeeds) => needs.water || needs.power;

// How each is put to customers, so the home page, the booking form and the
// refusal all say the same thing.
export const SITE_NEED_LABELS = {
  water: { thing: "an outside tap", short: "Outside tap", detail: "A tap we can connect a hose to" },
  power: { thing: "a power socket", short: "Power socket", detail: "A socket we can run a cable to from the car" },
} as const;

export type SiteNeed = keyof typeof SITE_NEED_LABELS;

export function requiredSiteNeeds(needs: SiteNeeds): SiteNeed[] {
  return (["water", "power"] as const).filter((k) => needs[k]);
}

// "an outside tap and a power socket", or null when nothing's required.
export function siteNeedsText(needs: SiteNeeds): string | null {
  const things = requiredSiteNeeds(needs).map((k) => SITE_NEED_LABELS[k].thing);
  return things.length ? things.join(" and ") : null;
}

// The first required thing the customer hasn't said yes to.
export function unmetSiteNeed(needs: SiteNeeds, access: { water?: string; power?: string } | undefined): SiteNeed | null {
  return requiredSiteNeeds(needs).find((k) => access?.[k] !== "yes") ?? null;
}
