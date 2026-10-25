import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { earliest } from "../onboarding/milestones";
import type { Role } from "../team/access";
import { createAdminClient } from "../supabase/admin";
import { isCustomHostname } from "../tenants";
import { bookingSettingsFor, brandingFor, STARTER_SERVICES, startingResources, type NewBusiness } from "./rules";

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
  const { data, error } = await db.auth.admin.createUser({ email, password: tempPassword, email_confirm: true });
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
  // Earliest lead or confirmed booking: when the product first worked for them.
  firstEnquiryAt: string | null;
  // The owner asked to delete the account (Settings → Privacy); deleted by
  // hand after the 30-day grace period.
  deletionRequestedAt: string | null;
};

export async function listBusinesses(): Promise<BusinessSummary[]> {
  const db = createAdminClient();
  const [tenants, domains, members, emails] = await Promise.all([
    db
      .from("tenants")
      .select("id, name, slug, created_at, stripe_account_id, stripe_ready, subscription_status, trial_ends_at, deletion_requested_at")
      .order("created_at", { ascending: false }),
    db.from("domains").select("id, tenant_id, hostname, verified, is_primary").order("is_primary", { ascending: false }),
    db.from("tenant_members").select("tenant_id, user_id, role").order("created_at"),
    emailsById(db),
  ]);
  if (tenants.error) throw tenants.error;
  if (domains.error) throw domains.error;
  if (members.error) throw members.error;

  const activity = await Promise.all(
    tenants.data.map(async (t) => {
      const [booked, firstBooking, firstLead] = await Promise.all([
        db
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", t.id)
          .in("status", ["confirmed", "completed"]),
        db
          .from("bookings")
          .select("created_at")
          .eq("tenant_id", t.id)
          .in("status", ["confirmed", "completed"])
          .order("created_at")
          .limit(1)
          .maybeSingle(),
        db.from("leads").select("created_at").eq("tenant_id", t.id).order("created_at").limit(1).maybeSingle(),
      ]);
      for (const r of [booked, firstBooking, firstLead]) if (r.error) throw r.error;
      return [
        t.id,
        { count: booked.count ?? 0, firstEnquiryAt: earliest(firstBooking.data?.created_at, firstLead.data?.created_at) },
      ] as const;
    }),
  );
  const activityById = new Map(activity);

  return tenants.data.map((t) => ({
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
    bookings: activityById.get(t.id)?.count ?? 0,
    firstEnquiryAt: activityById.get(t.id)?.firstEnquiryAt ?? null,
    deletionRequestedAt: t.deletion_requested_at,
  }));
}

export async function getBusinessBySlug(slug: string) {
  return (await listBusinesses()).find((b) => b.slug === slug) ?? null;
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
