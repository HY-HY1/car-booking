"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { promoFormSchema } from "@leadgen/core/booking/promo-rules";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { logActivity } from "@/lib/activity";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Discount and voucher codes. For whoever can change prices; RLS enforces it too.

const DENIED = "Your access level doesn't include changing prices.";

export async function addPromoAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("pricing.edit")) return { message: DENIED };

  const parsed = promoFormSchema.safeParse(Object.fromEntries([...formData.entries()].filter((e): e is [string, string] => typeof e[1] === "string")));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("promo_codes").insert({ ...parsed.data, tenant_id: tenant.id });
  if (error) {
    if (error.code === "23505") return { errors: { code: "You already have a code with that name." } };
    console.error("Adding a promo code failed", error);
    return { message: "Couldn't save the code. Try again." };
  }
  await logActivity(tenant.id, "pricing.promo_added", `Added the code ${parsed.data.code}`);
  refresh();
  return { saved: true };
}

export async function setPromoActiveAction(slug: string, id: string, active: boolean): Promise<{ error?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("pricing.edit")) return { error: DENIED };
  if (!z.uuid().safeParse(id).success) return { error: "That code no longer exists." };
  const supabase = await createClient();
  const { error } = await supabase.from("promo_codes").update({ active }).eq("tenant_id", tenant.id).eq("id", id);
  if (error) {
    console.error("Changing a promo code failed", error);
    return { error: "Couldn't change it. Try again." };
  }
  await logActivity(tenant.id, "pricing.promo_changed", active ? "Switched a code on" : "Switched a code off");
  refresh();
  return {};
}
