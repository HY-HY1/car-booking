import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { seal, unseal } from "../calendar/crypto";
import { createAdminClient } from "../supabase/admin";
import { sendLeadWebhook } from "../webhooks/deliver";
import { getFormName, getLead, listPages, MetaError, subscribePage, unsubscribePage, type MetaPage } from "./graph";
import { leadFromFields, leadSource, type LeadgenChange, type MetaLead } from "./rules";

// Facebook and Instagram lead forms (supabase/migrations/20261112120000_integrations.sql).
//
// An owner or manager logs in with Facebook and picks the Page their ads run
// from. The Page is subscribed to the app's "leadgen" webhook, so each form
// sent arrives at /api/webhooks/meta; the lead is read with the Page's token
// and added here as a lead (and a customer, matched by email or phone).

type Db = SupabaseClient;

const short = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

type ConnectionRow = {
  tenant_id: string;
  user_token: string | null;
  page_id: string | null;
  page_token: string | null;
  status: string;
};

async function connectionOf(db: Db, tenantId: string) {
  const { data, error } = await db
    .from("meta_connections")
    .select("tenant_id, user_token, page_id, page_token, status")
    .eq("tenant_id", tenantId)
    .maybeSingle<ConnectionRow>();
  if (error) throw error;
  return data;
}

