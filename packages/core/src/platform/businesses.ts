import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { earliest } from "../onboarding/milestones";
import type { Role } from "../team/access";
import { createAdminClient } from "../supabase/admin";
import { isCustomHostname } from "../tenants";
import { bookingSettingsFor, brandingFor, STARTER_SERVICES, startingResources, type NewBusiness } from "./rules";
import { TEMPORARY_PASSWORD } from "../account/password-change";
import { PHOTO_BUCKET } from "../photos";
import { getStripe } from "../stripe/client";

// Onboarding and managing businesses (tenants) from the platform admin panel.
// Everything here uses the secret key, so callers must have already checked
// isPlatformAdmin() for the signed-in user. Nothing here takes a tenant id
// from the browser without the caller having looked it up first.

export async function isPlatformAdmin(userId: string) {
  const { data, error } = await createAdminClient()
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// ---------------------------------------------------------------- users

async function findUserByEmail(db: SupabaseClient, email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
}

// Whether a login already uses this email: sign-up says so before the
// customer fills in the rest. Rate-limited by the caller.
export async function emailHasAccount(email: string) {
  return (await findUserByEmail(createAdminClient(), email.trim().toLowerCase())) !== null;
}

export type EnsuredUser = {
  userId: string;
  // Only set when the account was just created; shown to the admin once.
  tempPassword: string | null;
};

// The login for an owner or team member: an existing account is reused as-is
// (its password is never touched); otherwise one is created with a random
// temporary password, already confirmed so it works straight away.
async function ensureUser(db: SupabaseClient, email: string): Promise<EnsuredUser> {
  const existing = await findUserByEmail(db, email);
  if (existing) return { userId: existing.id, tempPassword: null };

  const tempPassword = randomBytes(12).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: TEMPORARY_PASSWORD,
  });
  if (error) throw error;
  return { userId: data.user.id, tempPassword };
}

async function emailsById(db: SupabaseClient) {
  const emails = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (u.email) emails.set(u.id, u.email);
    if (data.users.length < 1000) return emails;
  }
}

// ---------------------------------------------------------------- creating

export type CreateBusinessResult =
  | {
      ok: true;
      tenantId: string;
      slug: string;
      name: string;
      // Their own domain, if one was given: unverified until its DNS is checked.
      hostname: string | null;
      ownerEmail: string;
      // Set only if a new login was created for the owner.
      ownerTempPassword: string | null;
    }
  | { ok: false; field: "slug" | "hostname" | "form"; message: string };

export type CreateBusinessOptions = {
  // The owner's login already exists (self-serve signup creates it first with
  // their own password), so don't look one up or create one by email.
  ownerUserId?: string;
  // Written to the new tenant row.
  tenant?: { trade?: string; subscription_status?: string; terms_accepted_at?: string; terms_version?: string };
};

