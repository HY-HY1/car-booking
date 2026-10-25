-- Photo checks of a car's condition. Customers don't pick a condition level
-- any more: while they book, a vision model rates the photos they uploaded
-- against the business's condition levels (booking_settings.condition_tiers),
-- and the price follows from that. See packages/core/src/booking/assess.ts.
--
-- A row is written per check and the booking form sends back its id; the
-- server reads the level from here, never from the browser. The result is
-- copied into the lead's and booking's quote_snapshot, so rows are only
-- needed while someone is booking and are deleted after a week.
--
-- Server-only: no grants to anon or authenticated. The dashboard reads the
-- copy in quote_snapshot.

create table public.condition_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Sorted, so the same set of photos is only checked once.
  photo_ids uuid[] not null check (cardinality(photo_ids) between 1 and 6),
  -- assessed: confident enough to price from. unsure: the photos didn't show
  -- enough. failed: the check itself didn't run (API error, refusal).
  status text not null check (status in ('assessed', 'unsure', 'failed')),
  -- The condition_tiers key, only when assessed.
  condition_key text check ((status = 'assessed') = (condition_key is not null)),
  confidence numeric check (confidence between 0 and 1),
  -- What the model saw, for the owner.
  summary text check (length(summary) <= 1000),
  model text,
  created_at timestamptz not null default now()
);

create index condition_assessments_lookup_idx
  on public.condition_assessments (tenant_id, photo_ids, created_at desc);
create index condition_assessments_created_idx on public.condition_assessments (created_at);

alter table public.condition_assessments enable row level security;
revoke all on public.condition_assessments from anon;
revoke all on public.condition_assessments from authenticated;
