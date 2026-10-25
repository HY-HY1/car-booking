"use server";

import { refresh } from "next/cache";
import { depositFormSchema, parseRefundForm } from "@leadgen/core/settings/forms";
import { policyOf } from "@leadgen/core/settings/policy";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { createClient } from "@/lib/supabase/server";
import { failed, fieldErrors, plain, requireOwner } from "../shared";

// Settings → Payments. Owner-only (RLS enforces the same).

export async function saveDepositAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = depositFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_settings")
    .update({ deposit: parsed.data })
    .eq("tenant_id", tenant.id)
    .select("tenant_id");
  if (error) return failed("the deposit", error);
  if (!data?.length) return { message: "Booking isn't set up for this business yet." };
  refresh();
  return { saved: true };
}

// What happens to the deposit when a customer cancels. Only once a
// cancellation policy exists (Settings → Booking); the cut-offs are kept.
export async function saveRefundRulesAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const supabase = await createClient();
  const current = await supabase
    .from("booking_settings")
    .select("cancellation_policy")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (current.error) return failed("the refund rules", current.error);
  const policy = policyOf(current.data?.cancellation_policy);
  if (!policy) return { message: "Turn on a cancellation policy under Settings → Booking first." };

  const parsed = parseRefundForm(plain(formData), policy);
  if (!parsed.success) return fieldErrors(parsed.error);
  const { error } = await supabase
    .from("booking_settings")
    .update({ cancellation_policy: parsed.data })
    .eq("tenant_id", tenant.id);
  if (error) return failed("the refund rules", error);
  refresh();
  return { saved: true };
}
