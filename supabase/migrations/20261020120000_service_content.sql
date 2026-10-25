-- Website content for each service: a short tagline, a "what's included"
-- list and a header image. Shown on the booking page.

alter table public.services
  add column tagline text,
  add column includes text[] not null default '{}',
  add column image_path text;

-- Header images are shown to anyone on the booking page, so the bucket is
-- public. Files live under <tenant_id>/<service_id>/<file>; only that
-- tenant's owners can write to their folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-images', 'service-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners can upload their tenant's service images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'service-images'
    and private.is_tenant_member (((storage.foldername (name))[1])::uuid, array['owner'])
  );

create policy "Owners can replace their tenant's service images" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'service-images'
    and private.is_tenant_member (((storage.foldername (name))[1])::uuid, array['owner'])
  );

create policy "Owners can delete their tenant's service images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'service-images'
    and private.is_tenant_member (((storage.foldername (name))[1])::uuid, array['owner'])
  );
