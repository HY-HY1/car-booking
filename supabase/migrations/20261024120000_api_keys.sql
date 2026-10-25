-- API keys a business creates under Settings → API, so its own website can
-- pull its product data (services, prices, add-ons, page content) from
-- /api/v1/catalog on the admin app. The key decides which business the data
-- is for: nothing in the request can point it at another one.
--
-- Only a SHA-256 hash of each key is stored; the key itself is shown once,
-- when it's made. Owners can see their keys' names and prefixes; every write
-- goes through server code with the secret key after an owner check.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  -- The first few characters, so owners can tell keys apart.
  prefix text not null,
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index api_keys_tenant_idx on public.api_keys (tenant_id, created_at desc);

alter table public.api_keys enable row level security;
revoke all on public.api_keys from anon;
revoke all on public.api_keys from authenticated;
-- Everything but the hash.
grant select (id, tenant_id, name, prefix, created_by, created_at, last_used_at, revoked_at)
  on public.api_keys to authenticated;

create policy "Owners can view API keys" on public.api_keys
  for select to authenticated using (private.is_tenant_member (tenant_id, array['owner']));
