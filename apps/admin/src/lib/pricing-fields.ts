import { z } from "zod";
import {
  addOnSchema,
  bookingSettingsSchema,
  serviceSchema,
  SIZE_CLASSES,
  type SizeClass,
} from "@leadgen/core/booking/config";

// Pricing editor types and formatting. No server imports, so the editor's
// client components can use these too.

export const SIZES = Object.keys(SIZE_CLASSES) as SizeClass[];

export const editableServiceSchema = serviceSchema.extend({
  active: z.boolean(),
  sort_order: z.number().int(),
});
export type EditableService = z.infer<typeof editableServiceSchema>;

export const editableAddOnSchema = addOnSchema.extend({
  active: z.boolean(),
  sort_order: z.number().int(),
});
export type EditableAddOn = z.infer<typeof editableAddOnSchema>;

export const pricingRulesSchema = bookingSettingsSchema.pick({
  deposit: true,
  min_price_pence: true,
  mobile_surcharge_pence: true,
  condition_tiers: true,
  offers_mobile: true,
  offers_unit: true,
});
export type PricingRules = z.infer<typeof pricingRulesSchema>;

// 4500 → "45", 4550 → "45.50": how prices are shown in the editor's inputs.
export function poundsInput(pence: number) {
  return pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2);
}

// Header images live in the public service-images bucket.
export function serviceImageUrl(path: string | null | undefined) {
  return path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/service-images/${path}` : null;
}

export const SERVICE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SERVICE_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// "Full Valet & Wax" → "full-valet-wax": a service's address on the booking site.
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const GALLERY_MAX = 8;
