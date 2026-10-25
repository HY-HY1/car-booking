-- Payment links the owner creates from Payments → Payment links: a reusable
-- or one-off Stripe link for any amount (a balance on the day, an extra, a
-- top-up). The link itself lives on the business's own Stripe account; this
-- table is our record of it, so we can list, copy and switch off the ones
-- made here. Owners can read their own; every write goes through the engine
-- with the secret key, which also checks Stripe is connected.

create table public.payment_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  stripe_payment_link_id text not null unique,
  url text not null,
  description text not null check (length(trim(description)) > 0),
  amount_pence int not null check (amount_pence >= 30),
  -- One-off: Stripe stops accepting payments after the first completed one.
  single_use boolean not null default true,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index payment_links_tenant_idx on public.payment_links (tenant_id, created_at desc);

alter table public.payment_links enable row level security;
revoke all on public.payment_links from anon;
revoke insert, update, delete on public.payment_links from authenticated;

create policy "Owners can view payment links" on public.payment_links
  for select to authenticated using (private.is_tenant_member (tenant_id, array['owner']));
