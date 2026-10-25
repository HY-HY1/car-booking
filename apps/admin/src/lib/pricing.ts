import { z } from "zod";
import { conditionTierSchema } from "@leadgen/core/booking/config";
import {
  editableAddOnSchema,
  editableServiceSchema,
  pricingRulesSchema,
  SIZES,
  slugify,
} from "@/lib/pricing-fields";
import { createClient } from "@/lib/supabase/server";

// Pricing editor: loading the tenant's services, extras and pricing rules,
// and turning the editor's form posts into rows. The booking app reads the
// same rows on every page load and prices them with the same getQuote(), so
// a save here is what customers are quoted from the next page they open.

export async function loadPricing(tenantId: string) {
  const supabase = await createClient();
  const [settings, services, addOns] = await Promise.all([
    supabase
      .from("booking_settings")
      .select("deposit, min_price_pence, mobile_surcharge_pence, condition_tiers, offers_mobile, offers_unit")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, name, description, tagline, includes, image_path, slug, badge, body, not_included, gallery, steps, faqs, seo_title, seo_description, duration_mins, base_price_pence, size_adjustments, location_types, active, sort_order")
      .eq("tenant_id", tenantId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("add_ons")
      .select("id, name, description, price_pence, duration_mins, service_ids, active, sort_order")
      .eq("tenant_id", tenantId)
      .order("sort_order")
      .order("name"),
  ]);
  if (settings.error) throw settings.error;
  if (services.error) throw services.error;
  if (addOns.error) throw addOns.error;

  return {
    rules: settings.data ? pricingRulesSchema.parse(settings.data) : null,
    services: z.array(editableServiceSchema).parse(services.data),
    addOns: z.array(editableAddOnSchema).parse(addOns.data),
  };
}

// ------------------------------------------------------------------ form parsing

// "45", "45.5", "£1,045.50" → pence. Empty is an error unless optional.
function pounds(label: string, { optional = false } = {}) {
  return z
    .string()
    .trim()
    .transform((v) => v.replace(/[£,\s]/g, ""))
    .refine((v) => (optional && v === "") || /^\d+(\.\d{1,2})?$/.test(v), {
      message: optional ? `Enter ${label} in pounds, or leave it blank.` : `Enter ${label} in pounds, like 45 or 45.50.`,
    })
    .transform((v) => (v === "" ? 0 : Math.round(Number(v) * 100)));
}

function wholeNumber(label: string, { min = 0, max = 100_000, optional = false } = {}) {
  return z
    .string()
    .trim()
    .refine((v) => (optional && v === "") || (/^\d+$/.test(v) && +v >= min && +v <= max), {
      message: `${label} must be a whole number from ${min} to ${max}.`,
    })
    .transform((v) => (v === "" ? 0 : Number(v)));
}

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null);

const sizeFields = Object.fromEntries(
  SIZES.flatMap((size) => [
    [`size_${size}_price`, pounds(`the ${size} surcharge`, { optional: true })],
    [`size_${size}_mins`, wholeNumber("Extra minutes", { max: 600, optional: true })],
  ]),
) as Record<string, ReturnType<typeof pounds>>;

// A textarea with one item per line.
function lines(tooMany: string) {
  return z
    .string()
    .transform((v) => v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(120, "Keep each line under 120 characters.")).max(20, tooMany));
}

// A list the editor posts as one JSON field.
function jsonList<T extends z.ZodType>(item: T, max: number, tooMany: string) {
  return z
    .string()
    .default("[]")
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "That list couldn't be read. Reload and try again." });
        return z.NEVER;
      }
    })
    .pipe(z.array(item).max(max, tooMany));
}

