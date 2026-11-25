import { z } from "zod";

// How a business's booking site shows up in search results and when its
// link is shared (Settings → Booking page → Search and sharing). Kept in
// tenants.branding.seo, so no migration. Everything has a sensible default
// made from what the business has already set up; the owner only needs to
// touch it to say it their way.

export const MAX_SEO_TITLE = 70;
export const MAX_SEO_DESCRIPTION = 160;
// Roughly what Google shows before cutting off, for the counters.
export const TITLE_SHOWN = 60;
export const DESCRIPTION_SHOWN = 155;

export type SeoSettings = {
  // The home page's title and description in search results.
  title?: string;
  description?: string;
  // The picture when the link is shared. Unset uses the cover image.
  share_image_url?: string;
  // The browser tab icon, a square PNG. Unset makes one from the logo or
  // the business's initial.
  icon_url?: string;
  // Google Search Console's HTML tag code, proving the site is theirs.
  google_verification?: string;
  // Keep the whole site out of search engines.
  hidden: boolean;
};

export const SEO_DEFAULTS: SeoSettings = { hidden: false };

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional().catch(undefined);
const VERIFICATION = /^[A-Za-z0-9_-]{10,100}$/;

export const seoSchema = z
  .object({
    title: optionalText(MAX_SEO_TITLE),
    description: optionalText(MAX_SEO_DESCRIPTION),
    share_image_url: z.url().optional().catch(undefined),
    icon_url: z.url().optional().catch(undefined),
    google_verification: z.string().regex(VERIFICATION).optional().catch(undefined),
    hidden: z.boolean().catch(false),
  })
  .catch(SEO_DEFAULTS);

// What Search Console gives: the whole tag (<meta name="google-site-
// verification" content="abc…" />) or just the code. Either way, the code;
// null if it isn't one.
export function parseVerification(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const fromTag = /content\s*=\s*["']([^"']+)["']/i.exec(text)?.[1]?.trim();
  const code = fromTag ?? text;
  return VERIFICATION.test(code) ? code : null;
}

const TRADE_PHRASE: Record<string, string> = {
  detailing: "car detailing",
  valeting: "car valeting",
  both: "car valeting and detailing",
};

// "Cheltenham", "Cheltenham and Gloucester", "Cheltenham, Gloucester and Stroud".
function placeList(places: readonly string[]) {
  if (places.length <= 1) return places[0] ?? "";
  return `${places.slice(0, -1).join(", ")} and ${places[places.length - 1]}`;
}

// Cut at a word, with an ellipsis, if it's over the limit.
function fit(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).replace(/[\s,.;:–-]+$/, "")}…`;
}

// The title and description when the owner hasn't written their own, from
// what the business does, where, and its tagline:
//   "ASCND · Mobile car detailing in Cheltenham"
//   "Mobile car detailing in Cheltenham and Gloucester. See your price and
//    book online in a couple of minutes."
//   "Showroom shine, on your drive. Covering Cheltenham. See your price and
//    book online." (with a tagline)
export function seoDefaults(input: {
  name: string;
  trade: string | null;
  mobile: boolean;
  unit: boolean;
  // The places the business lists as covered, in the owner's order.
  places: readonly string[];
  tagline?: string | null;
}): { title: string; description: string } {
  const phrase = TRADE_PHRASE[input.trade ?? ""] ?? "car valeting and detailing";
  const what = input.mobile ? `Mobile ${phrase}` : phrase.charAt(0).toUpperCase() + phrase.slice(1);
  const first = input.places[0];
  const title = fit(`${input.name} · ${what}${first ? ` in ${first}` : ""}`, MAX_SEO_TITLE);

  const tagline = input.tagline?.trim().replace(/[.!]*$/, "");
  const shown = input.places.slice(0, 3);
  // "A and B", or with more than fit, "A, B, C and nearby".
  const places = input.places.length > 3 ? `${shown.join(", ")} and nearby` : placeList(shown);
  // With a tagline it leads, so the description doesn't say the same thing twice.
  const description = tagline
    ? `${tagline}.${places ? ` Covering ${places}.` : ""} See your price and book online.`
    : `${what}${places ? ` in ${places}` : ""}${input.unit && input.mobile ? ", or drop your car off with us" : ""}. See your price and book online in a couple of minutes.`;
  return { title, description: fit(description, MAX_SEO_DESCRIPTION) };
}
