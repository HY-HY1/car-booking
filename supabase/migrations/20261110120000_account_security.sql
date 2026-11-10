-- Accounts and security: two-factor login enforced by the database, throttling
-- for password reset emails, and the activity log.

-- ------------------------------------------------------------ two-factor login
--
-- Someone with a stolen password gets a session that's only one factor deep,
-- and could use it straight against the API with the publishable key, never
-- touching the app's pages. So every table refuses a signed-in person who has
-- two-factor switched on but hasn't entered a code in this session. People
-- without it, and the secret key the server uses, are unaffected.
--
-- Restrictive policies are ANDed with the existing ones. A table added after
-- this needs its own copy of the policy (as public.activity_log has below).

create or replace function private.second_factor_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
    or not exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = (select auth.uid())
        and f.status = 'verified'
    );
$$;

revoke execute on function private.second_factor_satisfied () from public, anon;
grant execute on function private.second_factor_satisfied () to authenticated;

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format(
      'create policy "Second factor required" on public.%I as restrictive for all to authenticated
         using ((select private.second_factor_satisfied()))
         with check ((select private.second_factor_satisfied()))',
      t.tablename
    );
  end loop;
end;
$$;

-- Photos, logos and service images.
create policy "Second factor required" on storage.objects as restrictive for all to authenticated
  using ((select private.second_factor_satisfied()))
  with check ((select private.second_factor_satisfied()));

-- --------------------------------------------------------------- password reset
--
-- When each address last had a reset email, so nobody can flood an inbox. The
-- address is hashed. Server only: no policies, so no signed-in access at all.

create table public.password_reset_requests (
  email_hash text primary key,
  sent_at timestamptz not null default now()
);

alter table public.password_reset_requests enable row level security;
revoke all on public.password_reset_requests from anon, authenticated;

-- ----------------------------------------------------------------- activity log
--
-- Who changed what. Written only by the server with the secret key, and never
-- updated or deleted by anyone signed in, so an entry can't be forged or
-- tidied away. Summaries leave out customers' names, so erasing a customer
-- needs nothing doing here. The email is copied so an entry still says who
-- it was after that login has gone.

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  summary text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index activity_log_tenant_idx on public.activity_log (tenant_id, created_at desc);

alter table public.activity_log enable row level security;
revoke all on public.activity_log from anon, authenticated;
grant select on public.activity_log to authenticated;

-- 'owner' also lets managers through (private.is_tenant_member).
create policy "Owners and managers can view activity" on public.activity_log
  for select to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

create policy "Second factor required" on public.activity_log as restrictive for all to authenticated
  using ((select private.second_factor_satisfied()))
  with check ((select private.second_factor_satisfied()));
