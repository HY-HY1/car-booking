import { z } from "zod";

// Before and after photos on a service's page (Pricing → the service →
// Before and after): pairs of the same car before the visit and after it.
// Stored on the service as storage paths in the service-images bucket.

export const MAX_PAIRS = 6;
export const MAX_PAIR_CAPTION = 100;

export type BeforeAfterPair = { before: string; after: string; caption?: string };

const pairSchema = z.object({
  before: z.string().min(1),
  after: z.string().min(1),
  caption: z.string().trim().min(1).max(MAX_PAIR_CAPTION).optional().catch(undefined),
});

// One broken pair is dropped, never the service (its config parses with this).
export const beforeAfterSchema = z
  .array(z.unknown())
  .catch([])
  .transform((items): BeforeAfterPair[] =>
    items
      .flatMap((item) => {
        const parsed = pairSchema.safeParse(item);
        if (!parsed.success) return [];
        const { before, after, caption } = parsed.data;
        return [caption ? { before, after, caption } : { before, after }];
      })
      .slice(0, MAX_PAIRS),
  );

// A photo in the form: one already saved ("saved:<path>"), or a file sent
// with it ("new:<key>", the file as file_<key>).
export type PhotoRef = { kind: "saved"; path: string } | { kind: "new"; key: string };
export type PairPlan = { before: PhotoRef; after: PhotoRef; caption?: string };

const KEY = /^[a-z0-9-]{1,40}$/i;

function photoRef(value: string, known: ReadonlySet<string>): PhotoRef | null {
  const match = /^(saved|new):(.+)$/.exec(value);
  if (!match) return null;
  if (match[1] === "saved") return known.has(match[2]) ? { kind: "saved", path: match[2] } : null;
  return KEY.test(match[2]) ? { kind: "new", key: match[2] } : null;
}

// The form: a row per pair, in order, each sending before_<row>, after_<row>
// and caption_<row>. A pair missing a photo is an error on that row; a row
// with nothing at all is skipped. A saved photo is only kept if the service
// already has it, so the form can't slip in a picture from elsewhere.
export function parseBeforeAfterForm(
  rows: readonly string[],
  field: (name: string) => string,
  known: ReadonlySet<string>,
): { pairs: PairPlan[]; errors?: undefined } | { pairs?: undefined; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const pairs: PairPlan[] = [];
  rows.forEach((row, i) => {
    if (!KEY.test(row)) return;
    const before = photoRef(field(`before_${row}`), known);
    const after = photoRef(field(`after_${row}`), known);
    const caption = field(`caption_${row}`).trim().replace(/\s+/g, " ").slice(0, MAX_PAIR_CAPTION).trim();
    if (!before && !after) return;
    if (!before || !after) {
      errors[`pair_${i}`] = `Add ${before ? "an after" : "a before"} photo, or remove this pair.`;
      return;
    }
    pairs.push(caption ? { before, after, caption } : { before, after });
  });
  if (pairs.length > MAX_PAIRS) errors.pairs = `Up to ${MAX_PAIRS} pairs.`;
  return Object.keys(errors).length ? { errors } : { pairs };
}

// Every photo the pairs use: what a save may keep, and what's left to delete.
export function pairPaths(pairs: readonly BeforeAfterPair[]) {
  return pairs.flatMap((p) => [p.before, p.after]);
}
