-- Before and after photos for a service's page: pairs of the same car before
-- the visit and after it, so customers see the starting point and the finish
-- to expect. Storage paths in the service-images bucket, in display order:
-- [{"before": "<path>", "after": "<path>", "caption": "..."}].

alter table public.services
  add column before_after jsonb not null default '[]',
  add constraint services_before_after_is_array check (jsonb_typeof(before_after) = 'array');

grant update (before_after) on public.services to authenticated;
