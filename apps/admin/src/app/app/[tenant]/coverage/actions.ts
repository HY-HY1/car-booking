"use server";

import { refresh } from "next/cache";
import { territoriesSchema } from "@leadgen/core/booking/config";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Saves the territories drawn on Coverage Area. Owner-only (RLS enforces the
// same), and filtered on the tenant from the URL's membership check.

export async function saveCoverage(slug: string, input: unknown): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("settings.edit")) return { message: "Your access level doesn't include changing the coverage area." };
  const parsed = territoriesSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const ids = new Set(parsed.data.map((t) => t.id));
  if (ids.size !== parsed.data.length) return { message: "Something went wrong. Refresh and try again." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_settings")
    .update({ service_area: { territories: parsed.data } })
    .eq("tenant_id", tenant.id)
    .select("tenant_id");
  if (error) {
    console.error("Saving coverage failed", error);
    return { message: "Couldn't save the coverage area. Try again." };
  }
  if (!data?.length) return { message: "Booking isn't set up for this business yet." };
  refresh();
  return { saved: true };
}
