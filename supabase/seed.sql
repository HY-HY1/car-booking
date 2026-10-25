-- Test data: ASCND (tenant zero) and a dummy tenant for isolation testing.
-- Run in the Supabase SQL Editor after the migrations. Safe to run again.
--
--   ascnd           → ASCND's booking pages: localhost:3000/booking/ascnd, or
--                      ascnd.localhost:3000 in subdomain mode
--   test-detailing  → Test Detailing, with different branding and prices
--
-- ASCND's services and prices below are placeholders: replace them with the
-- real ones before taking real bookings.

-- Earlier versions of this seed called the test tenant "Demo Detailing", then
-- gave it the slug "test", which is now reserved (reserved-slugs.ts).
update public.tenants set name = 'Test Detailing', slug = 'test-detailing' where slug in ('demo-detailing', 'test');

insert into public.tenants (name, slug)
values
  ('ASCND', 'ascnd'),
  ('Test Detailing', 'test-detailing')
on conflict (slug) do nothing;

update public.tenants set branding = '{
  "primary_color": "#0f172a",
  "accent_color": "#38bdf8",
  "tagline": "Mobile detailing that comes to you"
}' where slug = 'ascnd';

update public.tenants set branding = '{
  "primary_color": "#9a3412",
  "accent_color": "#fbbf24",
  "tagline": "Test tenant. If you see this on ASCND, isolation is broken."
}' where slug = 'test-detailing';

-- Booking settings.
insert into public.booking_settings (
  tenant_id, weekly_hours, offers_mobile, offers_unit, unit_address, unit_postcode,
  base_postcode, service_area, deposit, min_price_pence, mobile_surcharge_pence,
  condition_tiers
)
select id,
  '{"mon": [["08:00", "17:00"]], "tue": [["08:00", "17:00"]], "wed": [["08:00", "17:00"]],
    "thu": [["08:00", "17:00"]], "fri": [["08:00", "17:00"]], "sat": [["09:00", "15:00"]]}',
  true, false, null, null,
  'GL51 0QX', '{"radius_miles": 10}', '{"type": "percent", "value": 25}', 4000, 0,
  '[{"key": "light", "label": "Light: regular wash, little dirt", "multiplier": 1},
    {"key": "moderate", "label": "Moderate: a few months since a proper clean", "multiplier": 1.15, "extra_mins": 30},
    {"key": "heavy", "label": "Heavy: pet hair, stains, mud", "multiplier": 1.35, "extra_mins": 60},
    {"key": "severe", "label": "Severe: mould, smoke or biohazard", "needs_inspection": true}]'
from public.tenants where slug = 'ascnd'
on conflict (tenant_id) do nothing;

insert into public.booking_settings (
  tenant_id, weekly_hours, offers_mobile, offers_unit, unit_address, unit_postcode,
  base_postcode, service_area, deposit, min_price_pence, mobile_surcharge_pence,
  condition_tiers
)
select id,
  '{"tue": [["10:00", "18:00"]], "thu": [["10:00", "18:00"]], "sat": [["08:00", "12:00"], ["13:00", "16:00"]]}',
  true, true, 'Unit 4, Test Industrial Estate', 'M1 1AE',
  'M1 1AE', '{"districts": ["M1", "M2", "M3", "M4", "M15", "M16"]}', '{"type": "fixed", "value_pence": 1500}', 0, 1000,
  '[{"key": "clean", "label": "Pretty clean", "multiplier": 1},
    {"key": "dirty", "label": "Properly dirty", "multiplier": 1.5, "extra_mins": 45}]'
from public.tenants where slug = 'test-detailing'
on conflict (tenant_id) do nothing;

