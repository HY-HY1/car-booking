-- UK GDPR support.
--
-- Roles: each business (tenant) is the controller of its customers' data and
-- ASCND is its processor. ASCND is the controller of the business owners' own
-- account data. This migration adds what the controller side needs:
--   * controller details for the privacy notice (legal name, contact, ICO no.)
--   * a retention period per business
--   * a consent history (PECR/ICO accountability) kept by trigger
--   * a log of data-subject requests with the one-month deadline
--   * erasure that keeps what must be kept (bookings, for accounts and tax)
--     but strips the person out of it
--   * a finder for customers past their retention period
--   * a record of when each owner accepted the terms and data processing terms

-- ---------------------------------------------------------------------------
-- Controller details and retention
-- ---------------------------------------------------------------------------

alter table public.tenants
  add column legal_name text,
  add column privacy_email text check (privacy_email = lower(privacy_email)),
  add column ico_registration text,
  -- Months after a customer's last enquiry, booking or contact before their
  -- details are erased. Bookings themselves are kept without the personal
  -- details; see public.anonymise_customer.
  add column retention_months int not null default 36
    check (retention_months between 12 and 84),
  add column terms_accepted_at timestamptz,
  add column terms_version text;

-- Owners edit these in Settings. The terms columns are written by the
-- platform at signup, not by the browser.
grant update (legal_name, privacy_email, ico_registration, retention_months)
  on public.tenants to authenticated;

-- ---------------------------------------------------------------------------
-- Customers: erased marker
-- ---------------------------------------------------------------------------

alter table public.customers add column anonymised_at timestamptz;

-- An erased customer has no contact details left.
alter table public.customers drop constraint customers_has_contact;
alter table public.customers add constraint customers_has_contact
  check (email is not null or phone is not null or anonymised_at is not null);

-- ---------------------------------------------------------------------------
-- Consent history
-- ---------------------------------------------------------------------------
-- customers holds the current choice; this holds every change, so a business
-- can show when and how someone opted in. Written only by the trigger below.

create table public.consent_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  granted boolean not null,
  basis text check (basis in ('consent', 'soft_opt_in')),
  created_at timestamptz not null default now()
);

create index consent_log_customer_idx on public.consent_log (customer_id, created_at desc);

create or replace function private.log_consent_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  was_email boolean := false;
  was_sms boolean := false;
  was_whatsapp boolean := false;
begin
  if tg_op = 'UPDATE' then
    was_email := old.email_marketing;
    was_sms := old.sms_marketing;
    was_whatsapp := old.whatsapp_marketing;
  end if;

  for c in
    select * from (values
      ('email', new.email_marketing, was_email),
      ('sms', new.sms_marketing, was_sms),
      ('whatsapp', new.whatsapp_marketing, was_whatsapp)
    ) as t (channel, now_on, was_on)
  loop
    if c.now_on is distinct from c.was_on then
      insert into public.consent_log (tenant_id, customer_id, channel, granted, basis)
      values (new.tenant_id, new.id, c.channel, c.now_on, case when c.now_on then new.marketing_basis end);
    end if;
  end loop;
  return new;
end;
$$;

create trigger customers_log_consent
  after insert or update of email_marketing, sms_marketing, whatsapp_marketing on public.customers
  for each row execute function private.log_consent_change();

alter table public.consent_log enable row level security;
revoke all on public.consent_log from anon;
revoke insert, update, delete on public.consent_log from authenticated;

create policy "Members can view their tenant's consent history"
  on public.consent_log for select to authenticated
  using (private.is_tenant_member (tenant_id));

-- ---------------------------------------------------------------------------
-- Data-subject requests
-- ---------------------------------------------------------------------------
-- Access, erasure, correction, objection. The clock is one month from receipt
-- (extendable by two more for complex requests). Never deleted, so a business
-- can show how it handled each one.

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Set once the owner has matched the request to a customer record.
  customer_id uuid references public.customers (id) on delete set null,
  kind text not null check (kind in ('access', 'erasure', 'correction', 'objection', 'other')),
  requester_name text not null check (length(trim(requester_name)) > 0),
  -- Cleared when the matching customer is erased.
  requester_email text check (requester_email = lower(requester_email)),
  details text,
  -- website = sent from the privacy page; manual = logged by the owner.
  source text not null default 'website' check (source in ('website', 'manual')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'refused')),
  -- The owner must be satisfied who is asking before acting on a request.
  identity_checked boolean not null default false,
  received_at timestamptz not null default now(),
  due_at timestamptz not null default now() + interval '1 month',
  closed_at timestamptz,
  outcome_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index data_requests_tenant_status_idx on public.data_requests (tenant_id, status, due_at);
