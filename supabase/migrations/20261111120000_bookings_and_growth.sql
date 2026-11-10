-- Running jobs and winning repeat work: notes, assignment, repeats, extra cars,
-- job photos, invoices, promo codes, travel fees, lead follow-up, campaigns,
-- rebooking reminders and merging customers.

-- --------------------------------------------------------------- bookings

alter table public.bookings
  -- For the team only: never shown to or sent to the customer.
  add column internal_notes text check (char_length(internal_notes) <= 4000),
  add column cancel_reason text check (char_length(cancel_reason) <= 500),
  -- Who's doing it. The van or bay still decides when it can happen.
  add column staff_id uuid references public.staff (id) on delete set null,
  -- Shared by every booking made together as a repeat.
  add column series_id uuid,
  add column invoice_number int,
  add column invoiced_at timestamptz;

create index bookings_series_idx on public.bookings (tenant_id, series_id) where series_id is not null;
create unique index bookings_invoice_number_idx on public.bookings (tenant_id, invoice_number) where invoice_number is not null;

grant update (internal_notes, cancel_reason) on public.bookings to authenticated;

alter table public.tenants add column next_invoice_number int not null default 1;

-- Invoice numbers run in order with no gaps, and a booking keeps the one it
-- was given however many times the invoice is opened.
create or replace function public.assign_invoice_number(p_tenant uuid, p_booking uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  select invoice_number into n from public.bookings
    where id = p_booking and tenant_id = p_tenant for update;
  if not found then return null; end if;
  if n is not null then return n; end if;
  update public.tenants set next_invoice_number = next_invoice_number + 1
    where id = p_tenant returning next_invoice_number - 1 into n;
  update public.bookings set invoice_number = n, invoiced_at = now() where id = p_booking and tenant_id = p_tenant;
  return n;
end;
$$;

revoke execute on function public.assign_invoice_number (uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_invoice_number (uuid, uuid) to service_role;

-- More than one car on a booking. The first stays on bookings.vehicle_id.
create table public.booking_vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  make text,
  model text,
  registration text,
  size_class text,
  price_pence int not null default 0 check (price_pence >= 0),
  extra_mins int not null default 0 check (extra_mins >= 0),
  created_at timestamptz not null default now()
);

create index booking_vehicles_booking_idx on public.booking_vehicles (tenant_id, booking_id);

alter table public.booking_vehicles enable row level security;
revoke all on public.booking_vehicles from anon, authenticated;
grant select on public.booking_vehicles to authenticated;
create policy "Members can view extra cars" on public.booking_vehicles
  for select to authenticated using (private.is_tenant_member (tenant_id));

-- ------------------------------------------------------------------ photos

alter table public.photos
  add column stage text not null default 'customer' check (stage in ('customer', 'before', 'after'));

-- ----------------------------------------------------------------- pricing

alter table public.booking_settings add column travel_fee jsonb;
grant update (travel_fee) on public.booking_settings to authenticated;

-- How many weeks until this service is due again; null = no reminder.
alter table public.services add column rebook_weeks int check (rebook_weeks between 1 and 104);
grant update (rebook_weeks) on public.services to authenticated;

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null check (code = upper(code) and char_length(code) between 2 and 30),
  kind text not null check (kind in ('percent', 'fixed')),
  -- A percentage from 1 to 100, or pence off.
  value int not null check (value > 0),
  max_uses int check (max_uses > 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

alter table public.promo_codes enable row level security;
revoke all on public.promo_codes from anon;
create policy "Owners can manage promo codes" on public.promo_codes
  for all to authenticated
  using (private.is_tenant_member (tenant_id, array['owner']))
  with check (private.is_tenant_member (tenant_id, array['owner']));

-- Uses are counted from the bookings themselves, so a cancelled booking or an
-- abandoned checkout gives its use back.
alter table public.bookings add column promo_code_id uuid references public.promo_codes (id) on delete set null;
create index bookings_promo_idx on public.bookings (promo_code_id) where promo_code_id is not null;

-- ------------------------------------------------------------------- leads

alter table public.leads
  add column notes text check (char_length(notes) <= 4000),
  -- A lead from somewhere else (a Facebook or Instagram lead form): its id
  -- there, so it's only ever added once, and the questions and answers.
  add column external_id text check (char_length(external_id) <= 200),
  add column form_answers jsonb;
grant update (notes) on public.leads to authenticated;
create unique index leads_external_idx on public.leads (tenant_id, external_id) where external_id is not null;

-- --------------------------------------------------------------- campaigns

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 150),
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  -- Sent in batches by the scheduled job; this is how far it has got.
  last_customer_id uuid,
  sent_count int not null default 0
);