export async function createBusiness(
  input: NewBusiness,
  actingUserId: string,
  options: CreateBusinessOptions = {},
): Promise<CreateBusinessResult> {
  const db = createAdminClient();

  if (input.hostname && !isCustomHostname(input.hostname)) {
    return { ok: false, field: "hostname", message: "That's one of the platform's own addresses. Leave it blank: the business gets one anyway." };
  }
  const [slugTaken, hostTaken] = await Promise.all([
    db.from("tenants").select("id").eq("slug", input.slug).maybeSingle(),
    input.hostname ? db.from("domains").select("id").eq("hostname", input.hostname).maybeSingle() : null,
  ]);
  if (slugTaken.error) throw slugTaken.error;
  if (hostTaken?.error) throw hostTaken.error;
  if (slugTaken.data) return { ok: false, field: "slug", message: "There's already a business with that dashboard ID." };
  if (hostTaken?.data) return { ok: false, field: "hostname", message: "That hostname is already used by another business." };

  const tenant = await db
    .from("tenants")
    .insert({ name: input.name, slug: input.slug, branding: brandingFor(input), ...options.tenant })
    .select("id")
    .single();
  if (tenant.error) throw tenant.error;
  const tenantId = tenant.data.id;

  let createdUserId: string | null = null;
  try {
    // The booking pages live at the slug's address (urls.ts), so there's no
    // domain row unless they have their own domain. That one stays unverified
    // until its DNS points at us, then becomes where the pages live.
    const steps = [
      ...(input.hostname
        ? [db.from("domains").insert({ tenant_id: tenantId, hostname: input.hostname, verified: false, is_primary: true })]
        : []),
      db.from("booking_settings").insert({ tenant_id: tenantId, ...bookingSettingsFor(input) }),
      db.from("resources").insert(startingResources(input.locations).map((r) => ({ ...r, tenant_id: tenantId }))),
      ...(input.starterServices
        ? [db.from("services").insert(STARTER_SERVICES.map((s) => ({ ...s, tenant_id: tenantId })))]
        : []),
    ];
    for (const result of await Promise.all(steps)) if (result.error) throw result.error;

    const owner: EnsuredUser = options.ownerUserId
      ? { userId: options.ownerUserId, tempPassword: null }
      : await ensureUser(db, input.ownerEmail);
    if (owner.tempPassword) createdUserId = owner.userId;
    const members = [{ tenant_id: tenantId, user_id: owner.userId, role: "owner" }];
    // So the platform admin can open the new business's dashboard to help.
    if (input.addMe && actingUserId !== owner.userId) {
      members.push({ tenant_id: tenantId, user_id: actingUserId, role: "owner" });
    }
    const added = await db.from("tenant_members").insert(members);
    if (added.error) throw added.error;

    return {
      ok: true,
      tenantId,
      slug: input.slug,
      name: input.name,
      hostname: input.hostname ?? null,
      ownerEmail: input.ownerEmail,
      ownerTempPassword: owner.tempPassword,
    };
  } catch (error) {
    // Leave nothing half-built: the tenant's other rows go with it.
    await db.from("tenants").delete().eq("id", tenantId);
    if (createdUserId) await db.auth.admin.deleteUser(createdUserId);
    throw error;
  }
}

// ---------------------------------------------------------------- reading

export type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  stripe: "connected" | "pending" | "none";
  // What they pay us (not their Stripe account). null = billed outside the app.
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  domains: { id: string; hostname: string; verified: boolean; isPrimary: boolean }[];
  members: { userId: string; email: string; role: string }[];
  bookings: number;
  // Confirmed or completed bookings made in the last 30 days.
  bookings30: number;
  lastBookingAt: string | null;
  // Earliest lead or confirmed booking: when the product first worked for them.
  firstEnquiryAt: string | null;
  // The owner asked to delete the account (Settings → Privacy); deleted by
  // hand after the 30-day grace period.
  deletionRequestedAt: string | null;
};

const TENANT_COLUMNS =
  "id, name, slug, created_at, stripe_account_id, stripe_ready, subscription_status, trial_ends_at, deletion_requested_at";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  stripe_account_id: string | null;
  stripe_ready: boolean;
  subscription_status: string | null;
  trial_ends_at: string | null;
  deletion_requested_at: string | null;
};

