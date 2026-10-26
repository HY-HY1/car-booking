"use server";

import { refresh } from "next/cache";
import { senderAddressSchema, type SenderStatus } from "@leadgen/core/email/senders";
import { checkSender, removeSender, setSender } from "@leadgen/core/email/senders-server";
import { parseNotificationsForm } from "@leadgen/core/settings/forms";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { createClient } from "@/lib/supabase/server";
import { failed, fieldErrors, plain, requireOwner } from "../shared";

// Settings → Notifications: the whole set is saved at once. Owner-only.
export async function saveNotificationsAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = parseNotificationsForm(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("tenants").update({ notification_settings: parsed.data }).eq("id", tenant.id);
  if (error) return failed("your notification settings", error);
  refresh();
  return { saved: true };
}

// ------------------------------------------------------------- Sending address

export async function saveSenderAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = senderAddressSchema().safeParse(String(formData.get("address") ?? ""));
  if (!parsed.success) return { errors: { address: parsed.error.issues[0].message } };
  try {
    const result = await setSender(tenant.id, parsed.data);
    if (!result.ok) return { errors: { address: result.message } };
  } catch (error) {
    return failed("your email address", error);
  }
  refresh();
  return { saved: true };
}

export async function checkSenderAction(slug: string): Promise<{ status?: SenderStatus | null; message?: string }> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return { message: denied.message };
  try {
    const result = await checkSender(tenant.id);
    refresh();
    return result;
  } catch (error) {
    console.error("Checking an email domain failed", error);
    return { message: "Couldn't check just now. Try again in a minute." };
  }
}

export async function removeSenderAction(slug: string): Promise<{ message?: string }> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return { message: denied.message };
  try {
    await removeSender(tenant.id);
  } catch (error) {
    console.error("Removing an email sender failed", error);
    return { message: "Couldn't remove it. Try again." };
  }
  refresh();
  return {};
}
