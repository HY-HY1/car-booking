"use server";

import { refresh } from "next/cache";
import { parseCustomerCsv } from "@leadgen/core/customers/import-rules";
import { logActivity } from "@/lib/activity";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ImportState = {
  error?: string;
  added?: number;
  alreadyHad?: number;
  skipped?: { line: number; reason: string }[];
};

// A customer list from a spreadsheet. Anyone already on file (same email or
// phone) is left exactly as they are. Nobody comes in opted in to marketing:
// see customers/import-rules.ts.
export async function importCustomersAction(slug: string, _prev: ImportState, formData: FormData): Promise<ImportState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("customers.delete")) return { error: "Your access level doesn't include importing customers." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > 5 * 1024 * 1024) return { error: "That file is over 5 MB." };
  const parsed = parseCustomerCsv(await file.text());
  if (!parsed.ok) return { error: parsed.message };

  const supabase = await createClient();
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("customers").select("email, phone").eq("tenant_id", tenant.id).order("id").range(from, from + 999);
    if (error) {
      console.error("Reading customers for an import failed", error);
      return { error: "Couldn't check your existing customers. Try again." };
    }
    for (const c of data) {
      if (c.email) emails.add(c.email);
      if (c.phone) phones.add(c.phone);
    }
    if (data.length < 1000) break;
  }

  const fresh = parsed.customers.filter((c) => !(c.email && emails.has(c.email)) && !(c.phone && phones.has(c.phone)));
  for (let i = 0; i < fresh.length; i += 200) {
    const { error } = await supabase
      .from("customers")
      .insert(fresh.slice(i, i + 200).map((c) => ({ ...c, tenant_id: tenant.id, source: "manual" })));
    if (error) {
      console.error("Importing customers failed", error);
      return { error: `Stopped after ${i} customers: couldn't save the next ones. Try the file again, and those already in will be left alone.` };
    }
  }

  await logActivity(tenant.id, "customer.imported", `Imported ${fresh.length} customers`);
  refresh();
  return { added: fresh.length, alreadyHad: parsed.customers.length - fresh.length, skipped: parsed.skipped };
}