create index data_requests_customer_idx on public.data_requests (customer_id);

create trigger data_requests_set_updated_at before update on public.data_requests
  for each row execute function private.set_updated_at();

alter table public.data_requests enable row level security;
revoke all on public.data_requests from anon;
revoke delete on public.data_requests from authenticated;

create policy "Members can view their tenant's data requests"
  on public.data_requests for select to authenticated
  using (private.is_tenant_member (tenant_id));

create policy "Members can log data requests"
  on public.data_requests for insert to authenticated
  with check (private.is_tenant_member (tenant_id) and source = 'manual');

create policy "Members can update their tenant's data requests"
  on public.data_requests for update to authenticated
  using (private.is_tenant_member (tenant_id))
  with check (private.is_tenant_member (tenant_id));

revoke update on public.data_requests from authenticated;
grant update (customer_id, status, identity_checked, closed_at, outcome_notes)
  on public.data_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Erasure
-- ---------------------------------------------------------------------------
-- A customer with no bookings is deleted outright. One with bookings is
-- anonymised instead: the booking rows stay (the business needs its sales
-- records for accounts and tax, usually six years) but name, contact details,
-- address, notes, vehicles, photos and quote snapshots go. Photo files in
-- Storage are removed by the caller first; this function only handles rows.
--
-- Callable only with the secret key. The caller supplies the tenant it worked
-- out itself, so one business can never erase another's customer.

create or replace function public.anonymise_customer(p_tenant uuid, p_customer uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_bookings boolean;
begin
  if not exists (
    select 1 from public.customers where id = p_customer and tenant_id = p_tenant
  ) then
    return 'not_found';
  end if;

  select exists (select 1 from public.bookings where customer_id = p_customer) into has_bookings;

  update public.data_requests
    set requester_email = null, requester_name = 'Erased'
    where tenant_id = p_tenant and customer_id = p_customer;

  if not has_bookings then
    delete from public.customers where id = p_customer and tenant_id = p_tenant;
    return 'deleted';
  end if;

  update public.bookings
    set address_line = null,
        customer_notes = null,
        access_notes = '{}',
        -- Keep the outward code (BS1) for the business's area stats.
        postcode = upper(split_part(postcode, ' ', 1)),
        quote_snapshot = quote_snapshot - 'contact'
    where customer_id = p_customer;

  update public.leads
    set quote_snapshot = null, lost_reason = null
    where customer_id = p_customer;

  delete from public.photos where customer_id = p_customer;
  delete from public.vehicles where customer_id = p_customer;

  update public.customers
    set name = 'Erased customer',
        email = null,
        phone = null,
        address_line = null,
        postcode = null,
        notes = null,
        email_marketing = false,
        sms_marketing = false,
        whatsapp_marketing = false,
        marketing_basis = null,
        marketing_updated_at = now(),
        anonymised_at = now()
    where id = p_customer and tenant_id = p_tenant;

  return 'anonymised';
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------
-- Customers whose last activity (created, enquiry, booking) is older than
-- their business's retention period. The weekly job erases them.

create or replace function public.find_stale_customers(p_limit int default 200)
returns table (tenant_id uuid, customer_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select c.tenant_id, c.id
  from public.customers c
  join public.tenants t on t.id = c.tenant_id
  where c.anonymised_at is null
    and greatest(
      c.created_at,
      c.updated_at,
      coalesce((select max(b.ends_at) from public.bookings b where b.customer_id = c.id), c.created_at),
      coalesce((select max(b.created_at) from public.bookings b where b.customer_id = c.id), c.created_at),
      coalesce((select max(l.updated_at) from public.leads l where l.customer_id = c.id), c.created_at)
    ) < now() - make_interval(months => t.retention_months)
  order by c.created_at
  limit p_limit;
$$;

-- Both functions bypass RLS, so only the secret key may run them.
revoke execute on function public.anonymise_customer (uuid, uuid) from public, anon, authenticated;
revoke execute on function public.find_stale_customers (int) from public, anon, authenticated;
grant execute on function public.anonymise_customer (uuid, uuid) to service_role;
grant execute on function public.find_stale_customers (int) to service_role;
