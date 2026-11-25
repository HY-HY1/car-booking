import { z } from "zod";

// What the booking page's reviews section shows (Reviews → Testimonials, and
// the Google reviews tab's "Show on booking page"): Google reviews the owner
// picked (or, with none picked, the newest good ones), and testimonials
// customers sent them some other way, typed in by the owner, optionally with
// the customer's picture and labelled photos of the car. Kept in
// tenants.branding.reviews, so no migration.
//
// Testimonials are never dressed up as Google reviews: they carry no stars
// (nobody gave a rating) and say where they came from. Each one is ticked as
// a real customer's own words when it's saved; UK law (the Digital Markets,
// Competition and Consumers Act 2024) bans fake and misleading reviews.

export const MAX_PINNED = 6;
export const MAX_TESTIMONIALS = 12;
// Cards in the section at most, Google ones first.
export const MAX_SHOWN = 6;
export const MAX_TESTIMONIAL_NAME = 60;
export const MAX_TESTIMONIAL_TEXT = 800;
export const MAX_TESTIMONIAL_PHOTOS = 4;
export const MAX_PHOTO_LABEL = 60;

// Where a testimonial came from, as the page says it.
export const TESTIMONIAL_SOURCES = {
  text: "Sent by text",
  email: "Sent by email",
  facebook: "On Facebook",
  instagram: "On Instagram",
  card: "In a card or letter",
  in_person: "Said in person",
} as const;
export type TestimonialSource = keyof typeof TESTIMONIAL_SOURCES;
const SOURCE_KEYS = Object.keys(TESTIMONIAL_SOURCES) as [TestimonialSource, ...TestimonialSource[]];

export type TestimonialPhoto = { url: string; label?: string };

export type Testimonial = {
  name: string;
  text: string;
  source?: TestimonialSource;
  // The customer's picture, with their permission. Unset shows their initial.
  avatar_url?: string;
  // Photos of the car, each with an optional label ("Before", "After").
  photos: TestimonialPhoto[];
};

export type ReviewSettings = {
  // The section on the home page at all.
  show: boolean;
  // Google reviews to quote (google_reviews ids), in order. Empty = automatic.
  pinned: string[];
  testimonials: Testimonial[];
};

export const REVIEW_DEFAULTS: ReviewSettings = { show: true, pinned: [], testimonials: [] };

const photoSchema = z.object({
  url: z.url(),
  label: z.string().trim().min(1).max(MAX_PHOTO_LABEL).optional().catch(undefined),
});

const testimonialSchema = z.object({
  name: z.string().trim().min(1).max(MAX_TESTIMONIAL_NAME),
  text: z.string().trim().min(1).max(MAX_TESTIMONIAL_TEXT),
  source: z.enum(SOURCE_KEYS).optional().catch(undefined),
  avatar_url: z.url().optional().catch(undefined),
  // One broken photo is dropped, not the testimonial.
  photos: z
    .array(z.unknown())
    .catch([])
    .transform((items): TestimonialPhoto[] =>
      items
        .flatMap((item) => {
          const parsed = photoSchema.safeParse(item);
          if (!parsed.success) return [];
          return [parsed.data.label ? { url: parsed.data.url, label: parsed.data.label } : { url: parsed.data.url }];
        })
        .slice(0, MAX_TESTIMONIAL_PHOTOS),
    ),
});

// Without the fields that aren't set, as it's stored.
function tidyTestimonial(t: Testimonial): Testimonial {
  return {
    name: t.name,
    text: t.text,
    ...(t.source && { source: t.source }),
    ...(t.avatar_url && { avatar_url: t.avatar_url }),
    photos: t.photos,
  };
}

export const reviewSettingsSchema = z
  .object({
    show: z.boolean().catch(true),
    pinned: z.array(z.uuid()).max(MAX_PINNED).catch([]),
    testimonials: z
      .array(z.unknown())
      .catch([])
      .transform((items): Testimonial[] =>
        items
          .flatMap((item) => {
            const parsed = testimonialSchema.safeParse(item);
            return parsed.success ? [tidyTestimonial(parsed.data)] : [];
          })
          .slice(0, MAX_TESTIMONIALS),
      ),
  })
  .catch(REVIEW_DEFAULTS);

// Every image the testimonials use: what a save may keep, and what it
// leaves behind to delete.
export function testimonialImages(testimonials: readonly Testimonial[]) {
  return testimonials.flatMap((t) => [...(t.avatar_url ? [t.avatar_url] : []), ...t.photos.map((p) => p.url)]);
}

