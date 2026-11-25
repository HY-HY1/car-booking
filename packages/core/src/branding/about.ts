import { z } from "zod";

// Who's behind the business, what they'd want customers to know, and photos
// of their work: what makes the booking page's home read as theirs rather
// than as a booking system's (Settings → Booking page → About you, and →
// Photos of your work). Kept in tenants.branding, so no migration: a missing
// or broken value falls back to nothing shown instead of failing.

export const MAX_FACTS = 4;
export const MAX_FACT_LENGTH = 40;
export const MAX_OWNER_NAME = 60;
export const MAX_ABOUT_HEADING = 80;
export const MAX_ABOUT_TEXT = 1500;
export const MAX_GALLERY = 12;
export const MAX_CAPTION = 80;

export type About = {
  // As customers know them: "Dan", "Dan and Sophie".
  name?: string;
  // Over the story. Unset is "Meet <name>", or "About <business>".
  heading?: string;
  // The story, in the owner's words. Blank lines split it into paragraphs.
  text?: string;
  photo_url?: string;
  // Short things customers look for, shown under the main heading:
  // "Fully insured", "10 years' experience".
  facts: string[];
};

export const ABOUT_DEFAULTS: About = { facts: [] };

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional().catch(undefined);

export const aboutSchema = z
  .object({
    name: optionalText(MAX_OWNER_NAME),
    heading: optionalText(MAX_ABOUT_HEADING),
    text: optionalText(MAX_ABOUT_TEXT),
    photo_url: z.url().optional().catch(undefined),
    facts: z.array(z.string().trim().min(1).max(MAX_FACT_LENGTH)).max(MAX_FACTS).catch([]),
  })
  .catch(ABOUT_DEFAULTS);

export type GalleryPhoto = { url: string; caption?: string };

const photoSchema = z.object({ url: z.url(), caption: optionalText(MAX_CAPTION) });

// One broken photo is dropped, not the whole gallery.
export const gallerySchema = z
  .array(z.unknown())
  .catch([])
  .transform((items): GalleryPhoto[] =>
    items.flatMap((item) => {
      const parsed = photoSchema.safeParse(item);
      if (!parsed.success) return [];
      const { url, caption } = parsed.data;
      return [caption ? { url, caption } : { url }];
    }).slice(0, MAX_GALLERY),
  );

// The heading over the story on the home page.
export function aboutHeading(about: About, businessName: string) {
  return about.heading?.trim() || (about.name?.trim() ? `Meet ${about.name.trim()}` : `About ${businessName}`);
}

// The story's paragraphs: split at blank lines. A single line break inside
// one is kept (the page shows it as a break), so a short list survives.
export function aboutParagraphs(text: string | undefined) {
  return (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// The facts as typed into their boxes: trimmed, spaces tidied, blanks and
// repeats (ignoring case) taken out, each cut to length, at most MAX_FACTS.
export function cleanFacts(values: readonly string[]) {
  const seen = new Set<string>();
  const facts: string[] = [];
  for (const value of values) {
    const fact = value.trim().replace(/\s+/g, " ").slice(0, MAX_FACT_LENGTH).trim();
    const key = fact.toLowerCase();
    if (!fact || seen.has(key)) continue;
    seen.add(key);
    facts.push(fact);
    if (facts.length === MAX_FACTS) break;
  }
  return facts;
}

// What the gallery form sends, as the photos to keep or add, in order. Each
// row is "saved:<url>" (a photo already in the gallery) or "new:<key>" (a
// file sent as file_<key>), with its caption at the same place in
// `captions`. A saved URL that isn't in the gallery now is ignored, so the
// form can't slip in a picture from elsewhere; repeats are ignored too.
export type GalleryRow = { kind: "saved"; url: string; caption?: string } | { kind: "new"; key: string; caption?: string };

export function galleryRows(rows: readonly string[], captions: readonly string[], current: readonly GalleryPhoto[]): GalleryRow[] {
  const known = new Set(current.map((p) => p.url));
  const used = new Set<string>();
  const result: GalleryRow[] = [];
  rows.forEach((row, i) => {
    if (result.length >= MAX_GALLERY) return;
    const caption = (captions[i] ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_CAPTION).trim() || undefined;
    const match = /^(saved|new):(.+)$/.exec(row);
    if (!match) return;
    const [, kind, value] = match;
    if (used.has(row)) return;
    if (kind === "saved" && !known.has(value)) return;
    if (kind === "new" && !/^[a-z0-9-]{1,40}$/i.test(value)) return;
    used.add(row);
    result.push(kind === "saved" ? { kind, url: value, caption } : { kind: "new", key: value, caption });
  });
  return result;
}