// The summary for each of `tenants`, given every one's domains and people.
async function summarise(
  db: SupabaseClient,
  tenants: TenantRow[],
  emailFor: (userId: string) => Promise<string | undefined> | string | undefined,
  now = new Date(),
): Promise<BusinessSummary[]> {
  if (tenants.length === 0) return [];
  const ids = tenants.map((t) => t.id);
  const [domains, members] = await Promise.all([
    db.from("domains").select("id, tenant_id, hostname, verified, is_primary").in("tenant_id", ids).order("is_primary", { ascending: false }),
    db.from("tenant_members").select("tenant_id, user_id, role").in("tenant_id", ids).order("created_at"),
  ]);
  if (domains.error) throw domains.error;
  if (members.error) throw members.error;

  const day30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const live = ["confirmed", "completed"];
  const activity = new Map(
    await Promise.all(
      tenants.map(async (t) => {
        const [booked, booked30, firstBooking, firstLead, lastBooking] = await Promise.all([
          db.from("bookings").select("id", { count: "exact", head: true }).eq("tenant_id", t.id).in("status", live),
          db
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", t.id)
            .in("status", live)
            .gte("created_at", day30),
          db.from("bookings").select("created_at").eq("tenant_id", t.id).in("status", live).order("created_at").limit(1).maybeSingle(),
          db.from("leads").select("created_at").eq("tenant_id", t.id).order("created_at").limit(1).maybeSingle(),
          db
            .from("bookings")
            .select("created_at")
            .eq("tenant_id", t.id)
            .in("status", live)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        for (const r of [booked, booked30, firstBooking, firstLead, lastBooking]) if (r.error) throw r.error;
        return [
          t.id,
          {
            count: booked.count ?? 0,
            count30: booked30.count ?? 0,
            firstEnquiryAt: earliest(firstBooking.data?.created_at, firstLead.data?.created_at),
            lastBookingAt: lastBooking.data?.created_at ?? null,
          },
        ] as const;
      }),
    ),
  );

  const emails = new Map(
    await Promise.all(
      [...new Set(members.data.map((m) => m.user_id as string))].map(async (id) => [id, (await emailFor(id)) ?? "(unknown)"] as const),
    ),
  );

  return tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    createdAt: t.created_at,
    stripe: t.stripe_ready ? "connected" : t.stripe_account_id ? "pending" : "none",
    subscriptionStatus: t.subscription_status,
    trialEndsAt: t.trial_ends_at,
    domains: domains.data
      .filter((d) => d.tenant_id === t.id)
      .map((d) => ({ id: d.id, hostname: d.hostname, verified: d.verified, isPrimary: d.is_primary })),
    members: members.data
      .filter((m) => m.tenant_id === t.id)
      .map((m) => ({ userId: m.user_id, email: emails.get(m.user_id) ?? "(unknown)", role: m.role })),
    bookings: activity.get(t.id)?.count ?? 0,
    bookings30: activity.get(t.id)?.count30 ?? 0,
    lastBookingAt: activity.get(t.id)?.lastBookingAt ?? null,
    firstEnquiryAt: activity.get(t.id)?.firstEnquiryAt ?? null,
    deletionRequestedAt: t.deletion_requested_at,
  }));
}

export async function listBusinesses(): Promise<BusinessSummary[]> {
  const db = createAdminClient();
  const [tenants, emails] = await Promise.all([
    db.from("tenants").select(TENANT_COLUMNS).order("created_at", { ascending: false }),
    emailsById(db),
  ]);
  if (tenants.error) throw tenants.error;
  return summarise(db, tenants.data, (id) => emails.get(id));
}

// One business, without reading every other business or every login.
export async function getBusinessBySlug(slug: string): Promise<BusinessSummary | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("tenants").select(TENANT_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [summary] = await summarise(db, [data], async (id) => {
    const user = await db.auth.admin.getUserById(id);
    return user.data.user?.email ?? undefined;
  });
  return summary;
}

// ---------------------------------------------------------------- managing

export type MemberResult = { email: string; tempPassword: string | null; alreadyMember: boolean };

export async function addMember(tenantId: string, email: string, role: Role): Promise<MemberResult> {
  const db = createAdminClient();
  const user = await ensureUser(db, email);
  const { data, error } = await db
    .from("tenant_members")
    .upsert({ tenant_id: tenantId, user_id: user.userId, role }, { onConflict: "tenant_id,user_id", ignoreDuplicates: true })
    .select("user_id");
  if (error) {
    if (user.tempPassword) await db.auth.admin.deleteUser(user.userId);
    throw error;
  }
  return { email, tempPassword: user.tempPassword, alreadyMember: data.length === 0 };
}

