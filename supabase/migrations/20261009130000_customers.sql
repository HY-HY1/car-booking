-- Customers: one row per person per tenant. The same person booking two
-- different detailers is two separate customers, one in each tenant.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  email text check (email = lower(email)),
  -- Stored in E.164 (+447700900123) so it matches WhatsApp and SMS numbers.
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  address_line text,
  postcode text check (postcode = upper(postcode)),
  notes text,
  -- Where they first came from: booking_page, instagram, referral, manual...
  source text not null default 'manual',

  -- Marketing consent, per channel (UK PECR). Service messages such as
  -- confirmations and reminders don't need these; retention nudges and
  -- some follow-ups do. The basis and timestamp record how and when the
  -- current choices were given, for ICO purposes.
  email_marketing boolean not null default false,
  sms_marketing boolean not null default false,
  whatsapp_marketing boolean not null default false,
  marketing_basis text check (marketing_basis in ('consent', 'soft_opt_in')),
  marketing_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customers_has_contact check (email is not null or phone is not null)
);

-- One customer per email and per phone within a tenant, so the booking flow
-- can find returning customers instead of creating duplicates.
create unique index customers_tenant_email_key on public.customers (tenant_id, email) where email is not null;
create unique index customers_tenant_phone_key on public.customers (tenant_id, phone) where phone is not null;
create index customers_tenant_created_idx on public.customers (tenant_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function private.set_updated_at();

-- Row Level Security: members of the tenant can view, add and edit its
-- customers; only owners can delete them.
alter table public.customers enable row level security;

revoke all on public.customers from anon;

create policy "Members can view their tenant's customers"
  on public.customers for select to authenticated
  using (private.is_tenant_member (tenant_id));

create policy "Members can add customers to their tenant"
  on public.customers for insert to authenticated
  with check (private.is_tenant_member (tenant_id));

create policy "Members can update their tenant's customers"
  on public.customers for update to authenticated
  using (private.is_tenant_member (tenant_id))
  with check (private.is_tenant_member (tenant_id));

create policy "Owners can delete their tenant's customers"
  on public.customers for delete to authenticated
  using (private.is_tenant_member (tenant_id, array['owner']));

-- A customer can't be moved to another tenant, and timestamps are managed
-- by the database.
revoke update on public.customers from authenticated;
grant update (
  name, email, phone, address_line, postcode, notes, source,
  email_marketing, sms_marketing, whatsapp_marketing,
  marketing_basis, marketing_updated_at
) on public.customers to authenticated;
