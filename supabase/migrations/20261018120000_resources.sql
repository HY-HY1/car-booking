-- Vans and bays. Until now a business could hold one job at a time. A resource
-- is one thing that can do a job: a van, a bay in the shop, a person who
-- works both. Each takes one job at a time, so three vans means three jobs
-- at once. A time is bookable if any suitable resource is free, and the booking
-- is assigned to one of them.
--
-- Also: separate opening hours for the shop, and a separate gap between shop
-- jobs (no travelling, but time to turn a bay around).

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- Where this one works: out on the road, at the shop, or either.
  location_types text[] not null default '{mobile}'
    check (location_types <@ '{mobile,unit}' and cardinality(location_types) > 0),
  -- Its own hours, same shape as booking_settings.weekly_hours. Null = follow
  -- the business's hours for the kind of job (mobile or shop).
  weekly_hours jsonb,
  -- Switched off = takes no new bookings; past bookings keep their record.
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets other tables prove their resource belongs to the same business.
  constraint resources_id_tenant_key unique (id, tenant_id)
);

create index resources_tenant_idx on public.resources (tenant_id, sort_order);

create trigger resources_set_updated_at before update on public.resources
  for each row execute function private.set_updated_at();

alter table public.resources enable row level security;
revoke all on public.resources from anon;

create policy "Members can view resources" on public.resources
  for select to authenticated using (private.is_tenant_member (tenant_id));
create policy "Owners can add resources" on public.resources
  for insert to authenticated with check (private.is_tenant_member (tenant_id, array['owner']));
create policy "Owners can update resources" on public.resources
  for update to authenticated
  using (private.is_tenant_member (tenant_id, array['owner']))
  with check (private.is_tenant_member (tenant_id, array['owner']));
create policy "Owners can delete resources" on public.resources
  for delete to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

revoke update on public.resources from authenticated;
grant update (name, location_types, weekly_hours, active, sort_order) on public.resources to authenticated;

-- Shop hours and the gap between shop jobs. Existing businesses keep exactly
-- the gap they had (it used to apply to every job).
alter table public.booking_settings
  add column unit_weekly_hours jsonb,
  add column unit_buffer_mins int not null default 0 check (unit_buffer_mins >= 0);

update public.booking_settings set unit_buffer_mins = travel_buffer_mins;

grant update (unit_weekly_hours, unit_buffer_mins) on public.booking_settings to authenticated;

-- Everyone who already takes bookings gets a van and/or a shop to match what
-- they offer, or what they've already booked.
insert into public.resources (tenant_id, name, location_types, sort_order)
select t.id, case l.type when 'mobile' then 'Van' else 'Shop' end, array[l.type], l.ord
from public.tenants t
cross join (values ('mobile', 0), ('unit', 1)) as l (type, ord)
left join public.booking_settings s on s.tenant_id = t.id
where (l.type = 'mobile' and coalesce(s.offers_mobile, false))
  or (l.type = 'unit' and coalesce(s.offers_unit, false))
  or exists (
    select 1 from public.bookings b where b.tenant_id = t.id and b.location_type = l.type
  );

-- Bookings belong to a resource, and two live bookings can't overlap on the
-- same one. (Before: none could overlap in the whole business.) A resource
-- with bookings can't be deleted; it's switched off instead.
alter table public.bookings add column resource_id uuid;

update public.bookings b
set resource_id = r.id
from public.resources r
where r.tenant_id = b.tenant_id and r.location_types = array[b.location_type];

alter table public.bookings alter column resource_id set not null;
alter table public.bookings
  add constraint bookings_resource_fk foreign key (resource_id, tenant_id)
  references public.resources (id, tenant_id);

alter table public.bookings drop constraint bookings_no_overlap;
alter table public.bookings
  add constraint bookings_resource_no_overlap exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('held', 'confirmed'));

create index bookings_resource_starts_idx on public.bookings (resource_id, starts_at);

-- Time off for the whole business (null) or for just one van or bay.
alter table public.blocked_times add column resource_id uuid;
alter table public.blocked_times
  add constraint blocked_times_resource_fk foreign key (resource_id, tenant_id)
  references public.resources (id, tenant_id) on delete cascade;

grant update (resource_id) on public.blocked_times to authenticated;
