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
  await addDomainToHosting(hostname);
  return { ok: true as const };
}

// TODO(custom domains): add the domain to the Vercel project, so Vercel serves
// it and issues its certificate. Until this is wired up, a platform admin adds
// each verified domain by hand (Vercel → Project → Settings → Domains, or
// `vercel domains add <domain> bookings-cars`). When it is: POST
// https://api.vercel.com/v10/projects/{project}/domains with { name: hostname }
// and a VERCEL_TOKEN, call the matching DELETE from removeCustomDomain, and
// show Vercel's own verification records next to ours in Settings.
async function addDomainToHosting(hostname: string) {
  void hostname;
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
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", domainId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: true as const };
  const removed = await db.from("domains").delete().eq("tenant_id", tenantId).eq("id", domainId);
  if (removed.error) throw removed.error;
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
