"use server";

import { refresh } from "next/cache";
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
