"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { recordActivity } from "@leadgen/core/activity/log";
import { resetTwoFactor } from "@leadgen/core/platform/businesses";
import { setLoginBlocked } from "@leadgen/core/platform/logins";
import { createAdminClient } from "@leadgen/core/supabase/admin";
import { requirePlatformAdmin } from "@/lib/platform";
import { adminUrl } from "@/lib/urls";

// Acting on a login from the platform panel. What was done is written to the
// activity log of every business the login is on, so their owners see it.

type Result = { ok?: true; error?: string; message?: string };

async function logOnTheirBusinesses(userId: string, action: `account.${string}`, summary: string) {
  const admin = await requirePlatformAdmin(adminUrl("/logins"));
  const { data } = await createAdminClient().from("tenant_members").select("tenant_id").eq("user_id", userId);
  await Promise.all(
    (data ?? []).map((m) => recordActivity({ tenantId: m.tenant_id, actorId: admin.id, actorEmail: admin.email, action, summary })),
  );
}

async function emailOf(userId: string) {
  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  return data.user?.email ?? "a login";
}

export async function resetLoginTwoFactorAction(userId: string): Promise<Result> {
  const admin = await requirePlatformAdmin(adminUrl("/logins"));
  if (!z.uuid().safeParse(userId).success) return { error: "No such login." };
  if (userId === admin.id) return { error: "You can't reset your own here. Turn it off in your account settings instead." };
  try {
    const removed = await resetTwoFactor(userId);
    const email = await emailOf(userId);
    if (removed > 0) await logOnTheirBusinesses(userId, "account.two_factor_reset", `Platform admin reset two-factor login for ${email}`);
    refresh();
    return { ok: true, message: removed ? `Two-factor login reset for ${email}` : `${email} doesn't have two-factor login on` };
  } catch (error) {
    console.error("Resetting two-factor failed", error);
    return { error: "Couldn't reset it. Try again." };
  }
}

export async function setBlockedAction(userId: string, blocked: boolean): Promise<Result> {
  const admin = await requirePlatformAdmin(adminUrl("/logins"));
  if (!z.uuid().safeParse(userId).success) return { error: "No such login." };
  if (userId === admin.id) return { error: "You can't block yourself." };
  try {
    const result = await setLoginBlocked(userId, blocked);
    if (!result.ok) return { error: result.message };
    const email = await emailOf(userId);
    await logOnTheirBusinesses(userId, blocked ? "account.blocked" : "account.unblocked", `Platform admin ${blocked ? "blocked" : "unblocked"} sign-in for ${email}`);
    refresh();
    return { ok: true, message: blocked ? `${email} can no longer sign in` : `${email} can sign in again` };
  } catch (error) {
    console.error("Blocking a login failed", error);
    return { error: "Couldn't change it. Try again." };
  }
}
