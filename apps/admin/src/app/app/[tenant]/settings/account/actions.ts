"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { profileFormSchema } from "@leadgen/core/settings/forms";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, plain } from "../shared";
import { appUrl } from "@/lib/urls";

// Settings → Account: the signed-in person, not the business. Each action
// only ever changes the user in the session.

export async function saveProfileAction(formData: FormData): Promise<SaveState> {
  await requireUser();
  const parsed = profileFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: parsed.data });
  if (error) {
    console.error("Profile update failed", error);
    return { message: "Couldn't save your details. Try again." };
  }
  refresh();
  return { saved: true };
}

// Supabase emails a confirmation link (to the new address, and the old one
// too when secure email change is on); nothing changes until it's clicked.
export async function changeEmailAction(slug: string, formData: FormData): Promise<SaveState> {
  const user = await requireUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { errors: { email: "Enter a valid email address." } };
  if (email === user.email) return { errors: { email: "That's already your email address." } };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: appUrl(`/${encodeURIComponent(slug)}/settings/account`, { absolute: true }) },
  );
  if (error) {
    console.error("Email change failed", error);
    return { message: error.code === "email_exists" ? "Another account already uses that email." : "Couldn't change your email. Try again." };
  }
  return { saved: true };
}

export async function changePasswordAction(formData: FormData): Promise<SaveState> {
  await requireUser();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) return { errors: { password: "Use at least 10 characters." } };
  if (password !== confirm) return { errors: { confirm: "The two passwords don't match." } };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      errors: {
        password: error.code === "same_password" ? "That's your current password. Choose a new one." : "Couldn't use that password. Try a different one.",
      },
    };
  }
  return { saved: true };
}

// Signs this account out on every device, this one included.
export async function signOutEverywhereAction() {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) console.error("Global sign-out failed", error);
  redirect(appUrl("/login?signed_out=everywhere"));
}
