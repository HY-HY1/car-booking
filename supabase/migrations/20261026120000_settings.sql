-- Settings: the dashboard's full control over a business.
--
--   tenants          contact details, VAT, notification settings, privacy
--                    extras (own policy link, consent wording, photo
--                    retention) and a deletion request
--   booking_settings photos required, which questions are asked, manual
--                    approval, cancellation and refund policy
--   bookings         'requested': waiting for the owner to approve it
--   domains          DNS verification for custom domains owners add

-- ---------------------------------------------------------------------------
-- Business
-- ---------------------------------------------------------------------------

alter table public.tenants
  -- Shown to customers on the booking page; the owner's login email is private.
  add column contact_email text check (contact_email = lower(contact_email)),
  add column contact_phone text,
  -- null = not VAT registered.
  add column vat_number text check (vat_number ~ '^[A-Z0-9 ]{5,20}$'),
  -- Customer messages, channels, sender and owner alerts. Parsed by
  -- packages/core/src/settings/notifications.ts, which fills in defaults.
  add column notification_settings jsonb not null default '{}',
  -- The business's own privacy policy, linked instead of the generated notice.
  add column privacy_policy_url text check (privacy_policy_url ~ '^https?://'),
  -- What the marketing tick box says on the booking page; null = the default.
  add column marketing_consent_text text check (char_length(marketing_consent_text) between 10 and 500),
  -- Customer photos are deleted this many days after upload; null = kept as
  -- long as the customer's details are (retention_months).
  add column photo_retention_days int check (photo_retention_days between 7 and 3650),
  -- The owner asked to close the account. Deleted by the platform after a
  -- 30-day grace period; until then it can be undone.
  add column deletion_requested_at timestamptz,
  add column deletion_requested_by uuid references auth.users (id) on delete set null;

-- Owners edit these in Settings. Deletion requests go through the server
-- (secret key) so the subscription is cancelled at the same time.
grant update (
  trade, contact_email, contact_phone, vat_number, notification_settings,
  privacy_policy_url, marketing_consent_text, photo_retention_days
) on public.tenants to authenticated;

-- ---------------------------------------------------------------------------
-- Booking rules
-- ---------------------------------------------------------------------------

alter table public.booking_settings
  add column photos_required boolean not null default false,
  add column min_photos int not null default 1 check (min_photos between 1 and 6),
  -- Which optional questions the booking page asks. Parsed by
  -- packages/core/src/settings/questions.ts; anything missing is asked.
  add column questions jsonb not null default '{}',
  -- 'manual': a booking waits as 'requested' until the owner approves it.
  add column approval_mode text not null default 'auto' check (approval_mode in ('auto', 'manual')),
  -- Cut-offs and what happens to the deposit. Parsed by
  -- packages/core/src/settings/policy.ts; {} = no policy set.
  add column cancellation_policy jsonb not null default '{}';

grant update (photos_required, min_photos, questions, approval_mode, cancellation_policy)
  on public.booking_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Bookings waiting for approval
-- ---------------------------------------------------------------------------
-- A requested booking keeps its slot (so it's in the no-overlap constraint)
-- until the owner approves it (confirmed) or declines it (cancelled).

alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('held', 'requested', 'confirmed', 'completed', 'cancelled', 'no_show', 'expired'));

alter table public.bookings drop constraint bookings_resource_no_overlap;
alter table public.bookings
  add constraint bookings_resource_no_overlap exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('held', 'requested', 'confirmed'));

-- Why the owner turned a request down, for their records.
alter table public.bookings add column decline_reason text check (char_length(decline_reason) <= 500);

-- ---------------------------------------------------------------------------
-- Custom domains
-- ---------------------------------------------------------------------------
-- Owners add their own domain in Settings → Booking page; it goes live once a
-- DNS check finds the CNAME and this token in a TXT record. Written by the
-- server (secret key) only, like the rest of domains.

alter table public.domains
  add column verification_token text,
  add column last_checked_at timestamptz,
  add column check_error text;