create index campaigns_tenant_idx on public.campaigns (tenant_id, created_at desc);
create index campaigns_sending_idx on public.campaigns (status) where status = 'sending';

alter table public.campaigns enable row level security;
revoke all on public.campaigns from anon, authenticated;
grant select on public.campaigns to authenticated;
create policy "Owners and managers can view campaigns" on public.campaigns
  for select to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in (
  -- To the customer
  'confirmation', 'request_received', 'declined', 'cancelled', 'late_refund',
  'reminder', 'follow_up', 'review_request', 'payment_link', 'payment_received',
  'rescheduled', 'deposit_request', 'quote_follow_up', 'rebook_reminder',
  'slot_opened', 'campaign',
  -- To the business
  'owner_new_booking', 'owner_cancellation', 'owner_new_lead', 'owner_dispute',
  'owner_late_refund', 'owner_payment_problem', 'owner_rescheduled'
));

-- --------------------------------------------------------------- customers

-- Folds one customer into another in a single transaction. The one kept
-- keeps its own marketing choices: consent given to one record isn't assumed
-- for the other. Its blanks are filled from the one removed.
create or replace function public.merge_customers(p_tenant uuid, p_keep uuid, p_remove uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone public.customers%rowtype;
begin
  if p_keep = p_remove then return 'same'; end if;
  perform 1 from public.customers
    where id = p_keep and tenant_id = p_tenant and anonymised_at is null for update;
  if not found then return 'not_found'; end if;
  select * into gone from public.customers
    where id = p_remove and tenant_id = p_tenant and anonymised_at is null for update;
  if not found then return 'not_found'; end if;

  update public.vehicles set customer_id = p_keep where customer_id = p_remove and tenant_id = p_tenant;
  update public.leads set customer_id = p_keep where customer_id = p_remove and tenant_id = p_tenant;
  update public.bookings set customer_id = p_keep where customer_id = p_remove and tenant_id = p_tenant;
  update public.photos set customer_id = p_keep where customer_id = p_remove and tenant_id = p_tenant;
  update public.consent_log set customer_id = p_keep where customer_id = p_remove and tenant_id = p_tenant;
  update public.data_requests set customer_id = p_keep where customer_id = p_remove and tenant_id = p_tenant;
  update public.email_log set customer_id = p_keep where customer_id = p_remove and tenant_id = p_tenant;

  -- Removed first: email and phone are unique within a business.
  delete from public.customers where id = p_remove and tenant_id = p_tenant;

  update public.customers c set
    email = coalesce(c.email, gone.email),
    phone = coalesce(c.phone, gone.phone),
    address_line = coalesce(c.address_line, gone.address_line),
    postcode = coalesce(c.postcode, gone.postcode),
    notes = case
      when gone.notes is null then c.notes
      when c.notes is null then gone.notes
      else c.notes || E'\n\n' || gone.notes
    end
  where c.id = p_keep and c.tenant_id = p_tenant;

  return 'merged';
end;
$$;

revoke execute on function public.merge_customers (uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_customers (uuid, uuid, uuid) to service_role;

-- Erasing a customer now also clears what the team wrote about the job.
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

  delete from public.booking_vehicles
    where booking_id in (select id from public.bookings where customer_id = p_customer);

  update public.bookings
    set address_line = null,
        customer_notes = null,
        internal_notes = null,
        cancel_reason = null,
        access_notes = '{}',
        -- Keep the outward code (BS1) for the business's area stats.
        postcode = upper(split_part(postcode, ' ', 1)),
        quote_snapshot = quote_snapshot - 'contact'
    where customer_id = p_customer;

  update public.leads
    set quote_snapshot = null, lost_reason = null, notes = null, form_answers = null
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

-- ---------------------------------------------------- two-factor on new tables

create policy "Second factor required" on public.booking_vehicles as restrictive for all to authenticated
  using ((select private.second_factor_satisfied())) with check ((select private.second_factor_satisfied()));
create policy "Second factor required" on public.promo_codes as restrictive for all to authenticated
  using ((select private.second_factor_satisfied())) with check ((select private.second_factor_satisfied()));
create policy "Second factor required" on public.campaigns as restrictive for all to authenticated
  using ((select private.second_factor_satisfied())) with check ((select private.second_factor_satisfied()));
