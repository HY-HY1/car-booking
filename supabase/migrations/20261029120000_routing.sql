-- Slug routing (info/routing.md). A business's booking pages now live at its
-- slug's address, /booking/<slug> or <slug>.domain.com (packages/core/src/urls.ts),
-- so the domains table only holds domains of the business's own, such as
-- booking.theirsite.com, used in subdomain mode once verified.

-- 1. Every business was given a slug.localhost row before this. Nothing
--    routes by those any more, so they go.
delete from public.domains where hostname like '%.localhost';

-- 2. Each domain's state in one word, worked out from the columns the DNS
--    check writes (settings/domains-server.ts), so it can't drift from them:
--    pending until the check passes, failed if the last check found a
--    problem, verified once it passes. Members can already read their own
--    business's domains (RLS); changes only go through owner-checked server code.
alter table public.domains
  add column status text generated always as (
    case when verified then 'verified' when check_error is not null then 'failed' else 'pending' end
  ) stored;

-- 3. A slug is a booking address now, so 3 to 40 characters. Names a
--    business can't take (www, app, admin, test…) are checked on every signup
--    by reserved-slugs.ts. "test" is one of them: the test business becomes
--    test-detailing.
update public.tenants set slug = 'test-detailing'
where slug = 'test' and not exists (select 1 from public.tenants where slug = 'test-detailing');

alter table public.tenants
  add constraint tenants_slug_length check (char_length(slug) between 3 and 40);
