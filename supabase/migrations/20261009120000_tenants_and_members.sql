-- Multi-tenant foundations: tenants, the users who belong to them, and the
-- hostnames they're served on. Every tenant-owned table added later follows
-- the same pattern: a tenant_id column plus RLS policies that call
-- private.is_tenant_member().

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  branding jsonb not null default '{}',
  agent_rules jsonb not null default '{}',
  stripe_account_id text,
  tracking_ids jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Links a Supabase auth user to a tenant. A user can belong to several
-- tenants (e.g. the platform admin), each with its own role.
create table public.tenant_members (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_members_user_id_idx on public.tenant_members (user_id);

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  hostname text not null unique check (hostname = lower(hostname)),
  verified boolean not null default false,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index domains_tenant_id_idx on public.domains (tenant_id);
create unique index domains_one_primary_per_tenant on public.domains (tenant_id) where is_primary;

-- Membership check used by RLS policies. SECURITY DEFINER so policies on
-- tenant_members can call it without recursing into their own RLS. It lives
-- in a schema the Data API doesn't expose, so clients can't call it directly.
create schema if not exists private;
grant usage on schema private to authenticated;

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
      and (roles is null or m.role = any (roles))
  );
$$;

revoke execute on function private.is_tenant_member (uuid, text[]) from public, anon;
grant execute on function private.is_tenant_member (uuid, text[]) to authenticated;

-- Row Level Security. Signed-out visitors get nothing; the public booking
-- flow will go through server-side tools, not direct table access.
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.domains enable row level security;

revoke all on public.tenants, public.tenant_members, public.domains from anon;

create policy "Members can view their tenants"
  on public.tenants for select to authenticated
  using (private.is_tenant_member (id));

create policy "Owners can update their tenant"
  on public.tenants for update to authenticated
  using (private.is_tenant_member (id, array['owner']))
  with check (private.is_tenant_member (id, array['owner']));

-- Owners can edit their config, but not the slug or Stripe account, which
-- the platform manages.
revoke update on public.tenants from authenticated;
grant update (name, branding, agent_rules, tracking_ids) on public.tenants to authenticated;

create policy "Members can view their tenant's members"
  on public.tenant_members for select to authenticated
  using (private.is_tenant_member (tenant_id));

create policy "Members can view their tenant's domains"
  on public.domains for select to authenticated
  using (private.is_tenant_member (tenant_id));

-- Adding or removing members and domains is done with the secret key
-- (server-side onboarding code or the SQL editor) for now.
