"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { adminUrl, appUrl, surfaceForHost } from "@/lib/urls";

export type SignInState = { error?: string; email?: string };

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // Signing in on admin.domain.com (subdomain mode) goes back to the super-admin.
  const onAdminHost = surfaceForHost((await headers()).get("host")).surface === "admin";
  const next = safeNext(formData.get("next"), onAdminHost ? adminUrl() : appUrl());

  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "That email and password don't match.", email };
  }

  redirect(next);
}
