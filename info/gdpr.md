# UK GDPR: what's built and what's still on you

Roles: each business is the **controller** of its customers' data; ASCND is its
**processor**. ASCND is the **controller** of the business owners' own account data.

## Built (migration 20261023120000_gdpr.sql, not yet applied)
- **Erasure**: owner "Erase customer" on the customer page. No bookings → deleted.
  Has bookings → anonymised (bookings kept for accounts, name/contact/address/notes/
  vehicles/photos removed). Core: `privacy/data.ts` `eraseCustomer`, SQL
  `anonymise_customer`.
- **Access/export**: "Download their data" (JSON) on the customer page.
- **Retention**: per-business `retention_months` (default 36, Settings → Privacy).
  Weekly cron `/api/jobs/retention` erases customers with no activity for that long.
  Unattached photo uploads already deleted after a day.
- **Requests log**: `data_requests` with one-month due date, identity-checked flag,
  outcome notes. Public form at `<booking site>/privacy/request`; owners work them in
  Settings → Privacy. Nothing is auto-released or auto-erased: the owner checks identity.
- **Consent history**: `consent_log` written by trigger on any marketing flag change.
- **Unsubscribe**: signed link `/unsubscribe?t=…` (`signUnsubscribeToken`). Every
  marketing message must include it once emails are built.
- **Privacy notice** per business at `<booking site>/privacy`, footer links, link on the
  booking form. **ASCND legal pages** at admin `/legal/{terms,privacy,dpa}`; signup
  requires ticking agreement and records `terms_accepted_at` / `terms_version`.
- **RLS** on the new tables; erase/retention functions are service-role only.

## You still need to do (not code)
1. Have a solicitor review the Terms, Privacy Policy, Data Processing Terms and the
   per-business notice. They are templates.
2. Register ASCND with the ICO and pay the data protection fee; fill in the
   `NEXT_PUBLIC_LEGAL_*` / `NEXT_PUBLIC_ICO_NUMBER` vars. Tell each client they need
   their own registration (field in Settings → Privacy).
3. Sign the processor terms (DPA) with Supabase, Vercel and Stripe (their standard
   DPAs, accepted in each dashboard) and confirm the Supabase region (UK/EU preferred).
4. Keep `SUBPROCESSORS` in `privacy/platform.ts` current, and give clients notice before
   adding one (email/WhatsApp provider, AI model).
5. Run `supabase db push`, set `PRIVACY_TOKEN_SECRET`, deploy so the cron registers.
6. Breach plan: notify clients within 48h, they report to the ICO within 72h.

## Known gaps
- Stripe keeps charge/customer records (email, name) that erasure here doesn't touch.
- Backups hold erased data until they roll off.
- Anonymise keeps the outward postcode and the price/service on bookings.
- Staff (`staff` table) have no erase button; delete the row.
- Marketing emails/WhatsApp aren't built: when they are, check `*_marketing`, add the
  unsubscribe link, and for soft opt-in only use it for existing customers.
- Tracking pixels (`tenants.tracking_ids`) aren't loaded anywhere. If added, they need a
  cookie consent banner first.
- No platform-level erasure of a whole business's account (owner data) yet.
