-- Payment links can be emailed to the customer (Payments → Payment links, or
-- a booking's "Email payment link"). Each send is logged in email_log like
-- any other email, and the link remembers when it was last sent.

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in (
  -- To the customer
  'confirmation', 'request_received', 'declined', 'cancelled', 'late_refund',
  'reminder', 'follow_up', 'review_request', 'payment_link',
  -- To the business
  'owner_new_booking', 'owner_cancellation', 'owner_new_lead', 'owner_dispute',
  'owner_late_refund', 'owner_payment_problem'
));

alter table public.payment_links add column emailed_at timestamptz;
