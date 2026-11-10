import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizePhone, normalizePostcode } from "../customer-fields";

// Facebook and Instagram lead forms: pure rules (no database or network).

// Graph API versions last about two years; bump this when Meta retires it.
export const GRAPH_VERSION = "v23.0";

// What the business is asked to allow: list their Pages, subscribe a Page to
// lead notifications, and read the leads.
export const META_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_metadata", "leads_retrieval"] as const;

// Meta signs every webhook with the app secret: "sha256=<hex>".
export function verifyMetaSignature(appSecret: string, rawBody: string, header: string | null) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export type LeadgenChange = { pageId: string; leadgenId: string; formId: string | null };

// The new leads in a webhook: page entries with a "leadgen" change.
export function leadgenChanges(body: unknown): LeadgenChange[] {
  const b = body as { object?: string; entry?: { id?: unknown; changes?: { field?: string; value?: Record<string, unknown> }[] }[] };
  if (b?.object !== "page" || !Array.isArray(b.entry)) return [];
  const out: LeadgenChange[] = [];
  for (const entry of b.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen" || !change.value) continue;
      const leadgenId = String(change.value.leadgen_id ?? "");
      const pageId = String(change.value.page_id ?? entry.id ?? "");
      if (!/^\d{1,30}$/.test(leadgenId) || !/^\d{1,30}$/.test(pageId)) continue;
      const formId = change.value.form_id ? String(change.value.form_id) : null;
      out.push({ pageId, leadgenId, formId });
    }
  }
  return out;
}

export type FieldData = { name: string; values?: string[] }[];

export type MetaLead = {
  name: string;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  answers: { question: string; answer: string }[];
};

// Meta's standard question keys, and what they're called on the lead page.
const LABELS: Record<string, string> = {
  full_name: "Full name",
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone_number: "Phone",
  post_code: "Postcode",
  zip_code: "Postcode",
  zip: "Postcode",
  city: "Town or city",
  street_address: "Address",
};

// A custom question's key is its wording in snake case: "what_car_do_you_have?".
export function questionLabel(key: string) {
  if (LABELS[key]) return LABELS[key];
  const words = key.replace(/_/g, " ").trim();
  return (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, 200);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function leadFromFields(fields: FieldData): MetaLead {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = fields.find((f) => f.name === k)?.values?.[0]?.trim();
      if (v) return v;
    }
    return null;
  };
  const first = get("first_name");
  const last = get("last_name");
  const name = (get("full_name") ?? [first, last].filter(Boolean).join(" ")).slice(0, 200);
  const email = get("email")?.toLowerCase() ?? null;
  const phone = get("phone_number");
  const postcode = get("post_code", "zip_code", "zip");
  return {
    name: name || "Lead form enquiry",
    email: email && EMAIL.test(email) && email.length <= 254 ? email : null,
    phone: phone ? normalizePhone(phone) : null,
    postcode: postcode ? normalizePostcode(postcode).slice(0, 10) : null,
    answers: fields
      .filter((f) => f.values?.length)
      .slice(0, 50)
      .map((f) => ({ question: questionLabel(f.name), answer: (f.values ?? []).join(", ").slice(0, 2000) })),
  };
}

// Which of Meta's apps it came from: "ig" for Instagram, otherwise Facebook.
export function leadSource(platform: string | null | undefined) {
  return platform === "ig" ? "instagram_lead_form" : "facebook_lead_form";
}
