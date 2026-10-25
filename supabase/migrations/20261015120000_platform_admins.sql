-- People who run the platform itself (as opposed to a single business): they
-- can create businesses and add owners from the admin app's /platform pages.
-- No policies and no grants: only the secret key reads or writes this table,
-- so nobody can promote themselves. Add yourself in the SQL editor:
--
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'you@example.com';

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
