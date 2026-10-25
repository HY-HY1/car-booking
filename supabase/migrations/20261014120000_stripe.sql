-- Stripe Connect deposits (info/stripe.md, section 8). Each tenant has its own
-- connected Stripe account; deposits are direct charges on it. Everything here
-- is written by the engine and webhooks with the secret key: tenants.stripe_*
-- are already outside the columns owners can update, and so are the new
-- bookings columns (bookings only grants update on a short list).

alter table public.tenants
  add column stripe_ready boolean not null default false;

-- One tenant per connected account: a webhook's account id maps to one tenant.
create unique index tenants_stripe_account_id_key
  on public.tenants (stripe_account_id)
  where stripe_account_id is not null;

alter table public.bookings
  add column platform_fee_pence int check (platform_fee_pence is null or platform_fee_pence >= 0),
  add column stripe_payment_intent_id text unique;

alter table public.bookings drop constraint bookings_deposit_status_check;
alter table public.bookings add constraint bookings_deposit_status_check
  check (deposit_status in (
    'none', 'pending', 'paid', 'refunded', 'partially_refunded', 'disputed', 'waived'
  ));

-- Stripe can deliver the same event more than once. The webhook claims an
-- event id by inserting it here and skips events it has already claimed. No
-- policies and no grants: only the secret key reads or writes this table.
create table public.stripe_events (
  id text primary key,
  type text not null,
  account text,
  received_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;
