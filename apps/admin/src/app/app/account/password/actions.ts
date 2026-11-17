"use server";

import { mustChangePassword, setMustChangePassword } from "@leadgen/core/account/password-change";
import { MIN_PASSWORD } from "@leadgen/core/billing/rules";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";

export type PasswordState = { error?: string; saved?: boolean };

// Replacing a temporary password, or choosing one after a reset email. It
// doesn't ask for the current password, so it only works while the account
// is flagged for it (account/password-change.ts): a stolen session alone
// can't be used to lock the owner out. Otherwise it's Settings → Account.
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireUser(appUrl("/account/password"));
  if (!(await mustChangePassword(user.id))) {
    return { error: "Change your password in Settings → Account, which asks for your current one." };
  }
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters.` };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Couldn't change the password. Try a different one." };
  await setMustChangePassword(user.id, false);
  return { saved: true };
}
