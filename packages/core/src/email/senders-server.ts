import "server-only";
import { createAdminClient } from "../supabase/admin";
import { domainOfAddress, senderStatusOf, type SenderStatus } from "./senders";

// Setting up, checking and removing a business's own sending address. The
// domain is added to Resend (resend.com), which gives the DNS records and
// checks them. email_senders has no write policies, so these use the secret
// key; callers check the user is an owner of `tenantId` first.
//
// Managing domains needs a Resend API key with full access, not one limited
// to sending.

const RESEND = "https://api.resend.com";
// Ireland: the nearest region to UK customers.
const REGION = "eu-west-1";

type ResendDomain = { id: string; name: string; status: string; records?: unknown[] };

class ResendError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function resend<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new ResendError(0, "RESEND_API_KEY is missing.");
  const response = await fetch(`${RESEND}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await response.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!response.ok) throw new ResendError(response.status, json?.message ?? `Resend ${response.status}`);
  return json as T;
}

// Adds the domain to Resend, or picks it up if it's already there (added by
// hand in Resend's dashboard, or by an earlier attempt that didn't finish).
async function addOrFindDomain(domain: string): Promise<ResendDomain> {
  const list = await resend<{ data: ResendDomain[] }>("/domains");
  const existing = list.data.find((d) => d.name === domain);
  if (existing) return resend<ResendDomain>(`/domains/${existing.id}`);
  return resend<ResendDomain>("/domains", { method: "POST", body: { name: domain, region: REGION } });
}

export type SenderResult = { ok: true } | { ok: false; message: string };

function providerProblem(error: unknown): SenderResult {
  console.error("[email] Resend domain request failed", error);
  if (error instanceof ResendError && error.status === 0) {
    return { ok: false, message: "Email isn't switched on for the platform yet. Try again later." };
  }
  if (error instanceof ResendError && error.status === 403 && /limit|plan/i.test(error.message)) {
    // The Resend plan's domain allowance is used up: ours to sort out.
    return { ok: false, message: "We can't add another domain just now. We've been told and will sort it out." };
  }
  return { ok: false, message: "Couldn't set that up just now. Try again in a minute." };
}

// Sets the business's sending address. A new domain is claimed here first
// (so two businesses can't take the same one), then added to Resend; the
// same domain with a different name before the @ just changes the address.
export async function setSender(tenantId: string, address: string): Promise<SenderResult> {
  const db = createAdminClient();
  const domain = domainOfAddress(address);
  const { data: current, error } = await db
    .from("email_senders")
    .select("id, domain")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;

  if (current?.domain === domain) {
    const updated = await db.from("email_senders").update({ address }).eq("id", current.id);
    if (updated.error) throw updated.error;
    return { ok: true };
  }
  if (current) await removeSender(tenantId);

  const claim = await db.from("email_senders").insert({ tenant_id: tenantId, address, domain }).select("id").single();
  if (claim.error?.code === "23505") {
    return { ok: false, message: "Another business on the platform is already using that domain. Get in touch if it's yours." };
  }
  if (claim.error) throw claim.error;

  let added: ResendDomain;
  try {
    added = await addOrFindDomain(domain);
  } catch (error) {
    await db.from("email_senders").delete().eq("id", claim.data.id);
    return providerProblem(error);
  }
  const saved = await db
    .from("email_senders")
    .update({
      provider_domain_id: added.id,
      status: senderStatusOf(added.status),
      records: added.records ?? [],
      last_checked_at: new Date().toISOString(),
    })
    .eq("id", claim.data.id);
  if (saved.error) throw saved.error;
  return { ok: true };
}

// Asks Resend to look at the DNS again and saves what it says. Resend checks
// in the background, so a domain often shows as verified a minute or two
// after the records go in rather than straight away.
export async function checkSender(tenantId: string): Promise<{ status: SenderStatus | null; message?: string }> {
  const db = createAdminClient();
  const { data: sender, error } = await db
    .from("email_senders")
    .select("id, provider_domain_id, status")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!sender?.provider_domain_id) return { status: null, message: "Add your email address first." };

  let domain: ResendDomain;
  try {
    if (sender.status !== "verified") {
      await resend(`/domains/${sender.provider_domain_id}/verify`, { method: "POST" });
    }
    domain = await resend<ResendDomain>(`/domains/${sender.provider_domain_id}`);
  } catch (error) {
    const problem = providerProblem(error);
    return { status: sender.status as SenderStatus, message: problem.ok ? undefined : problem.message };
  }

  const status = senderStatusOf(domain.status);
  const saved = await db
    .from("email_senders")
    .update({
      status,
      records: domain.records ?? [],
      check_error: status === "failed" ? "Resend couldn't find the records. Check they match exactly, then check again." : null,
      last_checked_at: new Date().toISOString(),
    })
    .eq("id", sender.id);
  if (saved.error) throw saved.error;
  return { status };
}

// Stops sending from the business's own address and takes its domain off
// Resend, so nobody can send from it through the platform any more.
export async function removeSender(tenantId: string): Promise<void> {
  const db = createAdminClient();
  const { data: sender, error } = await db
    .from("email_senders")
    .select("id, provider_domain_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!sender) return;
  if (sender.provider_domain_id) {
    try {
      await resend(`/domains/${sender.provider_domain_id}`, { method: "DELETE" });
    } catch (error) {
      // Already gone at Resend is fine; anything else is left for us to tidy.
      if (!(error instanceof ResendError && error.status === 404)) console.error("[email] Removing a Resend domain failed", error);
    }
  }
  const removed = await db.from("email_senders").delete().eq("id", sender.id);
  if (removed.error) throw removed.error;
}

// The verified address a business sends from, or null if it hasn't one yet.
export async function verifiedSender(tenantId: string, db = createAdminClient()): Promise<string | null> {
  const { data, error } = await db
    .from("email_senders")
    .select("address")
    .eq("tenant_id", tenantId)
    .eq("status", "verified")
    .maybeSingle();
  if (error) throw error;
  return data?.address ?? null;
}
