-- Money taken outside Stripe can be cash or a bank transfer ("Record cash or
-- bank transfer" on the booking's page, booking/offline-payments.ts). Both are
-- recorded by hand with the id 'manual_<uuid>'; cash recorded before this
-- (as 'cash_<uuid>') is renamed to match.

alter table public.booking_payments drop constraint booking_payments_cash_shape;
drop index public.booking_payments_cash_idx;

update public.booking_payments
set stripe_charge_id = 'manual_' || substr(stripe_charge_id, 6)
where kind = 'cash' and stripe_charge_id like 'cash\_%';

alter table public.booking_payments drop constraint booking_payments_kind_check;
alter table public.booking_payments add constraint booking_payments_kind_check
  check (kind in ('deposit', 'payment_link', 'other', 'cash', 'bank_transfer'));

alter table public.booking_payments
  -- Only cash and bank transfers are written by hand; the rest come from Stripe.
  add constraint booking_payments_manual_shape check (
    (kind in ('cash', 'bank_transfer')) = (stripe_charge_id like 'manual\_%')
    and (kind in ('cash', 'bank_transfer') or (recorded_by is null and note is null))
  );

create index booking_payments_manual_idx on public.booking_payments (tenant_id, paid_at)
  where kind in ('cash', 'bank_transfer');
