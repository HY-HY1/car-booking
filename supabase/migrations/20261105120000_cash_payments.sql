-- Cash taken on the day, recorded by the business against a booking ("Add cash
-- payment" on the booking's page, booking/cash.ts). It goes in the same ledger
-- as card payments so "paid" and "to pay" count it, with the id
-- 'cash_<uuid>' in place of a Stripe charge id, who recorded it, and a note.
-- (As applied. Widened to bank transfers in 20261105130000_bank_transfers.sql.)

alter table public.booking_payments drop constraint booking_payments_kind_check;
alter table public.booking_payments add constraint booking_payments_kind_check
  check (kind in ('deposit', 'payment_link', 'other', 'cash'));

alter table public.booking_payments
  add column recorded_by uuid references auth.users (id) on delete set null,
  add column note text check (char_length(note) <= 200),
  -- Only cash is written by hand; everything else comes from Stripe.
  add constraint booking_payments_cash_shape check (
    (kind = 'cash') = (stripe_charge_id like 'cash\_%')
    and (kind = 'cash' or (recorded_by is null and note is null))
  );

create index booking_payments_cash_idx on public.booking_payments (tenant_id, paid_at) where kind = 'cash';