export const serviceFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(100),
    description: optionalText,
    tagline: optionalText.pipe(z.string().max(140, "Keep the tagline under 140 characters.").nullable()),
    slug: z.string().trim().toLowerCase(),
    badge: optionalText.pipe(z.string().max(24, "Keep the badge under 24 characters.").nullable()),
    body: optionalText.pipe(z.string().max(5000, "Keep this under 5,000 characters.").nullable()),
    includes: lines("Up to 20 lines."),
    not_included: lines("Up to 20 lines."),
    steps: jsonList(z.object({ title: z.string().trim().max(80), text: z.string().trim().max(400) }), 10, "Up to 10 steps."),
    faqs: jsonList(z.object({ q: z.string().trim().max(160), a: z.string().trim().max(1000) }), 15, "Up to 15 questions."),
    seo_title: optionalText.pipe(z.string().max(70, "Keep the page title under 70 characters.").nullable()),
    seo_description: optionalText.pipe(z.string().max(160, "Keep the page summary under 160 characters.").nullable()),
    base_price: pounds("a price"),
    duration_mins: wholeNumber("Duration", { min: 15, max: 1440 }),
    location_mobile: checkbox,
    location_unit: checkbox,
    active: checkbox,
    sort_order: wholeNumber("Order", { max: 1000, optional: true }),
    ...sizeFields,
  })
  .superRefine((s, ctx) => {
    if (s.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.slug)) {
      ctx.addIssue({ code: "custom", path: ["slug"], message: "Use letters, numbers and single dashes only." });
    }
    if (!s.location_mobile && !s.location_unit) {
      ctx.addIssue({ code: "custom", path: ["location_mobile"], message: "Pick at least one place it can be done." });
    }
  })
  .transform((s) => ({
    name: s.name,
    description: s.description,
    tagline: s.tagline,
    slug: s.slug || slugify(s.name) || "service",
    badge: s.badge,
    body: s.body,
    includes: s.includes,
    not_included: s.not_included,
    steps: s.steps.filter((x) => x.title || x.text),
    faqs: s.faqs.filter((x) => x.q && x.a),
    seo_title: s.seo_title,
    seo_description: s.seo_description,
    base_price_pence: s.base_price,
    duration_mins: s.duration_mins,
    location_types: [s.location_mobile && "mobile", s.location_unit && "unit"].filter(Boolean) as string[],
    active: s.active,
    sort_order: s.sort_order,
    // Only sizes that change something are stored.
    size_adjustments: Object.fromEntries(
      SIZES.flatMap((size) => {
        const price_pence = (s as unknown as Record<string, number | undefined>)[`size_${size}_price`] ?? 0;
        const extra_mins = (s as unknown as Record<string, number | undefined>)[`size_${size}_mins`] ?? 0;
        return price_pence || extra_mins ? [[size, { price_pence, extra_mins }]] : [];
      }),
    ),
  }));

export const addOnFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(100),
    description: optionalText,
    price: pounds("a price"),
    duration_mins: wholeNumber("Extra minutes", { max: 600, optional: true }),
    applies_to: z.enum(["all", "some"]),
    service_ids: z.array(z.uuid()),
    active: checkbox,
    sort_order: wholeNumber("Order", { max: 1000, optional: true }),
  })
  .superRefine((a, ctx) => {
    if (a.applies_to === "some" && a.service_ids.length === 0) {
      ctx.addIssue({ code: "custom", path: ["service_ids"], message: "Pick the services it goes with." });
    }
  })
  .transform((a) => ({
    name: a.name,
    description: a.description,
    price_pence: a.price,
    duration_mins: a.duration_mins,
    service_ids: a.applies_to === "all" ? null : a.service_ids,
    active: a.active,
    sort_order: a.sort_order,
  }));

// The deposit is set under Settings → Payments, so it isn't part of this form.
export const rulesFormSchema = z
  .object({
    min_price: pounds("a minimum", { optional: true }),
    mobile_surcharge: pounds("a call-out fee", { optional: true }),
    condition_tiers: z.string().transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Condition levels couldn't be read. Reload and try again." });
        return z.NEVER;
      }
    }).pipe(
      z
        .array(conditionTierSchema)
        .refine((tiers) => new Set(tiers.map((t) => t.key)).size === tiers.length, "Two condition levels have the same name."),
    ),
  })
  .transform((r) => ({
    min_price_pence: r.min_price,
    mobile_surcharge_pence: r.mobile_surcharge,
    condition_tiers: r.condition_tiers,
  }));

// FormData → plain object for the schemas; service_ids can repeat.
export function formObject(formData: FormData) {
  const serviceIds: string[] = [];
  const values: Record<string, unknown> = { service_ids: serviceIds };
  for (const [key, value] of formData) {
    if (typeof value !== "string") continue;
    if (key === "service_ids") serviceIds.push(value);
    else values[key] = value;
  }
  return values;
}

