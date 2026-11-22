import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { isPlatformAdmin } from "@leadgen/core/platform/businesses";
import { getCurrentUser, requireUser, twoFactorState } from "@/lib/auth";
import { adminUrl } from "@/lib/urls";

// Guard for the /platform pages and their actions. Anyone who isn't a
// platform admin gets a 404, so the pages aren't even confirmed to exist.
// Server actions call this too: hiding a page is not access control.

// Also used just to decide whether to show a link on ordinary dashboard
// pages, so a failed lookup counts as "not an admin" (and is logged) rather
// than taking an owner's dashboard down. The /platform pages then 404, so it
// can never grant access by failing.
export const getIsPlatformAdmin = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return false;
  try {
    return await isPlatformAdmin(user.id);
  } catch (error) {
    console.error("Platform admin check failed", error);
    return false;
  }
});

// The panel reads and changes every business with the secret key, so it
// insists on two-factor login: a platform admin without an authenticator set
// up is sent to /two-factor to add one. `setup` is for that page alone.
export async function requirePlatformAdmin(next = adminUrl(), { setup = false } = {}) {
  const user = await requireUser(next);
  if (!(await getIsPlatformAdmin())) notFound();
  // Checked with Supabase here rather than trusting the session cookie.
  const factor = await twoFactorState();
  if (!factor) notFound();
  if (factor.enrolled && !factor.confirmed) notFound();
  if (!factor.enrolled && !setup) redirect(adminUrl("/two-factor"));
  return user;
}
