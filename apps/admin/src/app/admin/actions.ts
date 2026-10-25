"use server";

import { createBusiness, type CreateBusinessResult } from "@leadgen/core/platform/businesses";
import { newBusinessSchema, slugify } from "@leadgen/core/platform/rules";
import { requirePlatformAdmin } from "@/lib/platform";
import { adminUrl } from "@/lib/urls";

export type NewBusinessState = {
  errors?: Record<string, string>;
  message?: string;
  // What was typed, so a failed submit doesn't empty the form.
  values?: Record<string, string>;
  created?: Extract<CreateBusinessResult, { ok: true }>;
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function createBusinessAction(_prev: NewBusinessState, formData: FormData): Promise<NewBusinessState> {
  const admin = await requirePlatformAdmin(adminUrl("/new"));

  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") values[key] = value;

  const name = text(formData, "name");
  const parsed = newBusinessSchema.safeParse({
    name,
    slug: text(formData, "slug") || slugify(name),
    ownerEmail: text(formData, "ownerEmail"),
    hostname: text(formData, "hostname"),
    primaryColor: text(formData, "primaryColor") || undefined,
    accentColor: text(formData, "accentColor") || undefined,
    tagline: text(formData, "tagline"),
    hours: text(formData, "hours") || undefined,
    basePostcode: text(formData, "basePostcode"),
    radiusMiles: text(formData, "radiusMiles") || undefined,
    depositPercent: text(formData, "depositPercent") || undefined,
    starterServices: formData.get("starterServices") === "on",
    addMe: formData.get("addMe") === "on",
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { errors, message: "Fix the highlighted fields.", values };
  }

  try {
    const result = await createBusiness(parsed.data, admin.id);
    if (!result.ok) return { errors: { [result.field]: result.message }, message: result.message, values };
    return { created: result };
  } catch (error) {
    console.error("Creating a business failed", error);
    return { message: "Couldn't create the business. Nothing was saved; check the server log and try again.", values };
  }
}
