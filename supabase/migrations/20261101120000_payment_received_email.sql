-- A thank-you with the receipt when a customer pays a payment link
-- (email/notify.ts notifyPaymentReceived), logged like every other email.

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in (
  -- To the customer
  'confirmation', 'request_received', 'declined', 'cancelled', 'late_refund',
  'reminder', 'follow_up', 'review_request', 'payment_link', 'payment_received',
  -- To the business
  'owner_new_booking', 'owner_cancellation', 'owner_new_lead', 'owner_dispute',
  'owner_late_refund', 'owner_payment_problem'
));
