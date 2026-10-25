import "server-only";
import { createAdminClient } from "../supabase/admin";
import { getStripe } from "./client";
import { canTakeCardPayments } from "./rules";

// Connecting a detailer's own Stripe account (info/stripe.md, section 2).
// Accounts v2 lives behind these functions only, so a change to Stripe's API
// is a change to this file.

export type TenantPayments = { accountId: string | null; ready: boolean };

export async function getTenantPayments(tenantId: string): Promise<TenantPayments> {
  const { data, error } = await createAdminClient()
    .from("tenants")
    .select("stripe_account_id, stripe_ready")
    .eq("id", tenantId)
    .single();
  if (error) throw error;
  return { accountId: data.stripe_account_id, ready: data.stripe_ready };
}

// Creates the tenant's connected account, once. The idempotency key means a
// double click (or two tabs) gets the same account back rather than a second.
export async function ensureConnectedAccount(tenant: { id: string; name: string; ownerEmail: string | null }) {
  const db = createAdminClient();
  const existing = await getTenantPayments(tenant.id);
  if (existing.accountId) return existing.accountId;

  const account = await getStripe().v2.core.accounts.create(
    {
      ...(tenant.ownerEmail && { contact_email: tenant.ownerEmail }),
      display_name: tenant.name,
      // Full Dashboard, Stripe collects fees and carries negative balances:
      // the detailer is the merchant of record and we never hold their money.
      dashboard: "full",
      identity: { country: "gb" },
      configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
      defaults: {
        currency: "gbp",
        responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
        locales: ["en-GB"],
      },
      metadata: { tenant_id: tenant.id },
      include: ["configuration.merchant", "requirements"],
    },
    { idempotencyKey: `connect-account-${tenant.id}` },
  );

  // Only fills an empty column, so the first account saved wins.
  const { error } = await db
    .from("tenants")
    .update({ stripe_account_id: account.id })
    .eq("id", tenant.id)
    .is("stripe_account_id", null);
  if (error) throw error;
  return (await getTenantPayments(tenant.id)).accountId ?? account.id;
}

// A single-use link to Stripe's hosted onboarding. Generate it when the owner
// clicks, and send them straight there; never store or send it.
export async function createOnboardingLink(accountId: string, urls: { returnUrl: string; refreshUrl: string }) {
  const link = await getStripe().v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        // Collect everything up front so payouts don't stall later.
        collection_options: { fields: "eventually_due" },
        return_url: urls.returnUrl,
        refresh_url: urls.refreshUrl,
      },
    },
  });
  return link.url;
}

// Reads the account from Stripe and stores whether it can take card payments.
// Called from the requirements webhook and when the owner returns from
// onboarding, so the booking flow only offers a deposit when it will work.
export async function syncAccountStatus(accountId: string) {
  const account = await getStripe().v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "requirements"],
  });
  const ready = canTakeCardPayments(account);
  const { error } = await createAdminClient()
    .from("tenants")
    .update({ stripe_ready: ready })
    .eq("stripe_account_id", accountId);
  if (error) throw error;
  return { ready };
}
