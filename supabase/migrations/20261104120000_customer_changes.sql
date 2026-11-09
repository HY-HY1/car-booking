-- Customers cancelling or moving their own bookings, from the link in their
-- emails (booking/manage.ts), within the business's cancellation policy; and
-- the business asking for a deposit on a booking it made itself.

-- When a booking was cancelled and by whom. Set by the trigger below on every
-- path to 'cancelled' (the diary, declining a request), so the dashboard and
-- the refund advice can count from the moment it happened rather than the
-- row's last change. The customer's own cancellation sets cancelled_by itself.
alter table public.bookings
  add column cancelled_at timestamptz,
  add column cancelled_by text check (cancelled_by in ('business', 'customer')),
  -- The last time the customer moved it, and where from.
  add column rescheduled_at timestamptz,
  add column rescheduled_from timestamptz,
  add column reschedule_count int not null default 0 check (reschedule_count >= 0);

create function private.stamp_cancellation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
    new.cancelled_by := coalesce(new.cancelled_by, 'business');
  elsif new.status <> 'cancelled' and old.status = 'cancelled' then
    -- Put back from the diary.
    new.cancelled_at := null;
    new.cancelled_by := null;
  end if;
  return new;
end;
$$;

create trigger bookings_stamp_cancellation before update of status on public.bookings
  for each row execute function private.stamp_cancellation();

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in (
  -- To the customer
  'confirmation', 'request_received', 'declined', 'cancelled', 'late_refund',
  'reminder', 'follow_up', 'review_request', 'payment_link', 'payment_received',
  'rescheduled', 'deposit_request',
  -- To the business
  'owner_new_booking', 'owner_cancellation', 'owner_new_lead', 'owner_dispute',
  'owner_late_refund', 'owner_payment_problem', 'owner_rescheduled'
));