// Takes two-factor login off an account, for someone who has lost their app.
// Returns how many methods were removed. The caller checks who's asking.
export async function resetTwoFactor(userId: string) {
  const db = createAdminClient();
  const { data, error } = await db.auth.admin.mfa.listFactors({ userId });
  if (error) throw error;
  for (const factor of data.factors) {
    const removed = await db.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (removed.error) throw removed.error;
  }
  return data.factors.length;
}

export async function addDomain(tenantId: string, hostname: string) {
  if (!isCustomHostname(hostname)) return { ok: false as const, message: "That's one of the platform's own addresses." };
  const db = createAdminClient();
  const { error } = await db.from("domains").insert({
    tenant_id: tenantId,
    hostname,
    verified: false,
    is_primary: false,
  });
  // 23505: hostnames are unique across all businesses.
  if (error?.code === "23505") return { ok: false as const, message: "That hostname is already in use." };
  if (error) throw error;
  return { ok: true as const };
}

export async function setDomainVerified(tenantId: string, domainId: string, verified: boolean) {
  const { error } = await createAdminClient()
    .from("domains")
    .update({ verified })
    .eq("tenant_id", tenantId)
    .eq("id", domainId);
  if (error) throw error;
}

export async function setPrimaryDomain(tenantId: string, domainId: string) {
  const db = createAdminClient();
  const target = await db.from("domains").select("id").eq("tenant_id", tenantId).eq("id", domainId).maybeSingle();
  if (target.error) throw target.error;
  if (!target.data) return;
  // One primary per business is a unique index, so the old one goes first.
  const cleared = await db.from("domains").update({ is_primary: false }).eq("tenant_id", tenantId).eq("is_primary", true);
  if (cleared.error) throw cleared.error;
  const set = await db.from("domains").update({ is_primary: true }).eq("tenant_id", tenantId).eq("id", domainId);
  if (set.error) throw set.error;
}

// ---------------------------------------------------------------- people

async function ownerCount(db: SupabaseClient, tenantId: string) {
  const { count, error } = await db
    .from("tenant_members")
    .select("user_id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role", "owner");
  if (error) throw error;
  return count ?? 0;
}

async function memberRole(db: SupabaseClient, tenantId: string, userId: string) {
  const { data, error } = await db.from("tenant_members").select("role").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.role as Role | undefined) ?? null;
}

const LAST_OWNER = "Every business needs at least one owner. Add another owner first.";

// Changes what someone can do on a business. The last owner can't be moved
// off owner, or nobody could manage billing or access.
export async function setMemberRole(tenantId: string, userId: string, role: Role) {
  const db = createAdminClient();
  const current = await memberRole(db, tenantId, userId);
  if (!current) return { ok: false as const, message: "They aren't on this business." };
  if (current === role) return { ok: true as const };
  if (current === "owner" && (await ownerCount(db, tenantId)) <= 1) return { ok: false as const, message: LAST_OWNER };
  const { error } = await db.from("tenant_members").update({ role }).eq("tenant_id", tenantId).eq("user_id", userId);
  if (error) throw error;
  return { ok: true as const };
}

// Takes someone off a business. Their login stays: it may be on others.
export async function removeMember(tenantId: string, userId: string) {
  const db = createAdminClient();
  const current = await memberRole(db, tenantId, userId);
  if (!current) return { ok: true as const };
  if (current === "owner" && (await ownerCount(db, tenantId)) <= 1) return { ok: false as const, message: LAST_OWNER };
  const { error } = await db.from("tenant_members").delete().eq("tenant_id", tenantId).eq("user_id", userId);
  if (error) throw error;
  return { ok: true as const };
}

