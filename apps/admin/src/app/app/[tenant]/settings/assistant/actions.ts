"use server";

import { refresh } from "next/cache";
import { assistantFormSchema } from "@leadgen/core/settings/forms";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { createClient } from "@/lib/supabase/server";
import { failed, fieldErrors, plain, requireOwner } from "../shared";

// Settings → AI assistant, stored as tenants.agent_rules. Owner-only.
export async function saveAssistantAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = assistantFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("tenants").update({ agent_rules: parsed.data }).eq("id", tenant.id);
  if (error) return failed("the assistant settings", error);
  refresh();
  return { saved: true };
}
