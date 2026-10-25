import "server-only";
import { getCustomDomain, slugForCustomDomain } from "@leadgen/core/tenants";

// The proxy's custom-domain lookups, kept in memory for a minute so a page
// view doesn't wait on the database. Each server instance has its own copy,
// so a domain verified (or removed) in Settings takes up to a minute to
// apply. Misses are cached too, so a scan of random hosts can't hammer the
// database; the map is emptied if it ever grows past a few thousand entries.

const TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;
const entries = new Map<string, { value: string | null; expires: number }>();

async function cached(key: string, load: () => Promise<string | null>) {
  const hit = entries.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load();
  if (entries.size >= MAX_ENTRIES) entries.clear();
  entries.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

// booking.theirsite.com → "shine", or null if it isn't a verified domain.
export function slugForHost(hostname: string) {
  return cached(`host:${hostname}`, () => slugForCustomDomain(hostname));
}

// "shine" → its verified primary custom domain, or null.
export function customDomainFor(slug: string) {
  return cached(`slug:${slug}`, () => getCustomDomain({ slug }));
}
