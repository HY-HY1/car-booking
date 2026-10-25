Task: Switchable multi-tenant routing (path mode now, subdomain mode later)
Context

This is a multi-tenant SaaS for car detailers and valeters, built with Next.js (App Router) + Supabase, deployed on Vercel. The single codebase serves four surfaces:

Surface	Path mode (now)	Subdomain mode (later)
Marketing / landing / docs	/, /docs, /pricing …	domain.com
Business dashboard (tenants log in)	/app/...	app.domain.com
Internal super-admin (me only)	/admin/...	admin.domain.com
Customer-facing booking UI per business	/booking/[slug]/...	[slug].domain.com or a custom domain such as booking.theirsite.com

Right now the app runs on a *.vercel.app URL, which cannot do wildcard subdomains, so it must work in path mode. Later I will add a real domain and switch to subdomain mode by changing one env var. No page code should need to change when switching.

Before you start
Inspect the existing codebase: folder structure, any existing middleware.ts / proxy.ts, auth setup, how links and redirects are currently built, and any Stripe or Supabase redirect URLs.
Check the installed Next.js version. In Next.js 16+ middleware is proxy.ts; in earlier versions it is middleware.ts. Use whichever matches.
List every hardcoded internal URL or path you find (links, redirect(), router.push, emails, Stripe URLs, Supabase redirectTo). Show me this list and your plan before making large changes.
1. Folder structure

Organise routes so they are independent of URL shape. Internal folders are the source of truth; the proxy/middleware rewrites incoming URLs onto them.

app/
  (marketing)/          → landing, pricing, docs (served at root)
  app/                  → business dashboard
  admin/                → internal super-admin
  sites/[tenant]/       → customer booking UI (tenant = slug)
  api/                  → API routes (shared, not rewritten)
sites/[tenant] must never be reachable directly by a user typing /sites/.... The proxy should return 404 for direct hits to /sites/*.
Move existing pages into this structure where needed. Keep behaviour identical.
2. Environment variables

Add to .env.example and document them:

ROUTING_MODE=path              # "path" or "subdomain"
NEXT_PUBLIC_ROUTING_MODE=path  # same value, exposed to the client
NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000   # e.g. domain.com in production
NEXT_PUBLIC_SITE_URL=http://localhost:3000
3. Proxy / middleware

Rewrite (not redirect) incoming requests onto the internal folders.

Path mode

/booking/[slug]/... → /sites/[slug]/...
/app/..., /admin/..., marketing routes → pass through unchanged

Subdomain mode

Read the host header. Strip the port for local dev.
domain.com or www.domain.com → marketing routes
app.domain.com/... → /app/...
admin.domain.com/... → /admin/...
[slug].domain.com/... → /sites/[slug]/...
Any other host (a custom domain) → look up the tenant by custom domain (see section 6) → /sites/[slug]/...; 404 if not found
Path-style URLs (/booking/[slug]/...) must still work in subdomain mode and 301 redirect to the canonical subdomain or custom-domain URL, so old links and emails keep working.

Both modes

Skip /_next, static files, images, favicon.ico, and /api in the matcher.
Direct requests to /sites/* → 404.
Keep the proxy fast: no heavy work. Custom-domain lookups should be cached (e.g. an in-memory or edge-config cache with a short TTL) rather than hitting Supabase on every request.
4. URL helpers (most important part)

Create lib/urls.ts and make it the only way to build internal URLs anywhere in the app:

ts
tenantUrl(slug: string, path?: string, opts?: { customDomain?: string | null; absolute?: boolean }): string
appUrl(path?: string, opts?: { absolute?: boolean }): string
adminUrl(path?: string, opts?: { absolute?: boolean }): string
marketingUrl(path?: string, opts?: { absolute?: boolean }): string
Output depends on ROUTING_MODE. Example for tenantUrl("ascnd", "/confirm"):
path mode → /booking/ascnd/confirm
subdomain mode → https://ascnd.domain.com/confirm
subdomain mode with a verified custom domain → https://booking.theirsite.com/confirm
absolute: true always returns a full URL (needed for emails, Stripe, Supabase).
Handle local dev (http, port, *.localhost subdomains) correctly.
Write unit tests covering both modes, custom domains, trailing slashes, and query strings.

Then replace every hardcoded internal link/redirect found in "Before you start" with these helpers. This includes:

<Link href>, redirect(), router.push()
Email templates (confirmation, reminder, follow-up)
Stripe Checkout success_url / cancel_url, Stripe Connect onboarding return_url / refresh_url, billing portal return URL
Supabase auth redirectTo / emailRedirectTo

Inside a tenant's booking UI, links between booking pages should be built with tenantUrl so they work in both modes.

5. Tenant slugs
Slugs: lowercase letters, numbers, and hyphens only; 3–40 characters; no leading or trailing hyphen; unique.
Create a reserved list in lib/reserved-slugs.ts and reject these at signup and on slug change: www, app, admin, api, mail, email, smtp, help, support, status, docs, blog, book, booking, bookings, dashboard, login, signup, auth, billing, static, assets, cdn, dev, staging, test, demo
Validate on the server, not just the client.
6. Custom domains (schema + lookup only; Vercel API wiring can come later)

Add or confirm a Supabase table for tenant domains, e.g.:

tenant_domains
  id            uuid pk
  tenant_id     uuid fk → tenants.id
  domain        text unique   -- e.g. booking.theirsite.com
  status        text          -- 'pending' | 'verified' | 'failed'
  is_primary    boolean
  created_at    timestamptz
Row-level security: a tenant can only read and manage its own domains.
Add a server-side function used by the proxy to resolve host → tenant slug for verified domains only.
When a tenant has a verified primary custom domain, requests to [slug].domain.com should 301 redirect to it (avoids duplicate pages in search).
Leave a clearly marked TODO / stub for adding domains via the Vercel API.
7. Auth and cookies
In path mode everything shares one origin. That's acceptable for now.
Structure the Supabase auth setup so that in subdomain mode the dashboard session cookie is scoped to app.domain.com only, never to .domain.com, because tenant subdomains must not be able to read dashboard sessions.
The customer booking UI must not depend on the dashboard session.
Protect /app/* (logged-in tenant users) and /admin/* (my super-admin role only) on the server.
8. Acceptance criteria
 With ROUTING_MODE=path, every surface works on the *.vercel.app deployment and on localhost:3000.
 With ROUTING_MODE=subdomain, every surface works locally using *.localhost:3000 (e.g. app.localhost:3000, ascnd.localhost:3000).
 Switching modes requires only changing env vars. No page code changes.
 No hardcoded internal URLs remain. Grep for "/booking, "/app, "/admin, vercel.app and localhost to confirm.
 /sites/* returns 404 when requested directly.
 Old path-style booking URLs 301 redirect correctly in subdomain mode.
 Reserved and invalid slugs are rejected server-side.
 URL helper unit tests pass for both modes.
 Stripe and Supabase redirect URLs are built with the helpers.
9. When done

Give me:

A short summary of what changed and which files.
The exact steps to switch to subdomain mode later:
Buy a domain, point its nameservers to ns1.vercel-dns.com / ns2.vercel-dns.com
Add domain.com and *.domain.com in Vercel → Project → Settings → Domains
Set the env vars and redeploy
Add the new URLs to Supabase auth redirect allow-list and to Stripe settings
Anything you weren't sure about or chose not to change.

Work in small commits, run the type-checker and tests after each step, and ask me before deleting or renaming anything large.