// Logins that were only on a business that's now gone: removed too, unless
// they're on another business or are a platform admin. Returns how many went.
export async function removeOrphanLogins(db: SupabaseClient, userIds: string[], context: string) {
  let removed = 0;
  for (const userId of userIds) {
    const [elsewhere, admin] = await Promise.all([
      db.from("tenant_members").select("tenant_id", { count: "exact", head: true }).eq("user_id", userId),
      db.from("platform_admins").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    if (elsewhere.error || admin.error || elsewhere.count || admin.count) continue;
    const gone = await db.auth.admin.deleteUser(userId);
    if (gone.error) console.error(`Couldn't remove a login for ${context}`, gone.error);
    else removed++;
  }
  return removed;
}

// ---------------------------------------------------------------- deleting

export type DeleteBusinessResult = { photos: number; logins: number; subscriptionCancelled: boolean };

// The public bucket for service header images and logos (20261020120000).
const SERVICE_IMAGE_BUCKET = "service-images";

// Removes every file under `prefix`, folders inside it included. Storage
// lists a folder as an entry with no id. Returns how many files went.
async function emptyFolder(db: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<number> {
  if (depth > 5) return 0;
  let removed = 0;
  for (;;) {
    const listed = await db.storage.from(bucket).list(prefix, { limit: 1000 });
    if (listed.error) throw listed.error;
    const entries = listed.data ?? [];
    const files = entries.filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
    for (const folder of entries.filter((f) => !f.id)) removed += await emptyFolder(db, bucket, `${prefix}/${folder.name}`, depth + 1);
    if (files.length === 0) return removed;
    const gone = await db.storage.from(bucket).remove(files);
    if (gone.error) throw gone.error;
    removed += files.length;
    if (entries.length < 1000) return removed;
  }
}

// Deletes a business and everything under it, for good: an account closed
// from Settings → Privacy once its 30 days are up, or one set up by mistake.
// Its subscription is cancelled now (no more charges), its photos are removed
// from storage, and logins left on no other business are deleted. Their
// connected Stripe account is theirs and is left alone.
export async function deleteBusiness(tenantId: string): Promise<DeleteBusinessResult> {
  const db = createAdminClient();
  const [tenant, members] = await Promise.all([
    db.from("tenants").select("slug, stripe_subscription_id, subscription_status").eq("id", tenantId).single(),
    db.from("tenant_members").select("user_id").eq("tenant_id", tenantId),
  ]);
  if (tenant.error) throw tenant.error;
  if (members.error) throw members.error;

  // Billing first: if anything later fails, at least they've stopped paying.
  let subscriptionCancelled = false;
  const sub = tenant.data.stripe_subscription_id;
  if (sub && tenant.data.subscription_status !== "canceled" && tenant.data.subscription_status !== "incomplete_expired") {
    try {
      await getStripe().subscriptions.cancel(sub);
      subscriptionCancelled = true;
    } catch (error) {
      // Already cancelled in Stripe is fine; anything else stops the delete.
      const code = (error as { code?: string }).code;
      if (code !== "resource_missing") throw error;
    }
  }

  // Files live in storage under <tenant_id>/, which deleting rows won't touch:
  // customers' photos, and the service images and logo on the booking page.
  let photos = 0;
  for (const bucket of [PHOTO_BUCKET, SERVICE_IMAGE_BUCKET]) photos += await emptyFolder(db, bucket, tenantId);

  // Bookings go before the tenant: they hold their customer with ON DELETE
  // RESTRICT, which the tenant's cascade could otherwise trip over.
  const bookings = await db.from("bookings").delete().eq("tenant_id", tenantId);
  if (bookings.error) throw bookings.error;
  const removed = await db.from("tenants").delete().eq("id", tenantId);
  if (removed.error) throw removed.error;

  const logins = await removeOrphanLogins(db, members.data.map((m) => m.user_id as string), `deleted business ${tenant.data.slug}`);
  return { photos, logins, subscriptionCancelled };
}