-- Vans and bays, only if the tenant has none yet. ASCND has one van; Test
-- Detailing has two vans and a bay in its unit, so three jobs can run at once.
insert into public.resources (tenant_id, name, location_types, sort_order)
select t.id, r.name, r.location_types::text[], r.sort_order
from public.tenants t
cross join (values
  ('ascnd', 'Van', '{mobile}', 0),
  ('test-detailing', 'Van 1', '{mobile}', 0),
  ('test-detailing', 'Van 2', '{mobile}', 1),
  ('test-detailing', 'Bay', '{unit}', 2)
) as r (slug, name, location_types, sort_order)
where t.slug = r.slug
  and not exists (select 1 from public.resources x where x.tenant_id = t.id);

-- Services and add-ons, only if the tenant has none yet.
insert into public.services (tenant_id, name, description, duration_mins, base_price_pence, size_adjustments, sort_order)
select t.id, s.name, s.description, s.duration_mins, s.base_price_pence, s.size_adjustments::jsonb, s.sort_order
from public.tenants t
cross join (values
  ('Maintenance wash', 'Safe hand wash, wheels, glass and a quick interior tidy.', 90, 4500,
    '{"large": {"price_pence": 1000, "extra_mins": 15}, "xl": {"price_pence": 2000, "extra_mins": 30}}', 1),
  ('Full valet', 'Deep clean inside and out: vacuum, shampoo, wash, decontaminate and seal.', 240, 14000,
    '{"medium": {"price_pence": 1500, "extra_mins": 30}, "large": {"price_pence": 3000, "extra_mins": 60}, "xl": {"price_pence": 5000, "extra_mins": 90}}', 2),
  ('Interior detail', 'Every surface inside, steam cleaned, with seats shampooed.', 180, 11000,
    '{"large": {"price_pence": 2000, "extra_mins": 30}, "xl": {"price_pence": 3500, "extra_mins": 60}}', 3)
) as s (name, description, duration_mins, base_price_pence, size_adjustments, sort_order)
where t.slug = 'ascnd'
  and not exists (select 1 from public.services x where x.tenant_id = t.id);

insert into public.services (tenant_id, name, description, duration_mins, base_price_pence, size_adjustments, location_types, sort_order)
select t.id, s.name, s.description, s.duration_mins, s.base_price_pence, s.size_adjustments::jsonb, s.location_types::text[], s.sort_order
from public.tenants t
cross join (values
  ('Test wash', 'A cheap test service.', 60, 2000, '{"xl": {"price_pence": 500}}', '{mobile,unit}', 1),
  ('Test ceramic coat', 'Unit only, takes all day.', 480, 45000, '{}', '{unit}', 2)
) as s (name, description, duration_mins, base_price_pence, size_adjustments, location_types, sort_order)
where t.slug = 'test-detailing'
  and not exists (select 1 from public.services x where x.tenant_id = t.id);

insert into public.add_ons (tenant_id, name, price_pence, duration_mins, sort_order)
select t.id, a.name, a.price_pence, a.duration_mins, a.sort_order
from public.tenants t
cross join (values
  ('Pet hair removal', 2500, 45, 1),
  ('Engine bay clean', 2000, 30, 2),
  ('Headlight restoration', 3500, 45, 3)
) as a (name, price_pence, duration_mins, sort_order)
where t.slug = 'ascnd'
  and not exists (select 1 from public.add_ons x where x.tenant_id = t.id);

insert into public.add_ons (tenant_id, name, price_pence, duration_mins, sort_order)
select t.id, 'Test air freshener', 300, 0, 1
from public.tenants t
where t.slug = 'test-detailing'
  and not exists (select 1 from public.add_ons x where x.tenant_id = t.id);

-- Link owner logins to tenants. Create the users first under
-- Authentication → Users → Add user, then replace the emails below.
insert into public.tenant_members (tenant_id, user_id, role)
select t.id, u.id, 'owner'
from public.tenants t
join auth.users u on u.email = case t.slug
  when 'ascnd' then 'owner@ascnd.example'
  when 'test-detailing' then 'owner@demo.example'
end
on conflict do nothing;
