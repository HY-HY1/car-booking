-- Staff and techs: the people who do the jobs. A directory for now; each
-- person can be linked to the van or bay they usually work from and to one of
-- the coverage territories (booking_settings.service_area -> territories) so
-- a multi-person crew can be laid out. Neither link changes who can be
-- booked yet, and a person here has no login.

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- What they do, shown on the list: "Lead detailer", "Trainee".
  job_title text,
  phone text,
  email text,
  notes text,
  -- Usual van or bay. Deleting the van just clears this.
  resource_id uuid,
  -- The id of a territory in service_area. Not a foreign key: territories
  -- are stored inside the settings row.
  territory_id text,
  -- Switched off = on the list for the records, not offered for anything new.
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The van has to belong to the same business. Deleting it clears only
  -- resource_id (tenant_id is not nullable).
  constraint staff_resource_fkey foreign key (resource_id, tenant_id)
    references public.resources (id, tenant_id) on delete set null (resource_id)
);

create index staff_tenant_idx on public.staff (tenant_id, sort_order);

create trigger staff_set_updated_at before update on public.staff
  for each row execute function private.set_updated_at();

alter table public.staff enable row level security;
revoke all on public.staff from anon;

create policy "Members can view staff" on public.staff
  for select to authenticated using (private.is_tenant_member (tenant_id));
create policy "Owners can add staff" on public.staff
  for insert to authenticated with check (private.is_tenant_member (tenant_id, array['owner']));
create policy "Owners can update staff" on public.staff
  for update to authenticated
  using (private.is_tenant_member (tenant_id, array['owner']))
  with check (private.is_tenant_member (tenant_id, array['owner']));
create policy "Owners can delete staff" on public.staff
  for delete to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

revoke update on public.staff from authenticated;
grant update (name, job_title, phone, email, notes, resource_id, territory_id, active, sort_order)
  on public.staff to authenticated;
