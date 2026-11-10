-- Integrations (Settings → Integrations): webhooks out, Google Business
-- reviews in, and Facebook/Instagram lead forms in.
--
-- Everything here is written only by server code with the secret key
-- (packages/core/src/webhooks, reviews, meta). Members can read what the
-- dashboard shows, never a token or a signing secret.

-- ---------------------------------------------------------------- webhooks

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  url text not null check (char_length(url) between 8 and 2000),
  description text check (char_length(description) <= 200),
  -- Which events go to it (webhooks/rules.ts WEBHOOK_EVENTS).
  events text[] not null check (cardinality(events) > 0),
  -- Sealed (calendar/crypto.ts). Shown to the owner once, when made or rolled.
  secret text not null,
  active boolean not null default true,
  -- Counted across deliveries; reset by the next one that gets through.
  consecutive_failures int not null default 0,
  last_delivery_at timestamptz,
  last_status int,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index webhook_endpoints_tenant_idx on public.webhook_endpoints (tenant_id);

create trigger webhook_endpoints_set_updated_at before update on public.webhook_endpoints
  for each row execute function private.set_updated_at();

alter table public.webhook_endpoints enable row level security;
revoke all on public.webhook_endpoints from anon, authenticated;
grant select (id, tenant_id, url, description, events, active, consecutive_failures, last_delivery_at, last_status, created_at, updated_at)
  on public.webhook_endpoints to authenticated;
create policy "Owners can view webhooks" on public.webhook_endpoints
  for select to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

-- Each event for each endpoint. Kept 30 days (the retention job), so the
-- owner can see what was sent and what came back, and failures are retried.
create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints (id) on delete cascade,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  response_status int,
  response_body text check (char_length(response_body) <= 500),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (endpoint_id, event_id)
);

create index webhook_deliveries_due_idx on public.webhook_deliveries (next_attempt_at) where status = 'pending';
create index webhook_deliveries_endpoint_idx on public.webhook_deliveries (endpoint_id, created_at desc);

alter table public.webhook_deliveries enable row level security;
revoke all on public.webhook_deliveries from anon, authenticated;
grant select (id, tenant_id, endpoint_id, event_id, event_type, status, attempts, next_attempt_at, response_status, delivered_at, created_at)
  on public.webhook_deliveries to authenticated;
create policy "Owners can view webhook deliveries" on public.webhook_deliveries
  for select to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

-- What each booking looked like when webhooks last heard about it, so a
-- change can be named: created, cancelled, rescheduled... Server only.
create table public.webhook_booking_state (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  status text not null,
  starts_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.webhook_booking_state enable row level security;
revoke all on public.webhook_booking_state from anon, authenticated;

-- --------------------------------------------------- Google Business reviews

create table public.google_business_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  account_email text check (char_length(account_email) <= 254),
  -- Sealed with CALENDAR_TOKEN_SECRET (calendar/crypto.ts), never plain.
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  -- accounts/123 and locations/456; null until the owner picks a location.
  account_name text check (char_length(account_name) <= 200),
  location_name text check (char_length(location_name) <= 200),
  location_title text check (char_length(location_title) <= 300),
  place_id text check (char_length(place_id) <= 300),
  review_url text check (char_length(review_url) <= 1000),
  average_rating numeric(2, 1),
  total_reviews int,
  status text not null default 'active' check (status in ('active', 'needs_reconnect')),
  last_error text check (char_length(last_error) <= 500),
  last_synced_at timestamptz,
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger google_business_connections_set_updated_at before update on public.google_business_connections
  for each row execute function private.set_updated_at();

alter table public.google_business_connections enable row level security;
revoke all on public.google_business_connections from anon, authenticated;
grant select (id, tenant_id, account_email, location_title, place_id, review_url, average_rating, total_reviews, status, last_error, last_synced_at, created_at)
  on public.google_business_connections to authenticated;
create policy "Office and up can view the Google Business connection" on public.google_business_connections
  for select to authenticated using (private.is_tenant_member (tenant_id, array['owner', 'staff']));

-- Reviews are public on Google already; a copy here so the dashboard can
-- list, count and reply without asking Google on every page view.
create table public.google_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Google's own name for it: accounts/1/locations/2/reviews/3.
  review_name text not null check (char_length(review_name) <= 500),
  reviewer_name text check (char_length(reviewer_name) <= 200),
  reviewer_photo_url text check (char_length(reviewer_photo_url) <= 1000),
  rating smallint check (rating between 1 and 5),
  comment text check (char_length(comment) <= 10000),
  reply text check (char_length(reply) <= 4096),
  reply_updated_at timestamptz,
  created_at_google timestamptz not null,
  updated_at_google timestamptz not null,
  synced_at timestamptz not null default now(),
  unique (tenant_id, review_name)
);

create index google_reviews_tenant_idx on public.google_reviews (tenant_id, created_at_google desc);

alter table public.google_reviews enable row level security;
revoke all on public.google_reviews from anon, authenticated;
grant select on public.google_reviews to authenticated;
create policy "Office and up can view reviews" on public.google_reviews
  for select to authenticated using (private.is_tenant_member (tenant_id, array['owner', 'staff']));

-- ----------------------------------------- Facebook and Instagram lead forms

create table public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  -- Who connected it, as Facebook names them.
  account_name text check (char_length(account_name) <= 200),
  -- Sealed (calendar/crypto.ts). The person's token lists their Pages; the
  -- Page's token reads its leads and doesn't expire.
  user_token text,
  user_token_expires_at timestamptz,
  -- One Page per business, and a Page can only feed one business.
  page_id text unique check (char_length(page_id) <= 64),
  page_name text check (char_length(page_name) <= 300),
  page_token text,
  status text not null default 'choose_page' check (status in ('choose_page', 'active', 'needs_reconnect')),
  last_error text check (char_length(last_error) <= 500),
  last_lead_at timestamptz,
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger meta_connections_set_updated_at before update on public.meta_connections
  for each row execute function private.set_updated_at();

alter table public.meta_connections enable row level security;
revoke all on public.meta_connections from anon, authenticated;
grant select (id, tenant_id, account_name, page_id, page_name, status, last_error, last_lead_at, created_at)
  on public.meta_connections to authenticated;
create policy "Members can view the Meta connection" on public.meta_connections
  for select to authenticated using (private.is_tenant_member (tenant_id));

-- ---------------------------------------------------- two-factor on new tables

create policy "Second factor required" on public.webhook_endpoints as restrictive for all to authenticated
  using ((select private.second_factor_satisfied())) with check ((select private.second_factor_satisfied()));
create policy "Second factor required" on public.webhook_deliveries as restrictive for all to authenticated
  using ((select private.second_factor_satisfied())) with check ((select private.second_factor_satisfied()));
create policy "Second factor required" on public.webhook_booking_state as restrictive for all to authenticated
  using ((select private.second_factor_satisfied())) with check ((select private.second_factor_satisfied()));
create policy "Second factor required" on public.google_business_connections as restrictive for all to authenticated
  using ((select private.second_factor_satisfied())) with check ((select private.second_factor_satisfied()));
create policy "Second factor required" on public.google_reviews as restrictive for all to authenticated
  using ((select private.second_factor_satisfied())) with check ((select private.second_factor_satisfied()));
create policy "Second factor required" on public.meta_connections as restrictive for all to authenticated
  using ((select private.second_factor_satisfied())) with check ((select private.second_factor_satisfied()));
