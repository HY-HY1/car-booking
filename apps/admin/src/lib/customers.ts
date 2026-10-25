import { z } from "zod";
import {
  CUSTOMER_SOURCES,
  normalizePhone,
  normalizePostcode,
  type Customer,
  type MarketingBasis,
} from "@leadgen/core/customer-fields";
import { createClient } from "@/lib/supabase/server";

// Customer data access and validation. Every query takes the tenant id from
// requireTenant() and filters on it; RLS enforces the same rule underneath.

export const PAGE_SIZE = 50;

const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null);

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

export const customerSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email address.")
      .transform((v) => v || null),
    phone: z
      .string()
      .trim()
      .refine((v) => !v || normalizePhone(v) !== null, "Enter a valid phone number.")
      .transform((v) => (v ? normalizePhone(v) : null)),
    address_line: optionalText,
    postcode: z
      .string()
      .trim()
      .transform((v) => (v ? normalizePostcode(v) : null)),
    notes: optionalText,
    source: z.enum(Object.keys(CUSTOMER_SOURCES) as [keyof typeof CUSTOMER_SOURCES]),
    email_marketing: checkbox,
    sms_marketing: checkbox,
    whatsapp_marketing: checkbox,
    marketing_basis: z
      .enum(["", "consent", "soft_opt_in"])
      .transform((v) => (v || null) as MarketingBasis | null),
  })
  .superRefine((c, ctx) => {
    if (!c.email && !c.phone) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Add an email or a phone number.",
      });
    }
    const anyMarketing = c.email_marketing || c.sms_marketing || c.whatsapp_marketing;
    if (anyMarketing && !c.marketing_basis) {
      ctx.addIssue({
        code: "custom",
        path: ["marketing_basis"],
        message: "Say how they agreed to marketing.",
      });
    }
  })
  // No channels means no basis to record.
  .transform((c) => ({
    ...c,
    marketing_basis:
      c.email_marketing || c.sms_marketing || c.whatsapp_marketing
        ? c.marketing_basis
        : null,
  }));

export type CustomerInput = z.output<typeof customerSchema>;

// Strips characters that have meaning in PostgREST filter strings.
export function searchTerm(q: string) {
  return q.replace(/[,()*%\\:"']/g, " ").trim();
}

export async function listCustomers(
  tenantId: string,
  { q = "", page = 1 }: { q?: string; page?: number },
) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("customers")
    .select(
      "id, name, email, phone, postcode, email_marketing, sms_marketing, whatsapp_marketing, created_at",
      { count: "exact" },
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const term = searchTerm(q);
  if (term) {
    const filters = [
      `name.ilike.%${term}%`,
      `email.ilike.%${term}%`,
      `postcode.ilike.%${term}%`,
    ];
    // Match phone numbers however they're typed: "07700 900", "+44 7700"...
    const digits = term.replace(/\D/g, "").replace(/^(44|0)/, "");
    if (digits.length >= 4) filters.push(`phone.ilike.%${digits}%`);
    query = query.or(filters.join(","));
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { customers: data, total: count ?? 0 };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCustomer(tenantId: string, id: string) {
  if (!UUID.test(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as Customer | null;
}
