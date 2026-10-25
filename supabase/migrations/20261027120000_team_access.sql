-- Access levels: several people log in to one business, each with their own
-- account and one of four roles (packages/core/src/team/access.ts):
--
--   owner       everything, including billing, logins, Stripe, API keys and
--               closing the account
--   manager     runs the business: bookings, customers, prices, settings and
--               money, but not billing, logins, Stripe, API keys or closing
--   staff       the office: bookings, diary, customers and enquiries;
--               settings and prices are read-only, no money
--   technician  the diary and jobs only: marks them done, no customer list,
--               enquiries, money or settings
--
-- The app checks each permission on every page and action. The database
-- enforces the same lines where it can: managers pass every owner check
-- except the few kept strictly for owners, and technicians can't read or
-- write enquiries, consent history or data requests. Logins are added,
-- changed and removed by the server with the secret key (owners only).

alter table public.tenant_members drop constraint tenant_members_role_check;
alter table public.tenant_members add constraint tenant_members_role_check
  check (role in ('owner', 'manager', 'staff', 'technician'));

-- Who added this login, for the Team page.
alter table public.tenant_members
  add column invited_by uuid references auth.users (id) on delete set null;

-- A manager satisfies any policy that asks for 'owner'. Policies that must
-- stay owner-only use private.is_tenant_owner below.
create or replace function private.is_tenant_member(tid uuid, roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_members m
    where m.tenant_id = tid
      and m.user_id = (select auth.uid())
      and (
        roles is null
        or m.role = any (roles)
        or (m.role = 'manager' and 'owner' = any (roles))
      )
  );
$$;

create or replace function private.is_tenant_owner(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_members m
    where m.tenant_id = tid
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

revoke execute on function private.is_tenant_owner (uuid) from public, anon;
grant execute on function private.is_tenant_owner (uuid) to authenticated;

-- API keys stay the owner's.
drop policy "Owners can view API keys" on public.api_keys;
create policy "Owners can view API keys" on public.api_keys
  for select to authenticated using (private.is_tenant_owner (tenant_id));

-- Enquiries: not for technicians.
drop policy "Members can view leads" on public.leads;
drop policy "Members can add leads" on public.leads;
drop policy "Members can update leads" on public.leads;
create policy "Office and up can view leads" on public.leads
  for select to authenticated using (private.is_tenant_member (tenant_id, array['owner', 'staff']));
create policy "Office and up can add leads" on public.leads
  for insert to authenticated with check (private.is_tenant_member (tenant_id, array['owner', 'staff']));
create policy "Office and up can update leads" on public.leads
  for update to authenticated
  using (private.is_tenant_member (tenant_id, array['owner', 'staff']))
  with check (private.is_tenant_member (tenant_id, array['owner', 'staff']));

-- Marketing consent history and data requests: not for technicians.
drop policy "Members can view their tenant's consent history" on public.consent_log;
create policy "Office and up can view consent history"
  on public.consent_log for select to authenticated
  using (private.is_tenant_member (tenant_id, array['owner', 'staff']));

drop policy "Members can view their tenant's data requests" on public.data_requests;
drop policy "Members can log data requests" on public.data_requests;
drop policy "Members can update their tenant's data requests" on public.data_requests;
create policy "Office and up can view data requests"
  on public.data_requests for select to authenticated
  using (private.is_tenant_member (tenant_id, array['owner', 'staff']));
create policy "Office and up can log data requests"
  on public.data_requests for insert to authenticated
  with check (private.is_tenant_member (tenant_id, array['owner', 'staff']) and source = 'manual');
create policy "Office and up can update data requests"
  on public.data_requests for update to authenticated
  using (private.is_tenant_member (tenant_id, array['owner', 'staff']))
  with check (private.is_tenant_member (tenant_id, array['owner', 'staff']));

-- Customers: technicians see the customer on their jobs but can't add any.
drop policy "Members can add customers to their tenant" on public.customers;
create policy "Office and up can add customers" on public.customers
  for insert to authenticated with check (private.is_tenant_member (tenant_id, array['owner', 'staff']));
