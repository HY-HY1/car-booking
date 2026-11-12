# car-booking: pre-publish audit

Nov 10, 2026 · Harvey

## Verdict

Not ready to publish yet, but close: this is a well-built codebase, and roughly a day of fixes stands between it and launch. Nothing is broken. Typecheck, lint, all 477 tests and both production builds pass, no secrets are in the git history, and every database table has row-level security.

The real blocker is abuse, not bugs. The public booking pages have no rate limiting or bot protection, so a script can run up your Claude API bill, send emails to strangers from your customers' domains, and fill a business's diary with fake holds. Fix that and the login redirect bug, and it is publishable.

| Severity | Count | Meaning |
| --- | --- | --- |
| High | 2 | Fix before taking real businesses or customers |
| Medium | 9 | Fix before launch if quick, otherwise in the first week |
| Low | 10 | Polish and repo hygiene |

## What I checked

I ran everything automated first, then read the code by hand. The audit covers the latest commit on main (ff91bfe, "Add operations, account security and integrations features").

| Check | Result |
| --- | --- |
| Secrets in all 30 commits (Stripe, Supabase, Anthropic, Resend, Google keys) | None found; .env files correctly ignored |
| `npm ci` (clean install from the lockfile) | Fails: lockfile out of sync with package.json |
| Typecheck, all 3 workspaces | Pass |
| Lint | Pass, no warnings |
| Unit tests | 477 of 477 pass, 51 files |
| Production build, both apps | Pass (Google Fonts stubbed, because my sandbox can't reach Google; not a problem on Vercel) |
| `npm audit`, production deps | 13 issues, 6 high, all coming through the shadcn CLI |

Read by hand: all 30 migrations (RLS, grants, functions, storage), every server action and route handler for its auth check, the three webhooks, five cron jobs, the Stripe deposit and billing flows, Google and Meta OAuth, the booking engine, GDPR erasure, the README and info/ docs.

## Fix before publishing (High)

### H1. No rate limiting or bot protection on the public booking flow

**Where:** `apps/booking/src/app/sites/[tenant]/quote/actions.ts` (all nine actions), plus `privacy/request/actions.ts`.

**Problem:** anyone can call these actions as often as they like, from a script, with no captcha and no limit. A search of the repo finds no rate limiting anywhere outside Supabase's own auth limits. What that allows:

- **Your Claude bill.** `assessPhotosAction` sends up to 6 photos to `claude-opus-5-5` per call. The 24-hour cache only matches the exact same set of photos, so uploading new photos, or sending a different subset, is a fresh paid call every time.
- **Spam from your customers' domains.** For a business with no online deposit, `bookAction` confirms straight away and emails whatever address was typed in, from the business's own verified sending domain. That is a spam relay, and it will damage their domain reputation in Resend.
- **Diary lock-out.** Each `holdSlot` holds a time for the business's hold period. A script can keep every slot of a business permanently held.
- **Storage and noise.** `uploadPhotoAction` takes 5 MB files without limit, and `saveLeadAction` creates a customer, a lead and an owner alert email per call.

**Fix:**

1. Add Cloudflare Turnstile (free) to the quote form and verify its token on the server in `bookAction`, `saveLeadAction`, `uploadPhotoAction` and `assessPhotosAction`.
2. Add a per-IP and per-business limiter to every public action (Upstash Ratelimit is the usual choice on Vercel, or a small Supabase table). Suggested caps: 10 photo checks and 5 bookings per IP per hour.
3. Cap photo checks per business per day, so one bad day can't run up a large bill.
4. Try a cheaper model for photo grading. Opus is likely more than this classification needs; test Sonnet or Haiku on a few dozen real photos.

### H2. Open redirect on the login page

**Where:** `apps/admin/src/lib/safe-next.ts`, used by `login/actions.ts`, `login/verify/actions.ts` and `login/verify/page.tsx`.

**Problem:** `safeNext` blocks `//evil.com` but not `/<tab>/evil.com`. Browsers strip tab characters from URLs, so it becomes `//evil.com`. I confirmed that `new URL("/\t/evil.com", "https://app.example.com")` resolves to `https://evil.com/`. A phishing link to your real login page (`/app/login?next=%2F%09%2Fevil.com`) would send a detailer to a fake page straight after they sign in, which is a very convincing setup for stealing their password and 2FA code.

**Fix:** parse first, then compare origins, for every value:

```ts
export function safeNext(value: unknown, fallback = appUrl()) {
  if (typeof value !== "string" || !value) return fallback;
  const base = appUrl("/", { absolute: true });
  let url: URL;
  try { url = new URL(value, base); } catch { return fallback; }
  const ours = [base, adminUrl("/", { absolute: true })].map((u) => new URL(u).origin);
  return ours.includes(url.origin) ? url.toString() : fallback;
}
```

Add a test with `/\t/evil.com`, `/\n/evil.com` and `/\\evil.com`, all of which should fall back.

## Should fix (Medium)

### M1. Bookings are matched to existing customers on unverified email or phone

**Where:** `upsertCustomer` in `packages/core/src/booking/engine.ts` (lines 505–575).

**Problem:** a public booking is attached to an existing customer if the email *or* the phone matches, and nobody proves they own either. Two consequences. A stranger who types someone's email and ticks the marketing box opts that person in, and it is logged as `consent`, which you couldn't defend under PECR. And if an existing customer has a phone but no email (say the owner added them by hand), a booking with their phone and a different email writes that email onto their record, so their future confirmations, invoices and manage links go to the stranger.

**Fix:** only fill a blank email from a public booking when the email also matched, never from a phone match. Record marketing opt-ins from the booking page as pending until confirmed by a link in the confirmation email (double opt-in). Consider creating a new customer and flagging a possible duplicate for the owner to merge, since you already have a merge tool.

### M2. Signup doesn't verify email addresses and has no bot protection

**Where:** `apps/admin/src/app/app/signup/actions.ts` (`createUser` with `email_confirm: true`).

**Problem:** anyone can register a business under someone else's email, and each attempt creates an auth user, a tenant and a Stripe Checkout session. The error "There's already an account with that email" also tells anyone whether an address is registered. Separately, your app creates users with the secret key, so Supabase's public signup endpoint isn't needed, but if it's on in the hosted project anyone can create auth users directly with the publishable key.

**Fix:** send a verification email (or a magic link) before the account is usable, add Turnstile to the form, and switch off public signups in the hosted Supabase project (Authentication → Sign In / Providers). In the hosted project also turn on leaked-password protection and set the site URL and redirect URLs to production; `supabase/config.toml` only covers local dev.

### M3. Passwords can be changed without the current password

**Where:** `changePasswordAction` in `settings/account/actions.ts` and `app/account/password/actions.ts`.

**Problem:** anyone holding a signed-in session (a shared or stolen laptop, a session cookie) can set a new password and lock the owner out. `secure_password_change` is off in `config.toml`. Minimum lengths also disagree: signup 8, change 10, Supabase 6.

**Fix:** ask for the current password and check it with `signInWithPassword` before `updateUser`, or turn on Secure password change in the hosted project. Use one minimum (10 is fine) everywhere, including Supabase's own setting.

### M4. No security headers, so the dashboard can be framed

**Where:** neither `next.config.ts` sets `headers()`; nothing else adds them.

**Problem:** any site can load your dashboard in an invisible iframe and trick a signed-in owner into clicking Refund, Erase customer or Revoke key (clickjacking). There is also no Content-Security-Policy.

**Fix:** in `apps/admin/next.config.ts` add `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a basic `Permissions-Policy`. Leave the booking app frameable, since your embed script relies on it, but add the other headers there too.

### M5. Scheduled jobs run daily, but the features assume every 15 minutes

**Where:** `vercel.json` crons; `apps/booking/src/app/api/jobs/emails/route.ts`.

**Problem:** the email job (reminders, aftercare, review requests, "slot opened" waitlist alerts, campaign batches) runs once a day at 07:00. Campaigns send 150 per run after the first batch, so a 1,000-customer campaign takes about a week. The comments say this is the Hobby plan limit, and Vercel's Hobby plan is for personal, non-commercial use, so a paid SaaS needs Pro anyway.

**Fix:** move to Vercel Pro and set the email job to `*/15 * * * *`, or have an external scheduler (e.g. Supabase `pg_cron` + `pg_net`, or cron-job.org) call it with the `CRON_SECRET`.

### M6. The shadcn CLI is a production dependency

**Where:** `apps/admin/package.json` lists `shadcn` under `dependencies`.

**Problem:** it's a code generator you run with npx, not something the app uses at runtime. It pulls in 13 of your production audit findings (6 high: zod, deepmerge, systeminformation, undici, body-parser and others).

**Fix:** remove it (run `npx shadcn@latest add …` when you need it) or move it to `devDependencies`, then `npm audit fix` for what's left.

### M7. The lockfile is out of sync

**Where:** `package-lock.json`, and the root `optionalDependencies` pin of `@rolldown/binding-win32-x64-msvc`.

**Problem:** `npm ci` refuses to install because the lockfile lists rolldown 1.2.13 bindings while package.json now resolves 1.2.15, and lightningcss bindings are missing. Anyone cloning the repo, and any CI, can't do a reproducible install. The win32 pin is a Windows workaround that shouldn't be in a shared repo.

**Fix:** remove the root `optionalDependencies`, run `npm install` to regenerate the lockfile, commit it, and confirm `npm ci` works (CI below will keep it that way).

### M8. Custom domains are only half-built

**Where:** `addDomainToHosting` in `packages/core/src/settings/domains-server.ts` is an empty function with a TODO.

**Problem:** owners can add a domain in Settings and see it verified, but Vercel won't serve it or issue a certificate until you add it by hand in the Vercel dashboard. A customer would reasonably think it's broken.

**Fix:** either wire up the Vercel Domains API as the TODO describes, or hide the custom domain option (or label it "we'll set this up for you within a day") until you do.

### M9. No CI, and the code that touches money and the database has no tests

**Where:** no `.github/workflows`; the 477 tests cover the pure `*rules.ts` modules.

**Problem:** `holdSlot`, `confirmBooking`, the Stripe webhook and `confirmPaidBooking`, refunds, `notify.ts` and webhook delivery have no tests. These are the paths where a bug costs a business money or a customer.

**Fix:** add a GitHub Actions workflow that runs `npm ci`, typecheck, lint, test and build on every push. Then add a handful of integration tests against a local Supabase (`supabase start`) for: book with no deposit, book with deposit paid via webhook, hold expiring mid-payment, and a refund.

## Tidy-ups (Low)

Most of these are what a visitor to the GitHub page sees first, so they matter more for a public repo than their severity suggests.

| # | Issue | Fix |
| --- | --- | --- |
| L1 | README ends in garbled text (`#   b o o k i n g s`), a UTF-16 line appended by PowerShell. Its port table is also wrong (says booking 3000, admin 3001; the scripts run booking 3002 and admin 3001 behind a router on 3000), "Later: /api/agent" is stale, and there are no deploy steps or screenshots | Delete the last line, fix the ports, add a short "Deploying" section and two screenshots (you already have `.webp` ones in `components/landing`) |
| L2 | No LICENSE file. A public repo with no licence means all rights reserved, which may be what you want for a commercial product | Decide: add a licence, or add one line to the README saying the code is proprietary. Also consider making the repo private once it's a live business |
| L3 | Scratch files committed: `.rest` (queries the DVSA MOT site with a real-looking number plate), `stripeforward.txt` (notes whose ports disagree with `stripe-listen.cmd`), `command.md`, and `apps/booking/AGENTS.md` (written by `next dev`) | Delete them, or move anything useful into `info/` |
| L4 | Stale docs: `info/gdpr.md` says its migration is "not yet applied"; `.env.example` points to `/onboarding` but the route is `/app/signup`; package name is `leadgen` while the product is branded ASCND | Update the wording; pick one name |
| L5 | The confirmation page (`/confirmed/[id]`) shows the "Manage your booking" link to anyone who has the booking id, and that id sits in Stripe's return URL and browser history. Manage tokens also never expire | Low risk because ids are random UUIDs, but sign the confirmation URL like the manage link, and make manage tokens stop working once the booking is over |
| L6 | `recordContactAction` takes the attempts count from the browser and saves `attempts + 1`, so two open tabs (or a crafted call) set the wrong number | Increment in the database instead |
| L7 | Cron routes compare the secret with `!==`; the Meta and OAuth code uses `timingSafeEqual` | Use `timingSafeEqual` for consistency |
| L8 | `/api/health/supabase` is public and returns Supabase's error message on failure | Protect it with `CRON_SECRET` or remove it |
| L9 | 14 files import `cn` from the npm package, 75 from `@/lib/utils` (which re-exports it) | Pick one import path |
| L10 | Legal details fall back to "ASCND" with no address, company number or ICO number until the `NEXT_PUBLIC_LEGAL_*` variables are set, and the dashboard shows several "Coming soon" items (SMS, WhatsApp, AI assistant) | Fill in the legal variables before launch (and register with the ICO if you haven't); hide "Coming soon" items you don't want customers asking about |

## What's already done well

The security foundations are better than most production SaaS code. Keep these as they are:

- **Secrets:** none in any of the 30 commits; every server-only key is kept off `NEXT_PUBLIC_`.
- **Database:** row-level security on all 39 tables, `anon` revoked everywhere, column-level update grants (owners can't change their own slug or Stripe account), and every service-only function has execute revoked from signed-in users.
- **Two-factor login enforced in the database**, with restrictive policies on every table and on storage, so a stolen password alone can't read data even straight through the API.
- **Authorization:** every dashboard action checks membership and the specific permission, and the tenant always comes from the server, never the browser. The booking app takes the business from a header its own proxy sets after dropping any the visitor sent.
- **Payments:** prices are only ever computed on the server; Stripe webhooks verify signatures and are deduplicated; the confirmation page double-checks the Checkout session belongs to that booking.
- **Webhooks and OAuth:** Meta signatures checked in constant time; OAuth state is random, single-use and cookie-bound; outgoing webhooks refuse private networks, don't follow redirects and time out.
- **Output safety:** CSV exports escape formula injection, invoices escape HTML, and the JSON-LD script is escaped.
- **GDPR:** erasure also cleans Google Calendar events and webhook copies, retention runs weekly, and consent changes are logged.
- **Honesty:** placeholder testimonials are automatically left out of production builds.

## Checklist, in order

The first five are the launch blockers and should take about a day; the rest can follow.

- [ ] Turnstile and rate limits on the public booking actions, plus a daily cap on photo checks (H1)
- [ ] Fix `safeNext` and add the tab and newline tests (H2)
- [ ] Stop public bookings writing emails or marketing consent onto existing customers matched by phone (M1)
- [ ] Security headers on the admin app (M4)
- [ ] Hosted Supabase: public signups off, leaked-password protection on, secure password change on, production URLs set (M2, M3)
- [ ] Move `shadcn` out of dependencies, `npm audit fix`, regenerate the lockfile so `npm ci` works (M6, M7)
- [ ] Email verification and Turnstile on business signup (M2)
- [ ] Decide on Vercel Pro or an external 15-minute scheduler for the email job (M5)
- [ ] Wire up custom domains, or hide them for now (M8)
- [ ] GitHub Actions for typecheck, lint, test and build, then integration tests for the booking and deposit paths (M9)
- [ ] README, licence decision, delete scratch files, update stale docs (L1–L4)
- [ ] Fill in the legal details and ICO registration before the first real customer (L10)
