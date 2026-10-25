"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";

export type PasswordState = { error?: string; saved?: boolean };

// New owners are given a temporary password; this is where they replace it.
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  await requireUser(appUrl("/account/password"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 10) return { error: "Use at least 10 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Couldn't change the password. Try a different one." };
  return { saved: true };
}
