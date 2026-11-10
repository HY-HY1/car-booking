"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";

export type ResetState = { error?: string };

// Spends the emailed token, which signs them in, then on to choosing a new
// password. Someone with two-factor on is asked for their code first, so
// access to their inbox alone isn't enough.
export async function confirmPasswordReset(token: string): Promise<ResetState> {
  if (!token) return { error: "This link isn't complete. Ask for a new one." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: token });
  if (error) return { error: "This link has expired or has already been used. Ask for a new one." };

  redirect(appUrl("/account/password"));
}