// A Google review picked or unpicked on the Reviews page. Picking past the
// limit is refused (null) rather than dropping one the owner chose earlier.
export function togglePinned(pinned: readonly string[], id: string, show: boolean): string[] | null {
  const without = pinned.filter((p) => p !== id);
  if (!show) return without;
  if (pinned.includes(id)) return [...pinned];
  if (without.length >= MAX_PINNED) return null;
  return [...without, id];
}

// An image in the form: one already saved ("saved:<url>"), or a file sent
// with it ("new:<key>", the file as file_<key>).
export type ImageRef = { kind: "saved"; url: string } | { kind: "new"; key: string };

export type TestimonialPlan = Omit<Testimonial, "avatar_url" | "photos"> & {
  avatar: ImageRef | null;
  photos: { image: ImageRef; label?: string }[];
};

const KEY = /^[a-z0-9-]{1,40}$/i;

// "saved:<url>" or "new:<key>" → the image, or null if it isn't one this
// business already has (so the form can't slip in a picture from elsewhere).
function imageRef(value: string, known: ReadonlySet<string>): ImageRef | null {
  const match = /^(saved|new):(.+)$/.exec(value);
  if (!match) return null;
  if (match[1] === "saved") return known.has(match[2]) ? { kind: "saved", url: match[2] } : null;
  return KEY.test(match[2]) ? { kind: "new", key: match[2] } : null;
}

// The testimonials form. Each row sends a `row` key and its fields in order;
// `genuine` lists the keys of the rows ticked as real; `avatars` has one
// entry a row (blank for none); each row's photos come as photo_<row> and
// photo_label_<row>. A blank row is skipped. Errors are keyed by the row's
// place so the form can show them beside the right box.
export function parseTestimonialForm(
  input: {
    rows: readonly string[];
    names: readonly string[];
    texts: readonly string[];
    sources: readonly string[];
    genuine: readonly string[];
    avatars?: readonly string[];
    photos?: readonly { refs: readonly string[]; labels: readonly string[] }[];
  },
  // The images this business's testimonials already use.
  known: ReadonlySet<string> = new Set(),
): { testimonials: TestimonialPlan[]; errors?: undefined } | { testimonials?: undefined; errors: Record<string, string> } {
  const ticked = new Set(input.genuine);
  const errors: Record<string, string> = {};
  const testimonials: TestimonialPlan[] = [];
  input.rows.forEach((row, i) => {
    const name = (input.names[i] ?? "").trim().replace(/\s+/g, " ");
    const text = (input.texts[i] ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    const source = (SOURCE_KEYS as readonly string[]).includes(input.sources[i] ?? "") ? (input.sources[i] as TestimonialSource) : undefined;
    const avatar = imageRef(input.avatars?.[i] ?? "", known);
    const sent = input.photos?.[i] ?? { refs: [], labels: [] };
    const photos = sent.refs.flatMap((ref, p) => {
      const image = imageRef(ref, known);
      const label = (sent.labels[p] ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_PHOTO_LABEL).trim();
      return image ? [label ? { image, label } : { image }] : [];
    });
    if (!name && !text && !avatar && !photos.length) return;
    if (!name) errors[`name_${i}`] = "Add who said it, like Sarah, Cheltenham.";
    else if (name.length > MAX_TESTIMONIAL_NAME) errors[`name_${i}`] = `Keep the name under ${MAX_TESTIMONIAL_NAME} characters.`;
    if (!text) errors[`text_${i}`] = "Add what they said.";
    else if (text.length > MAX_TESTIMONIAL_TEXT) errors[`text_${i}`] = `Keep it under ${MAX_TESTIMONIAL_TEXT} characters.`;
    if (photos.length > MAX_TESTIMONIAL_PHOTOS) errors[`photos_${i}`] = `Up to ${MAX_TESTIMONIAL_PHOTOS} photos each.`;
    if (!ticked.has(row)) errors[`genuine_${i}`] = "Tick to confirm it's a real customer's own words.";
    if (!errors[`name_${i}`] && !errors[`text_${i}`] && !errors[`genuine_${i}`] && !errors[`photos_${i}`]) {
      testimonials.push({ name, text, ...(source && { source }), avatar, photos });
    }
  });
  if (testimonials.length > MAX_TESTIMONIALS) errors.testimonials = `You can add up to ${MAX_TESTIMONIALS}.`;
  return Object.keys(errors).length ? { errors } : { testimonials };
}
