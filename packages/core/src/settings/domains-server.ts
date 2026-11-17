import "server-only";
import { resolveCname, resolveTxt } from "node:dns/promises";
import { createAdminClient } from "../supabase/admin";
import { cnameTarget, newVerificationToken, VERIFY_PREFIX } from "./domains";

// Adding, checking and removing an owner's custom domain. domains has no
// write policies, so these use the secret key; callers check the user is an
// owner of `tenantId` first.

export async function addCustomDomain(tenantId: string, hostname: string) {
  const { error } = await createAdminClient().from("domains").insert({
    tenant_id: tenantId,
    hostname,
    verified: false,
    is_primary: false,
    verification_token: newVerificationToken(),
  });
  // 23505: hostnames are unique across all businesses.
  if (error?.code === "23505") return { ok: false as const, message: "That address is already connected to a booking page." };
  if (error) throw error;
  // Not given to Vercel yet: only once its DNS proves it's theirs
  // (checkCustomDomain), so nobody can add someone else's domain to the project.
  return { ok: true as const };
}

// Vercel has to know a domain before it serves it and issues its
// certificate, so each one is added to the Vercel project through its API
// (needs VERCEL_API_TOKEN and VERCEL_PROJECT_ID, plus VERCEL_TEAM_ID for a
// team's project). Unknown hosts are routed to the booking app (vercel.json).
// Without the token a platform admin adds each domain by hand (Vercel →
// Project → Settings → Domains) and marks it verified in the admin panel, and
// owners are told it'll be connected within a day.
const VERCEL_API = "https://api.vercel.com";

export function hostingConnected() {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

async function vercel(method: "GET" | "POST" | "DELETE", path: string, body?: object) {
  const team = process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
  const project = encodeURIComponent(process.env.VERCEL_PROJECT_ID!);
  return fetch(`${VERCEL_API}${path.replace("{project}", project)}${team}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
}

// True once Vercel has the domain (added now, or already there).
async function addDomainToHosting(hostname: string): Promise<boolean> {
  if (!hostingConnected()) return false;
  try {
    const res = await vercel("POST", "/v10/projects/{project}/domains", { name: hostname });
    if (res.ok) return true;
    const error = ((await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }).error;
    // A conflict: fine if it's already on this project from an earlier try.
    if (res.status === 409) {
      const mine = await vercel("GET", `/v9/projects/{project}/domains/${encodeURIComponent(hostname)}`);
      if (mine.ok) return true;
    }
    console.error("[domains] Vercel refused", hostname, res.status, error);
    return false;
  } catch (error) {
    console.error("[domains] couldn't reach Vercel", hostname, error);
    return false;
  }
}

async function removeDomainFromHosting(hostname: string) {
  if (!hostingConnected()) return;
  try {
    const res = await vercel("DELETE", `/v9/projects/{project}/domains/${encodeURIComponent(hostname)}`);
    if (!res.ok && res.status !== 404) console.error("[domains] Vercel didn't remove", hostname, res.status);
  } catch (error) {
    console.error("[domains] couldn't reach Vercel to remove", hostname, error);
  }
}

async function lookup<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    // ENOTFOUND / ENODATA: the record isn't there (yet).
    return null;
  }
}

// Looks the records up and marks the domain verified once both are right.
// Returns what's still missing, in words for the owner.
export async function checkCustomDomain(tenantId: string, domainId: string) {
  const db = createAdminClient();
  const { data: domain, error } = await db
    .from("domains")
    .select("id, hostname, verified, verification_token")
    .eq("tenant_id", tenantId)
    .eq("id", domainId)
    .maybeSingle();
  if (error) throw error;
  if (!domain) return { ok: false as const, problems: ["That address isn't connected any more."] };
  if (domain.verified) return { ok: true as const, problems: [] };

  let token = domain.verification_token;
  if (!token) {
    token = newVerificationToken();
    const saved = await db.from("domains").update({ verification_token: token }).eq("id", domain.id);
    if (saved.error) throw saved.error;
  }

  const [cnames, txts] = await Promise.all([
    lookup(() => resolveCname(domain.hostname)),
    lookup(() => resolveTxt(`${VERIFY_PREFIX}.${domain.hostname}`)),
  ]);
  const target = cnameTarget();
  const problems: string[] = [];
  const pointsHere = cnames?.some((c) => c.toLowerCase().replace(/\.$/, "") === target);
  if (!pointsHere) {
    problems.push(
      cnames?.length
        ? `${domain.hostname} points at ${cnames[0]}, not ${target}.`
        : `We can't see a CNAME record for ${domain.hostname} yet.`,
    );
  }
  if (!txts?.some((parts) => parts.join("") === token)) {
    problems.push(`We can't see the TXT record with your code at ${VERIFY_PREFIX}.${domain.hostname} yet.`);
  }

  // The records are right: Vercel has to take the domain too before it's
  // live. Without the API connected, that's done by hand (see above).
  if (problems.length === 0 && !(await addDomainToHosting(domain.hostname))) {
    problems.push(
      hostingConnected()
        ? "Your DNS is right, but we couldn't finish connecting it just now. Try again in a few minutes."
        : "Your DNS is right. We'll finish connecting it on our side within a day: check back here then.",
    );
    if (!hostingConnected()) console.warn(`[domains] ${domain.hostname} is ready to add in Vercel by hand`);
  }

  const verified = problems.length === 0;
  const update = await db
    .from("domains")
    .update({
      verified,
      last_checked_at: new Date().toISOString(),
      check_error: verified ? null : problems.join(" "),
    })
    .eq("id", domain.id);
  if (update.error) throw update.error;
  return { ok: verified, problems };
}

// Removes a custom domain, the main one included: the booking pages then go
// back to the business's free address (urls.ts), which isn't a row here.
export async function removeCustomDomain(tenantId: string, domainId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("domains")
    .select("id, hostname")
    .eq("tenant_id", tenantId)
    .eq("id", domainId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: true as const };
  const removed = await db.from("domains").delete().eq("tenant_id", tenantId).eq("id", domainId);
  if (removed.error) throw removed.error;
  await removeDomainFromHosting(data.hostname);
  return { ok: true as const };
}

// Make a verified address the one links and emails use.
export async function makePrimaryDomain(tenantId: string, domainId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("domains")
    .select("id, verified")
    .eq("tenant_id", tenantId)
    .eq("id", domainId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false as const, message: "That address isn't connected any more." };
  if (!data.verified) return { ok: false as const, message: "Finish connecting this address first." };
  // One primary per business is a unique index, so the old one goes first.
  const cleared = await db.from("domains").update({ is_primary: false }).eq("tenant_id", tenantId).eq("is_primary", true);
  if (cleared.error) throw cleared.error;
  const set = await db.from("domains").update({ is_primary: true }).eq("tenant_id", tenantId).eq("id", domainId);
  if (set.error) throw set.error;
  return { ok: true as const };
}
