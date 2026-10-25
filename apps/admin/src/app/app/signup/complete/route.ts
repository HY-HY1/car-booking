import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { confirmCheckout } from "@leadgen/core/billing/subscriptions";
import { getCurrentUser, getMemberships } from "@/lib/auth";
import { appUrl } from "@/lib/urls";

// Where Stripe Checkout sends someone after they've added their card. The
// webhook will also record the subscription, but it can arrive after this
// does, so ask Stripe directly, then carry on to the setup checklist.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("tenant") ?? "";
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";

  const user = await getCurrentUser();
  const back = appUrl(`/signup/billing?tenant=${encodeURIComponent(slug)}`);
  if (!user) redirect(appUrl(`/login?next=${encodeURIComponent(back)}`));

  const membership = (await getMemberships()).find((m) => m.tenant.slug === slug);
  if (!membership) redirect(appUrl());

  let ok = false;
  try {
    ok = Boolean(sessionId) && (await confirmCheckout(sessionId, membership.tenant.id));
  } catch (error) {
    console.error("Couldn't confirm the Checkout session", error);
  }
  // The slug comes from their own membership, not from the address.
  redirect(ok ? appUrl(`/${membership.tenant.slug}/setup`) : `${back}&error=1`);
}
