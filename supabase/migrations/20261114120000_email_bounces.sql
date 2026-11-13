-- What happened to an email after it left: Resend tells us (POST
-- /api/webhooks/resend) when one bounces or the reader marks it as spam.
--
-- email_log gains two outcomes, 'bounced' and 'complained', found by the
-- provider's message id. A customer whose address bounced for good gets
-- email_bounced_at, and their emails aren't sent again until the address is
-- changed (the trigger below clears it), since repeated bounces hurt the
-- business's sending reputation. A spam complaint opts them out of marketing
-- (privacy/data.ts unsubscribeCustomer), done by the webhook.

alter table public.email_log drop constraint email_log_status_check;
alter table public.email_log add constraint email_log_status_check
  check (status in ('sending', 'sent', 'failed', 'bounced', 'complained'));

create index email_log_provider_idx on public.email_log (provider_id) where provider_id is not null;

-- Server-written only: authenticated users have column-level update grants
-- on customers (20261009130000_customers.sql) that don't include it.
alter table public.customers add column email_bounced_at timestamptz;

create or replace function private.clear_email_bounce()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    new.email_bounced_at := null;
  end if;
  return new;
end;
$$;

create trigger customers_clear_email_bounce
  before update of email on public.customers
  for each row execute function private.clear_email_bounce();
