-- What a business needs at the customer's address to do a mobile job, from
-- Settings → Hours & rules (packages/core/src/booking/site-needs.ts):
--
--   { "water": true, "power": false }
--
-- Null means nothing is required. When something is, the booking form asks
-- for it as yes or no and a "no" can't book a job at that address; the
-- booking page's home says what's needed.

alter table public.booking_settings add column site_requirements jsonb;

grant update (site_requirements) on public.booking_settings to authenticated;
