-- Self-serve signup and the subscription a business pays us (not their own
-- Stripe account, which is tenants.stripe_account_id). Written by the signup
-- action and the billing webhook with the secret key: owners can only update
-- name, branding, agent_rules and tracking_ids on tenants, so none of these
-- columns can be changed from a browser.

alter table public.tenants
  add column trade text not null default 'detailing'
    check (trade in ('detailing', 'valeting', 'both')),
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  -- Stripe's subscription status, or 'awaiting_checkout' for someone who has
  -- signed up but not been through Checkout. null = not billed through the app
  -- (ASCND, or a business set up by hand), and never locked out.
  add column subscription_status text,
  add column trial_ends_at timestamptz;

-- A webhook maps a customer or subscription id back to exactly one tenant.
create unique index tenants_stripe_customer_id_key
  on public.tenants (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index tenants_stripe_subscription_id_key
  on public.tenants (stripe_subscription_id)
  where stripe_subscription_id is not null;
