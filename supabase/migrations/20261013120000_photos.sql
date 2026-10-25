-- Customer photos of their car, taken in the booking flow so the owner sees
-- what they're walking into (and, later, for the AI condition check).
--
-- Files live in a private Storage bucket under <tenant_id>/<photo_id>.jpg.
-- The booking app uploads them server-side with the secret key; customers'
-- browsers get no Storage access at all. Dashboard users can read their own
-- tenant's folder (via short-lived signed URLs) and owners can delete.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- All null until the customer leaves contact details; unattached photos
  -- are deleted after a day (see packages/core/src/photos.ts).
  customer_id uuid references public.customers (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  storage_path text not null unique,
  content_type text not null,
  size_bytes int not null check (size_bytes > 0),
  width int,
  height int,
  created_at timestamptz not null default now(),
  attached_at timestamptz
);

create index photos_customer_idx on public.photos (customer_id);
create index photos_lead_idx on public.photos (lead_id);
create index photos_booking_idx on public.photos (booking_id);
create index photos_pending_idx on public.photos (tenant_id, created_at) where customer_id is null;

alter table public.photos enable row level security;
revoke all on public.photos from anon;
-- Rows are written by the booking engine (secret key) only.
revoke insert, update on public.photos from authenticated;

create policy "Members can view their tenant's photos" on public.photos
  for select to authenticated using (private.is_tenant_member (tenant_id));
create policy "Owners can delete their tenant's photos" on public.photos
  for delete to authenticated using (private.is_tenant_member (tenant_id, array['owner']));

-- Storage: the first folder of every object name is the tenant id.
create policy "Members can view their tenant's photo files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-photos'
    and private.is_tenant_member (((storage.foldername (name))[1])::uuid)
  );

create policy "Owners can delete their tenant's photo files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and private.is_tenant_member (((storage.foldername (name))[1])::uuid, array['owner'])
  );
