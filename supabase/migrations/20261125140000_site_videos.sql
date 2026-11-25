-- Short videos of a business's work for its booking page's home (Settings →
-- Booking page → Videos of your work). Shown to anyone, so the bucket is
-- public. Files live under <tenant_id>/videos/<file>; only that tenant's
-- owners can write there. Uploaded straight from the browser with a signed
-- upload link, as videos are too big for a dashboard save. 50 MB each, the
-- largest upload Supabase allows on its free plan by default; longer videos
-- are better linked from YouTube or Vimeo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-videos', 'site-videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners can upload their tenant's site videos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'site-videos'
    and private.is_tenant_member (((storage.foldername (name))[1])::uuid, array['owner'])
  );

create policy "Owners can replace their tenant's site videos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'site-videos'
    and private.is_tenant_member (((storage.foldername (name))[1])::uuid, array['owner'])
  );

create policy "Owners can delete their tenant's site videos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'site-videos'
    and private.is_tenant_member (((storage.foldername (name))[1])::uuid, array['owner'])
  );
