-- Fixes from the 17 Nov 2026 pre-launch audit.

-- --------------------------------------------------------------- double opt-in
-- Ticking "send me offers" on the booking page no longer opts a customer in:
-- anyone could tick it with someone else's address. It's recorded here as
-- asked for, and an email with a link (the booking site's /subscribe page)
-- turns it into consent (email_marketing, basis 'consent').
alter table public.customers add column email_marketing_requested_at timestamptz;

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in (
  -- To the customer
  'confirmation', 'request_received', 'declined', 'cancelled', 'late_refund',
  'reminder', 'follow_up', 'review_request', 'payment_link', 'payment_received',
  'rescheduled', 'deposit_request', 'quote_follow_up', 'rebook_reminder',
  'slot_opened', 'campaign', 'marketing_confirm',
  -- To the business
  'owner_new_booking', 'owner_cancellation', 'owner_new_lead', 'owner_dispute',
  'owner_late_refund', 'owner_payment_problem', 'owner_rescheduled'
));

-- --------------------------------------------------------------- promo limits
-- A code's max_uses was checked before the booking was inserted, so two
-- bookings at the same moment could both take its last use. Checked again
-- here with the code's row locked, so bookings using it go one at a time.
-- The engine turns 'promo_used_up' into "That code has been used up."
create or replace function private.check_promo_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap int;
  used int;
begin
  if new.promo_code_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.promo_code_id is not distinct from old.promo_code_id then return new; end if;

  select max_uses into cap from public.promo_codes where id = new.promo_code_id for update;
  if cap is null then return new; end if;

  select count(*) into used
  from public.bookings
  where promo_code_id = new.promo_code_id
    and status not in ('cancelled', 'expired')
    and id is distinct from new.id;
  if used >= cap then
    raise exception 'promo_used_up' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger bookings_promo_limit
  before insert or update of promo_code_id on public.bookings
  for each row execute function private.check_promo_limit();

-- --------------------------------------------------------------- email job
-- Reminders, aftercare, "slot opened" alerts and campaign batches run from
-- /api/jobs/emails. Vercel's Hobby plan only runs crons once a day
-- (vercel.json), so the database calls it every 15 minutes instead.
--
-- It needs two secrets in Supabase Vault, set once by hand in the SQL editor
-- (they're not in git), and does nothing until both exist:
--   select vault.create_secret('https://<your live address>', 'jobs_base_url');
--   select vault.create_secret('<the same value as CRON_SECRET in Vercel>', 'cron_secret');
-- Then set EMAIL_JOB_INTERVAL_MINUTES=15 in Vercel, so the job plans its
-- sends around 15-minute runs. The daily Vercel cron stays as a backstop:
-- every email has a dedupe key, so a second run never sends twice.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function private.call_email_job()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'jobs_base_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if base is null or secret is null then return; end if;
  perform net.http_get(
    url := rtrim(base, '/') || '/api/jobs/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.call_email_job() from public, anon, authenticated;

select cron.schedule('email-job', '*/15 * * * *', 'select private.call_email_job()');
