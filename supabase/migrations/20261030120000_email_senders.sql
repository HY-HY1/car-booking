-- The address a business's emails come from (Settings → Notifications), on a
-- domain it owns, e.g. hello@shinedetailing.co.uk. The domain is added to our
-- email provider (Resend), the owner adds the DNS records it gives, and once
-- the provider has verified them the business's emails go out from it.
--
-- One address per business, and one business per domain: anyone who can send
-- from a verified domain can use any address on it, so a domain can never be
-- shared. Written only by server code with the secret key
-- (packages/core/src/email/senders-server.ts).

create table public.email_senders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  address text not null check (char_length(address) <= 254),
  domain text not null unique check (char_length(domain) <= 253),
  -- The domain's id at the provider, once it's been added there.
  provider_domain_id text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  -- The DNS records to add, as the provider gave them.
  records jsonb not null default '[]'::jsonb,
  check_error text check (char_length(check_error) <= 500),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.email_senders enable row level security;
revoke all on public.email_senders from anon;
revoke all on public.email_senders from authenticated;
grant select on public.email_senders to authenticated;

create policy "Members can view their email sender" on public.email_senders
  for select to authenticated using (private.is_tenant_member (tenant_id));
