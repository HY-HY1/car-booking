-- Two-way Google Calendar sync (Settings → Integrations).
--
-- Out: every live booking is an event in Google Calendar, kept in step with
-- the booking. The dashboard decides: if someone moves or deletes a job's
-- event in Google, it's put back and the diary says so.
-- In: busy times in Google Calendar are blocked out for customers, for the
-- vans and bays that use that calendar.
--
-- One Google account per business, connected by an owner or manager. Each
-- van or bay uses the business's default calendar unless it's given its own.
-- Everything here is written only by server code with the secret key
-- (packages/core/src/calendar/sync.ts); members can read what the dashboard
-- shows, never the tokens.

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  provider text not null default 'google' check (provider in ('google')),
  -- The Google account it was connected with, to show who's connected.
  account_email text check (char_length(account_email) <= 254),
  -- Sealed with CALENDAR_TOKEN_SECRET (calendar/crypto.ts), never plain.
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  -- Where jobs go, and whose busy times count, unless a van or bay has its own.
  default_calendar_id text not null default 'primary' check (char_length(default_calendar_id) <= 1024),
  -- 'needs_reconnect': Google refused the refresh token (access removed, or
  -- an app still in testing, whose tokens last 7 days).
  status text not null default 'active' check (status in ('active', 'needs_reconnect')),
  last_error text check (char_length(last_error) <= 500),
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger calendar_connections_set_updated_at before update on public.calendar_connections
  for each row execute function private.set_updated_at();

alter table public.calendar_connections enable row level security;
revoke all on public.calendar_connections from anon;
revoke all on public.calendar_connections from authenticated;
grant select (id, tenant_id, provider, account_email, default_calendar_id, status, last_error, created_at, updated_at)
  on public.calendar_connections to authenticated;

create policy "Members can view their calendar connection" on public.calendar_connections
  for select to authenticated using (private.is_tenant_member (tenant_id));

-- A van's or bay's own calendar. Null = the business's default calendar.
alter table public.resources add column calendar_id text check (char_length(calendar_id) <= 1024);

-- Each calendar being read for busy times, and Google's push channel for it
-- (Google calls /api/webhooks/google-calendar when something changes there).
create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  calendar_id text not null check (char_length(calendar_id) <= 1024),
  channel_id uuid unique,
  channel_resource_id text,
  -- Sent back by Google on every push, so a forged one is ignored.
  channel_token text,
  channel_expires_at timestamptz,
  synced_at timestamptz,
  sync_error text check (char_length(sync_error) <= 500),
  created_at timestamptz not null default now(),
  unique (tenant_id, calendar_id)
);

alter table public.calendar_feeds enable row level security;
revoke all on public.calendar_feeds from anon;
revoke all on public.calendar_feeds from authenticated;

-- Busy times from Google Calendar: when, and nothing else. No titles or
-- attendees: the owner's own appointments aren't the team's business.
create table public.calendar_busy (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  calendar_id text not null,
  event_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  primary key (tenant_id, calendar_id, event_id),
  check (ends_at > starts_at)
);

create index calendar_busy_tenant_time_idx on public.calendar_busy (tenant_id, starts_at);

alter table public.calendar_busy enable row level security;
revoke all on public.calendar_busy from anon;
revoke all on public.calendar_busy from authenticated;
grant select on public.calendar_busy to authenticated;

create policy "Members can view busy times" on public.calendar_busy
  for select to authenticated using (private.is_tenant_member (tenant_id));

-- Each booking's event in Google Calendar: where it is, and what was last
-- written, so an unchanged booking isn't written again.
create table public.calendar_events (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  calendar_id text not null,
  event_id text not null,
  written_hash text,
  synced_at timestamptz,
  -- Set when writing failed; the daily job tries again.
  sync_error text check (char_length(sync_error) <= 500),
  -- Someone moved or deleted it in Google, and it was put back.
  changed_in_google_at timestamptz
);

create index calendar_events_tenant_idx on public.calendar_events (tenant_id);

alter table public.calendar_events enable row level security;
revoke all on public.calendar_events from anon;
revoke all on public.calendar_events from authenticated;
grant select on public.calendar_events to authenticated;

create policy "Members can view calendar events" on public.calendar_events
  for select to authenticated using (private.is_tenant_member (tenant_id));

-- Swaps one calendar's busy times within a stretch of time for a fresh read,
-- in one go: a slot lookup never sees the calendar half-cleared.
create or replace function public.replace_calendar_busy(
  p_tenant uuid,
  p_calendar text,
  p_from timestamptz,
  p_to timestamptz,
  p_rows jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Everything in the stretch reread, and anything long past.
  delete from public.calendar_busy
  where tenant_id = p_tenant
    and calendar_id = p_calendar
    and ((starts_at < p_to and ends_at > p_from) or ends_at < now() - interval '30 days');

  insert into public.calendar_busy (tenant_id, calendar_id, event_id, starts_at, ends_at)
  select p_tenant, p_calendar, r.event_id, r.starts_at, r.ends_at
  from jsonb_to_recordset(p_rows) as r (event_id text, starts_at timestamptz, ends_at timestamptz)
  where r.ends_at > r.starts_at
  on conflict (tenant_id, calendar_id, event_id)
    do update set starts_at = excluded.starts_at, ends_at = excluded.ends_at;
end;
$$;

revoke execute on function public.replace_calendar_busy (uuid, text, timestamptz, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_calendar_busy (uuid, text, timestamptz, timestamptz, jsonb) to service_role;
