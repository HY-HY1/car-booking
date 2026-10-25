-- Booking engine: what a tenant sells, when they work, and the leads and
-- bookings that come in. Same pattern as customers: tenant_id on every row,
-- RLS through private.is_tenant_member(). The public booking app never
-- touches these tables as a signed-in user; it goes through the engine in
-- packages/core with the secret key, taking tenant_id from the hostname.

create extension if not exists btree_gist with schema extensions;

-- One row per tenant: hours, service area, deposit and pricing rules that
-- aren't tied to a single service. Shapes of the json columns are validated
-- in packages/core/src/booking/config.ts.
create table public.booking_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  timezone text not null default 'Europe/London',
  -- {"mon": [["08:00", "17:00"]], "tue": [...], ...}; missing day = closed.
  weekly_hours jsonb not null default '{}',
  slot_interval_mins int not null default 30 check (slot_interval_mins between 5 and 240),
  min_notice_hours int not null default 24 check (min_notice_hours >= 0),
  max_days_ahead int not null default 60 check (max_days_ahead between 1 and 365),
  -- Minimum gap between jobs; longer when the postcodes are far apart.
  travel_buffer_mins int not null default 30 check (travel_buffer_mins >= 0),
  -- How long a held slot is kept while the customer pays the deposit.
  hold_minutes int not null default 15 check (hold_minutes between 5 and 120),

  offers_mobile boolean not null default true,
  offers_unit boolean not null default false,
  unit_address text,
  unit_postcode text,
  -- Where the van starts from; the centre of a radius service area.
  base_postcode text,
  -- {"districts": ["BS1", "BS16"]} or {"radius_miles": 15}; {} = anywhere.
  service_area jsonb not null default '{}',

  -- {"type": "percent", "value": 25} or {"type": "fixed", "value_pence": 2000}
  -- or {"type": "none"}.
  deposit jsonb not null default '{"type": "percent", "value": 25}',
  min_price_pence int not null default 0 check (min_price_pence >= 0),
  mobile_surcharge_pence int not null default 0 check (mobile_surcharge_pence >= 0),
  -- [{"key": "light", "label": "Light", "multiplier": 1}, {"key": "heavy",
  --   "label": "Heavy", "multiplier": 1.3, "extra_mins": 60},
  --  {"key": "severe", "label": "Severe", "needs_inspection": true}]
  condition_tiers jsonb not null default '[]',

  updated_at timestamptz not null default now(),

  constraint booking_settings_offers_something check (offers_mobile or offers_unit),
  constraint booking_settings_unit_needs_postcode check (not offers_unit or unit_postcode is not null)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  duration_mins int not null check (duration_mins between 15 and 1440),
  base_price_pence int not null check (base_price_pence >= 0),
  -- Extra price and time per vehicle size, on top of the base:
  -- {"large": {"price_pence": 2000, "extra_mins": 30}, "xl": {...}}.
  -- Sizes are fixed platform-wide: small, medium, large, xl.
  size_adjustments jsonb not null default '{}',
  -- Which locations this service can be done at.
  location_types text[] not null default '{mobile,unit}'
    check (location_types <@ '{mobile,unit}' and cardinality(location_types) > 0),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_tenant_idx on public.services (tenant_id, sort_order);

create table public.add_ons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  price_pence int not null check (price_pence >= 0),
  duration_mins int not null default 0 check (duration_mins >= 0),
  -- Services this add-on can go with; null = all of them.
  service_ids uuid[],
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index add_ons_tenant_idx on public.add_ons (tenant_id, sort_order);

-- Holidays, personal time, van in for a service...
create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index blocked_times_tenant_idx on public.blocked_times (tenant_id, starts_at);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  make text,
  model text,
  registration text check (registration = upper(registration)),
  size_class text not null check (size_class in ('small', 'medium', 'large', 'xl')),
  created_at timestamptz not null default now()
);

