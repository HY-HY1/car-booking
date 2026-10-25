import "server-only";
import { can } from "@leadgen/core/team/access";
import { createOnboardingLink, ensureConnectedAccount } from "@leadgen/core/stripe/accounts";
import { requireTenant } from "@/lib/auth";
import { apiUrl, appUrl } from "@/lib/urls";

// Connecting Stripe from Settings → Payments. The owner's click creates the
// connected account (once) and a fresh one-use onboarding link; links are
// never stored or sent anywhere.

export async function stripeOnboardingUrl(slug: string) {
  const { tenant, role, user } = await requireTenant(slug);
  if (!can(role, "stripe.connect")) throw new Error("Only the business owner can connect Stripe.");

  const accountId = await ensureConnectedAccount({ id: tenant.id, name: tenant.name, ownerEmail: user.email });
  // Stripe needs these to be https in live mode (NEXT_PUBLIC_SITE_URL / _ROOT_DOMAIN).
  return createOnboardingLink(accountId, {
    returnUrl: appUrl(`/${slug}/settings/payments?stripe=return`, { absolute: true }),
    // Expired, reused or previewed by a messaging app: make a fresh link.
    refreshUrl: apiUrl(`/stripe/onboarding-link?tenant=${encodeURIComponent(slug)}`, { absolute: true }),
  });
}