// After Facebook's login dialog. The Page is picked next, unless there's only one.
export async function saveMetaConnection(
  tenantId: string,
  userId: string,
  login: { token: string; expiresAt: Date | null; name: string | null },
) {
  const db = createAdminClient();
  const { error } = await db.from("meta_connections").upsert(
    {
      tenant_id: tenantId,
      account_name: login.name,
      user_token: seal(login.token),
      user_token_expires_at: login.expiresAt?.toISOString() ?? null,
      connected_by: userId,
      last_error: null,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw error;

  const existing = await connectionOf(db, tenantId);
  if (existing?.page_id && existing.status === "active") return { needsPage: false };
  const pages = await listPages(login.token);
  if (pages.length === 1) {
    const result = await usePage(db, tenantId, pages[0]);
    return { needsPage: Boolean(result.error), error: result.error };
  }
  await db
    .from("meta_connections")
    .update({ status: "choose_page", ...(!pages.length && { last_error: "This Facebook login doesn't manage any Pages." }) })
    .eq("tenant_id", tenantId);
  return { needsPage: true };
}

async function usePage(db: Db, tenantId: string, page: MetaPage): Promise<{ error?: string }> {
  // A Page feeds one business.
  const taken = await db.from("meta_connections").select("tenant_id").eq("page_id", page.id).neq("tenant_id", tenantId).maybeSingle();
  if (taken.error) throw taken.error;
  if (taken.data) return { error: "That Page is already connected to another business here." };

  const old = await connectionOf(db, tenantId);
  try {
    await subscribePage(page.id, page.accessToken);
  } catch (error) {
    console.error("[meta] subscribing the Page failed", error);
    return { error: "Facebook wouldn't let us receive that Page's leads. Check you're an admin of the Page and allowed every permission." };
  }
  // The Page it replaces stops sending here.
  if (old?.page_id && old.page_id !== page.id && old.page_token) {
    const token = unseal(old.page_token);
    if (token) await unsubscribePage(old.page_id, token).catch((error) => console.error("[meta] unsubscribing the old Page failed", error));
  }
  const { error } = await db
    .from("meta_connections")
    .update({ page_id: page.id, page_name: page.name.slice(0, 300), page_token: seal(page.accessToken), status: "active", last_error: null })
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return {};
}

// The Pages to choose from, or null if Facebook can't be asked.
export async function listPageOptions(tenantId: string): Promise<{ id: string; name: string }[] | null> {
  const db = createAdminClient();
  const conn = await connectionOf(db, tenantId);
  const token = conn?.user_token ? unseal(conn.user_token) : null;
  if (!token) return null;
  try {
    return (await listPages(token)).map(({ id, name }) => ({ id, name }));
  } catch (error) {
    console.error("[meta] listing Pages failed", error);
    if (error instanceof MetaError && error.tokenDead) {
      await db.from("meta_connections").update({ status: "needs_reconnect", last_error: "Facebook ended the login. Connect again." }).eq("tenant_id", tenantId);
    }
    return null;
  }
}

export async function choosePage(tenantId: string, pageId: string): Promise<{ error?: string }> {
  const db = createAdminClient();
  const conn = await connectionOf(db, tenantId);
  const token = conn?.user_token ? unseal(conn.user_token) : null;
  if (!token) return { error: "Connect Facebook again first." };
  const page = (await listPages(token)).find((p) => p.id === pageId);
  if (!page) return { error: "That Page isn't on this Facebook login." };
  return usePage(db, tenantId, page);
}

export async function disconnectMeta(tenantId: string) {
  const db = createAdminClient();
  const conn = await connectionOf(db, tenantId);
  if (!conn) return;
  const token = conn.page_token ? unseal(conn.page_token) : null;
  if (conn.page_id && token) await unsubscribePage(conn.page_id, token).catch((error) => console.error("[meta] unsubscribing failed", error));
  const { error } = await db.from("meta_connections").delete().eq("tenant_id", tenantId);
  if (error) throw error;
}

export async function loadMetaSettings(tenantId: string) {
  const { data, error } = await createAdminClient()
    .from("meta_connections")
    .select("account_name, page_id, page_name, status, last_error, last_lead_at, user_token_expires_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        accountName: data.account_name as string | null,
        pageName: data.page_name as string | null,
        status: data.status as "choose_page" | "active" | "needs_reconnect",
        lastError: data.last_error as string | null,
        lastLeadAt: data.last_lead_at as string | null,
      }
    : null;
}

// ------------------------------------------------------------------ leads in

// The customer for a lead: the same person if their email or phone is known,
// otherwise a new one. Never opts anyone in to marketing: a lead form's
// consent wording isn't ours to judge.
async function customerFor(db: Db, tenantId: string, lead: MetaLead, source: string): Promise<string> {
  for (const [column, value] of [["email", lead.email], ["phone", lead.phone]] as const) {
    if (!value) continue;
    const { data, error } = await db.from("customers").select("id, postcode").eq("tenant_id", tenantId).eq(column, value).maybeSingle();
    if (error) throw error;
    if (data) {
      if (!data.postcode && lead.postcode) await db.from("customers").update({ postcode: lead.postcode }).eq("id", data.id);
      return data.id;
    }
  }
  const { data, error } = await db
    .from("customers")
    .insert({
      tenant_id: tenantId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      postcode: lead.postcode,
      source: source === "instagram_lead_form" ? "instagram" : "facebook",
    })
    .select("id")
    .single();
  // Added by a parallel delivery between the lookup and the insert.
  if (error?.code === "23505") return customerFor(db, tenantId, lead, source);
  if (error) throw error;
  return data.id;
}

async function importLead(db: Db, conn: ConnectionRow, change: LeadgenChange) {
  const token = conn.page_token ? unseal(conn.page_token) : null;
  if (!token) throw new Error("The Page's token can't be read.");
  const externalId = `meta:${change.leadgenId}`;
  const seen = await db.from("leads").select("id").eq("tenant_id", conn.tenant_id).eq("external_id", externalId).maybeSingle();
  if (seen.error) throw seen.error;
  if (seen.data) return;

  const record = await getLead(change.leadgenId, token);
  const lead = leadFromFields(record.field_data ?? []);
  const formId = record.form_id ?? change.formId;
  const source = leadSource(record.platform);
  const customerId = await customerFor(db, conn.tenant_id, lead, source);
  const { data, error } = await db
    .from("leads")
    .insert({
      tenant_id: conn.tenant_id,
      customer_id: customerId,
      status: "new",
      source,
      external_id: externalId,
      form_answers: {
        form: formId ? await getFormName(formId, token) : null,
        ad: record.ad_name ?? null,
        campaign: record.campaign_name ?? null,
        organic: record.is_organic ?? null,
        answers: lead.answers,
      },
      created_at: record.created_time ? new Date(record.created_time).toISOString() : undefined,
    })
    .select("id")
    .single();
  // The same lead arriving twice at once.
  if (error?.code === "23505") return;
  if (error) throw error;
  await db.from("meta_connections").update({ last_lead_at: new Date().toISOString(), last_error: null }).eq("tenant_id", conn.tenant_id);
  await sendLeadWebhook(conn.tenant_id, data.id);
}

// Every new lead in one webhook delivery. Throws if any couldn't be added,
// so Meta sends it again.
export async function handleLeadgen(changes: LeadgenChange[]) {
  if (!changes.length) return;
  const db = createAdminClient();
  const pageIds = [...new Set(changes.map((c) => c.pageId))];
  const { data, error } = await db
    .from("meta_connections")
    .select("tenant_id, user_token, page_id, page_token, status")
    .in("page_id", pageIds)
    .eq("status", "active");
  if (error) throw error;
  const byPage = new Map(data.map((c) => [c.page_id as string, c as ConnectionRow]));

  let failure: unknown = null;
  for (const change of changes) {
    const conn = byPage.get(change.pageId);
    // A Page that's been disconnected: nothing to do.
    if (!conn) continue;
    try {
      await importLead(db, conn, change);
    } catch (err) {
      console.error("[meta] adding a lead failed", err);
      const dead = err instanceof MetaError && err.tokenDead;
      // Worth Meta sending again, unless only reconnecting can fix it.
      if (!dead) failure = err;
      await db
        .from("meta_connections")
        .update({
          last_error: dead ? "Facebook ended the connection, so new leads can't be read. Connect again." : short(err),
          ...(dead && { status: "needs_reconnect" }),
        })
        .eq("tenant_id", conn.tenant_id);
    }
  }
  if (failure) throw failure;
}
