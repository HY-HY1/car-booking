-- More than one car in one booking, from the booking page.
--
-- The cars are done one after another at the same address, on one visit: one
-- journey, and setting up and packing away happen once. So each extra car
-- adds its own time less setup_mins (never less than half its own time; see
-- packages/core/src/booking/config.ts multiCarOf and extraCarMins).
--
--   { "enabled": true, "max_cars": 2, "setup_mins": 20 }
--
-- Null means those defaults. The extra cars themselves go in
-- booking_vehicles (20261111120000_bookings_and_growth.sql), as the dashboard
-- already stores them, with the time each adds in extra_mins.

alter table public.booking_settings add column multi_car jsonb;

grant update (multi_car) on public.booking_settings to authenticated;
