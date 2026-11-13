-- Public API v1 (apps/admin/src/app/api/v1/*, packages/core/src/api/*).
--
-- 1. What each API key may do. Keys made before this could only read the
--    catalogue, so they keep exactly that. Owners choose the rest when they
--    make a key; anything that returns customers' details needs its own scope.
-- 2. A request limit per key: a fixed one-minute window, counted here so it
--    holds across every server instance. Only the server (secret key) uses it.

alter table public.api_keys
  add column scopes text[] not null default array['catalog:read']::text[],
  add constraint api_keys_scopes_check check (
    cardinality(scopes) > 0
    and scopes <@ array[
      'catalog:read', 'bookings:read', 'customers:read', 'leads:read', 'leads:write', 'webhooks:write'
    ]::text[]
  );

-- Owners see each key's scopes in Settings → Integrations (the table only
-- grants columns one by one, so a new column needs its own grant).
grant select (scopes) on public.api_keys to authenticated;

create table public.api_rate_limits (
  -- "key:<api key id>"
  bucket text primary key,
  window_start timestamptz not null,
  hits int not null
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon;
revoke all on public.api_rate_limits from authenticated;
-- No policies: nobody signed in reads this. The 2FA rule still gets its copy
-- (20261110120000_account_security.sql), as every public table has one.
create policy "Second factor required" on public.api_rate_limits as restrictive for all to authenticated
  using ((select private.second_factor_satisfied()))
  with check ((select private.second_factor_satisfied()));

-- Counts one request against a bucket. Returns whether it's allowed, how many
-- are left in this window and when the window ends.
create or replace function public.api_rate_limit_hit (p_bucket text, p_limit int, p_window_seconds int)
returns table (allowed boolean, remaining int, reset_at timestamptz)
language plpgsql
set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.api_rate_limits as r (bucket, window_start, hits)
  values (p_bucket, w, 1)
  on conflict (bucket) do update
    set hits = case when r.window_start = excluded.window_start then r.hits + 1 else 1 end,
        window_start = excluded.window_start
  returning r.hits into n;

  return query select n <= p_limit, greatest(p_limit - n, 0), w + make_interval(secs => p_window_seconds);
end;
$$;

revoke execute on function public.api_rate_limit_hit (text, int, int) from public, anon, authenticated;
grant execute on function public.api_rate_limit_hit (text, int, int) to service_role;
