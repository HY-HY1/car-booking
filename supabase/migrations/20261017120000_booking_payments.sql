-- A record of every payment taken against a booking: its deposit, and any
-- payment links paid later (a balance on the day, an extra). The booking's own
-- deposit_status only describes the deposit, so on its own it can't say "paid
-- in full" or "£39 still to pay". Written only by the engine with the secret
-- key: when Stripe tells us about a payment (webhook), and when a booking page
-- finds one it hasn't recorded (so a missed webhook heals itself).

create table public.booking_payments (
  stripe_charge_id text primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  stripe_payment_intent_id text,
  kind text not null check (kind in ('deposit', 'payment_link', 'other')),
  amount_pence int not null check (amount_pence >= 0),
  -- Cumulative, as Stripe reports it on the charge.
  refunded_pence int not null default 0 check (refunded_pence >= 0),
  receipt_url text,
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index booking_payments_booking_idx on public.booking_payments (tenant_id, booking_id);

alter table public.booking_payments enable row level security;
revoke all on public.booking_payments from anon;
revoke insert, update, delete on public.booking_payments from authenticated;

-- Staff can see a booking's payments as well as owners: they already see its
-- price and deposit.
create policy "Members can view booking payments" on public.booking_payments
  for select to authenticated using (private.is_tenant_member (tenant_id));
