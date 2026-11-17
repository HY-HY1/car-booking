"use server";

import { redirect } from "next/navigation";
import { confirmEmailCheck, emailCheckDone, resendEmailCheck } from "@leadgen/core/account/email-check";
import { hitRateLimit } from "@leadgen/core/api/rate-limit";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { appUrl, loginUrl } from "@/lib/urls";

export type VerifyState = { error?: string; sent?: boolean };

// The session still says "unchecked" until it's refreshed, so it's refreshed
// before going on, or the dashboard would send them straight back here.
async function carryOn(next: string): Promise<never> {
  await (await createClient()).auth.refreshSession();
  redirect(safeNext(next));
}

// "I've confirmed it": pressed after using the link, perhaps on another device.
export async function continueAction(next: string): Promise<VerifyState> {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(appUrl("/verify-email")));
  if (!(await emailCheckDone(user.id))) {
    return { error: "We haven't seen the link pressed yet. Check your inbox, and your spam folder." };
  }
  return carryOn(next);
}

export async function resendAction(): Promise<VerifyState> {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(appUrl("/verify-email")));
  const limit = await hitRateLimit(`email-check:${user.id}`, 3, 3600);
  if (!limit.allowed) return { error: "We've sent a few already. Give them a few minutes to arrive, or try again in an hour." };
  let sent = false;
  let done = false;
  try {
    sent = await resendEmailCheck(user.id);
    // Nothing to check any more: they've confirmed it already.
    if (!sent) done = await emailCheckDone(user.id);
  } catch (error) {
    console.error("Resending the email check failed", error);
  }
  // Outside the try: redirect() works by throwing.
  if (done) return carryOn(appUrl());
  return sent ? { sent: true } : { error: "Couldn't send it just now. Try again in a minute." };
}

// The button on the page the emailed link opens. Signed in here (same
// browser): straight on to the dashboard. Otherwise: to sign in.
export async function confirmAction(userId: string, token: string): Promise<VerifyState> {
  let ok = false;
  try {
    ok = await confirmEmailCheck(userId, token);
  } catch (error) {
    console.error("Confirming an email failed", error);
    return { error: "Couldn't confirm it just now. Try again in a minute." };
  }
  if (!ok) return { error: "This link has been replaced by a newer one, or isn't complete. Use the latest email we sent." };
  const user = await getCurrentUser();
  if (user?.id === userId) return carryOn(appUrl());
  redirect(loginUrl(appUrl()));
}
