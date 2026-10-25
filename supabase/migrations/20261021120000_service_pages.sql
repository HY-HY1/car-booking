-- Everything a service's own web page needs: a link name, badge, long
-- description, what's not included, a photo gallery, how it works, FAQs and
-- search engine text. Builds on 20261020120000_service_content.sql.

alter table public.services
  add column slug text,
  add column badge text,
  add column body text,
  add column not_included text[] not null default '{}',
  -- Storage paths in the service-images bucket, in display order.
  add column gallery text[] not null default '{}',
  -- [{"title": "...", "text": "..."}]
  add column steps jsonb not null default '[]',
  -- [{"q": "...", "a": "..."}]
  add column faqs jsonb not null default '[]',
  add column seo_title text,
  add column seo_description text,
  add constraint services_slug_format check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint services_steps_is_array check (jsonb_typeof(steps) = 'array'),
  add constraint services_faqs_is_array check (jsonb_typeof(faqs) = 'array');

-- Give every existing service a link name from its name.
update public.services s
set slug = coalesce(nullif(trim(both '-' from regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g')), ''), 'service')
  || case when exists (
       select 1 from public.services o
       where o.tenant_id = s.tenant_id
         and o.id <> s.id
         and o.created_at < s.created_at
         and coalesce(nullif(trim(both '-' from regexp_replace(lower(o.name), '[^a-z0-9]+', '-', 'g')), ''), 'service')
           = coalesce(nullif(trim(both '-' from regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g')), ''), 'service')
     ) then '-' || substr(s.id::text, 1, 4) else '' end;

create unique index services_tenant_slug_idx on public.services (tenant_id, slug);