create index vehicles_customer_idx on public.vehicles (customer_id);

-- Anyone who got far enough to leave contact details. Moves to booked when a
-- booking is confirmed; the Follow-up Agent chases the rest.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'quoted', 'booked', 'lost')),
  source text not null default 'booking_page',
  -- The last quote shown (service, size, add-ons, lines, total), so the owner
  -- and follow-ups see exactly what the customer saw.
  quote_snapshot jsonb,
  last_contacted_at timestamptz,
  attempts int not null default 0,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_tenant_status_idx on public.leads (tenant_id, status, created_at desc);
create index leads_customer_idx on public.leads (customer_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'held'
    check (status in ('held', 'confirmed', 'completed', 'cancelled', 'no_show', 'expired')),
  hold_expires_at timestamptz,

  location_type text not null check (location_type in ('mobile', 'unit')),
  address_line text,
  postcode text not null check (postcode = upper(postcode)),
  -- Detailing questions: water and power access, parking, where the car is.
  access_notes jsonb not null default '{}',
  customer_notes text,

  -- Everything the price was built from, frozen at booking time.
  quote_snapshot jsonb not null,
  price_pence int not null check (price_pence >= 0),
  deposit_pence int not null default 0 check (deposit_pence >= 0),
  deposit_status text not null default 'none'
    check (deposit_status in ('none', 'pending', 'paid', 'refunded', 'waived')),
  stripe_checkout_session_id text unique,

  source text not null default 'booking_page',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (ends_at > starts_at),
  check (status <> 'held' or hold_expires_at is not null),

  -- One van per tenant for now (multiple vans is V3): live bookings can't
  -- overlap. This is the backstop for two customers grabbing the same slot
  -- at once; travel gaps are enforced by the availability check.
  constraint bookings_no_overlap exclude using gist (
    tenant_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('held', 'confirmed'))
);

create index bookings_tenant_starts_idx on public.bookings (tenant_id, starts_at);
create index bookings_customer_idx on public.bookings (customer_id);

create trigger booking_settings_set_updated_at before update on public.booking_settings
  for each row execute function private.set_updated_at();
create trigger services_set_updated_at before update on public.services
  for each row execute function private.set_updated_at();
create trigger add_ons_set_updated_at before update on public.add_ons
  for each row execute function private.set_updated_at();
create trigger leads_set_updated_at before update on public.leads
  for each row execute function private.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();

-- Row Level Security. Config (settings, services, add-ons) is owner-only to
-- change; the diary, leads and bookings are shared with staff. Deletes are
-- owner-only. Nothing is reachable signed out.
alter table public.booking_settings enable row level security;
alter table public.services enable row level security;
alter table public.add_ons enable row level security;
alter table public.blocked_times enable row level security;
alter table public.vehicles enable row level security;
alter table public.leads enable row level security;
alter table public.bookings enable row level security;

revoke all on
  public.booking_settings, public.services, public.add_ons, public.blocked_times,
  public.vehicles, public.leads, public.bookings
from anon;

create policy "Members can view booking settings" on public.booking_settings
  for select to authenticated using (private.is_tenant_member (tenant_id));
create policy "Owners can add booking settings" on public.booking_settings
  for insert to authenticated with check (private.is_tenant_member (tenant_id, array['owner']));
create policy "Owners can update booking settings" on public.booking_settings
  for update to authenticated
  using (private.is_tenant_member (tenant_id, array['owner']))
  with check (private.is_tenant_member (tenant_id, array['owner']));

create policy "Members can view services" on public.services
  for select to authenticated using (private.is_tenant_member (tenant_id));
create policy "Owners can add services" on public.services
  for insert to authenticated with check (private.is_tenant_member (tenant_id, array['owner']));
create policy "Owners can update services" on public.services
  for update to authenticated
  using (private.is_tenant_member (tenant_id, array['owner']))
  with check (private.is_tenant_member (tenant_id, array['owner']));
