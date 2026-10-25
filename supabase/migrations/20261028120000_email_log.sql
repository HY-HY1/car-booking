-- Every email the platform sends: confirmations, reminders and follow-ups to
-- customers, and alerts to the business. One row per message, claimed before
-- it's sent, so a webhook delivered twice or a job that runs again can never
-- send the same message twice (the dedupe key is unique per business).
--
-- No addresses, subjects or bodies are stored: the row says what was sent
-- about which booking, and the customer's details stay on the customer, so
-- erasing or anonymising a customer leaves nothing personal behind here.
-- Written only by server code with the secret key (packages/core/src/email).

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in (
    -- To the customer
    'confirmation', 'request_received', 'declined', 'cancelled', 'late_refund',
    'reminder', 'follow_up', 'review_request',
    -- To the business
    'owner_new_booking', 'owner_cancellation', 'owner_new_lead', 'owner_dispute',
    'owner_late_refund', 'owner_payment_problem'
  )),
  audience text not null check (audience in ('customer', 'owner')),
  booking_id uuid references public.bookings (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  dedupe_key text not null check (length(dedupe_key) <= 200),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  -- The provider's message id (Resend), or 'console' in development.
  provider_id text,
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (tenant_id, dedupe_key)
);

create index email_log_booking_idx on public.email_log (booking_id) where booking_id is not null;
create index email_log_tenant_idx on public.email_log (tenant_id, created_at desc);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon;
revoke all on public.email_log from authenticated;
grant select on public.email_log to authenticated;

create policy "Members can view their email log" on public.email_log
  for select to authenticated using (private.is_tenant_member (tenant_id));
