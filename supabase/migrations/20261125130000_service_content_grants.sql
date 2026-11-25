-- Owners edit a service's page in the dashboard (Pricing → the service), but
-- services only lets the dashboard update the columns granted to it
-- (20261012120000_booking_engine.sql revoked the rest), and the page's
-- columns added by 20261020120000_service_content.sql and
-- 20261021120000_service_pages.sql were never granted. So saving a service
-- failed with "permission denied for table services". Row access is still
-- decided by the owners-only update policy.

grant update (
  tagline, includes, image_path,
  slug, badge, body, not_included, gallery, steps, faqs, seo_title, seo_description
) on public.services to authenticated;
