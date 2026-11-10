"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cleanCode } from "@leadgen/core/account/rules";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { adminUrl, appUrl, surfaceForHost } from "@/lib/urls";

export type VerifyState = { error?: string };

// The second step of signing in: the code from their authenticator app.
export async function verifySecondFactor(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const onAdminHost = surfaceForHost((await headers()).get("host")).surface === "admin";
  const next = safeNext(formData.get("next"), onAdminHost ? adminUrl() : appUrl());

  const code = cleanCode(formData.get("code"));
  if (!code) return { error: "Enter the 6-digit code from your app." };

  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) {
    console.error("Listing two-factor methods failed", listError);
    return { error: "Couldn't check that just now. Try again." };
  }
  const factor = factors.totp[0];
  if (!factor) redirect(next);

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) {
    return { error: error.status === 429 ? "Too many tries. Wait a minute, then try again." : "That code isn't right. Try the one showing now." };
  }
  redirect(next);
}
