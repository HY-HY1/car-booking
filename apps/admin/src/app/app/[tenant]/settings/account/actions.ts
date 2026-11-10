"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { profileFormSchema } from "@leadgen/core/settings/forms";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { cleanCode } from "@leadgen/core/account/rules";
import { logActivity } from "@/lib/activity";
import { requireTenant, requireUser } from "@/lib/auth";
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
  const { tenant } = await requireTenant(slug);
  await logActivity(tenant.id, "account.email_change_requested", "Asked to change their email address");
  return { saved: true };
}

export async function changePasswordAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant } = await requireTenant(slug);
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
  await logActivity(tenant.id, "account.password_changed", "Changed their password");
  return { saved: true };
}

// ------------------------------------------------------------- two-factor

export type TwoFactorSetup = { factorId: string; qr: string; secret: string };
export type TwoFactorResult = { error?: string };

// Shows the code to scan. It isn't on until a code from the app proves the
// scan worked, and anything left over from a setup not finished goes first.
export async function startTwoFactorAction(): Promise<{ setup?: TwoFactorSetup; error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) {
    console.error("Listing two-factor methods failed", listError);
    return { error: "Couldn't start that just now. Try again." };
  }
  for (const f of factors.all.filter((f) => f.status === "unverified")) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
  if (error) {
    console.error("Starting two-factor setup failed", error);
    return { error: "Couldn't start that just now. Try again." };
  }
  return { setup: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } };
}

const WRONG_CODE = "That code isn't right. Try the one showing now.";

export async function confirmTwoFactorAction(slug: string, factorId: string, code: string): Promise<TwoFactorResult> {
  const { tenant } = await requireTenant(slug);
  const clean = cleanCode(code);
  if (!clean) return { error: "Enter the 6-digit code from your app." };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
  if (error) return { error: WRONG_CODE };
  await logActivity(tenant.id, "account.two_factor_on", "Turned on two-factor login");
  refresh();
  return {};
}

export async function disableTwoFactorAction(slug: string, code: string): Promise<TwoFactorResult> {
  const { tenant } = await requireTenant(slug);
  const clean = cleanCode(code);
  if (!clean) return { error: "Enter the 6-digit code from your app." };

  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (listError || !factor) return { error: "Couldn't turn it off just now. Try again." };

  const check = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: clean });
  if (check.error) return { error: WRONG_CODE };
  const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (error) {
    console.error("Turning off two-factor failed", error);
    return { error: "Couldn't turn it off just now. Try again." };
  }
  await logActivity(tenant.id, "account.two_factor_off", "Turned off two-factor login");
  refresh();
  return {};
}

// Signs this account out on every device, this one included.
export async function signOutEverywhereAction() {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) console.error("Global sign-out failed", error);
  redirect(appUrl("/login?signed_out=everywhere"));
}