create policy "Owners can delete services" on public.services
  for delete to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

create policy "Members can view add-ons" on public.add_ons
  for select to authenticated using (private.is_tenant_member (tenant_id));
create policy "Owners can add add-ons" on public.add_ons
  for insert to authenticated with check (private.is_tenant_member (tenant_id, array['owner']));
create policy "Owners can update add-ons" on public.add_ons
  for update to authenticated
  using (private.is_tenant_member (tenant_id, array['owner']))
  with check (private.is_tenant_member (tenant_id, array['owner']));
create policy "Owners can delete add-ons" on public.add_ons
  for delete to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

create policy "Members can view blocked times" on public.blocked_times
  for select to authenticated using (private.is_tenant_member (tenant_id));
create policy "Members can add blocked times" on public.blocked_times
  for insert to authenticated with check (private.is_tenant_member (tenant_id));
create policy "Members can update blocked times" on public.blocked_times
  for update to authenticated
  using (private.is_tenant_member (tenant_id))
  with check (private.is_tenant_member (tenant_id));
create policy "Members can delete blocked times" on public.blocked_times
  for delete to authenticated using (private.is_tenant_member (tenant_id));

create policy "Members can view vehicles" on public.vehicles
  for select to authenticated using (private.is_tenant_member (tenant_id));
create policy "Members can add vehicles" on public.vehicles
  for insert to authenticated with check (private.is_tenant_member (tenant_id));
create policy "Members can update vehicles" on public.vehicles
  for update to authenticated
  using (private.is_tenant_member (tenant_id))
  with check (private.is_tenant_member (tenant_id));
create policy "Owners can delete vehicles" on public.vehicles
  for delete to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

create policy "Members can view leads" on public.leads
  for select to authenticated using (private.is_tenant_member (tenant_id));
create policy "Members can add leads" on public.leads
  for insert to authenticated with check (private.is_tenant_member (tenant_id));
create policy "Members can update leads" on public.leads
  for update to authenticated
  using (private.is_tenant_member (tenant_id))
  with check (private.is_tenant_member (tenant_id));
create policy "Owners can delete leads" on public.leads
  for delete to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

create policy "Members can view bookings" on public.bookings
  for select to authenticated using (private.is_tenant_member (tenant_id));
create policy "Members can add bookings" on public.bookings
  for insert to authenticated with check (private.is_tenant_member (tenant_id));
create policy "Members can update bookings" on public.bookings
  for update to authenticated
  using (private.is_tenant_member (tenant_id))
  with check (private.is_tenant_member (tenant_id));
create policy "Owners can delete bookings" on public.bookings
  for delete to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

-- Rows can't be moved between tenants, and money/Stripe fields are written
-- only by the engine (secret key), not by dashboard users directly.
revoke update on
  public.booking_settings, public.services, public.add_ons, public.blocked_times,
  public.vehicles, public.leads, public.bookings
from authenticated;

grant update (
  timezone, weekly_hours, slot_interval_mins, min_notice_hours, max_days_ahead,
  travel_buffer_mins, hold_minutes, offers_mobile, offers_unit, unit_address,
  unit_postcode, base_postcode, service_area, deposit, min_price_pence,
  mobile_surcharge_pence, condition_tiers
) on public.booking_settings to authenticated;
grant update (
  name, description, duration_mins, base_price_pence, size_adjustments,
  location_types, active, sort_order
) on public.services to authenticated;
grant update (
  name, description, price_pence, duration_mins, service_ids, active, sort_order
) on public.add_ons to authenticated;
grant update (starts_at, ends_at, reason) on public.blocked_times to authenticated;
grant update (make, model, registration, size_class) on public.vehicles to authenticated;
grant update (status, last_contacted_at, attempts, lost_reason) on public.leads to authenticated;
grant update (
  starts_at, ends_at, status, address_line, postcode, access_notes, customer_notes
) on public.bookings to authenticated;
