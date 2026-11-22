import "server-only";
import { createAdminClient } from "../supabase/admin";
import { check } from "./query";

// Every login on the platform, for the platform admin: who they are, which
// businesses they're on, and how they sign in. Uses the secret key; the
// caller has checked requirePlatformAdmin().

export type Login = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  twoFactor: boolean;
  // Hasn't yet chosen their own password: still on the temporary one they
  // were given, or partway through a reset.
  temporaryPassword: boolean;
  blockedUntil: string | null;
  platformAdmin: boolean;
  businesses: { name: string; slug: string; role: string }[];
};

export async function listLogins(now = new Date()): Promise<Login[]> {
  const db = createAdminClient();
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }

  const [members, admins] = await Promise.all([
    db.from("tenant_members").select("user_id, role, tenant:tenants(name, slug)").order("created_at"),
    db.from("platform_admins").select("user_id"),
  ]);
  check(members, admins);

  const adminIds = new Set(admins.data!.map((a) => a.user_id as string));
  const byUser = new Map<string, Login["businesses"]>();
  for (const m of members.data!) {
    const tenant = Array.isArray(m.tenant) ? m.tenant[0] : m.tenant;
    if (!tenant) continue;
    const list = byUser.get(m.user_id) ?? [];
    list.push({ name: tenant.name, slug: tenant.slug, role: m.role });
    byUser.set(m.user_id, list);
  }

  return users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "(no email)",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      emailConfirmed: Boolean(u.email_confirmed_at),
      twoFactor: u.factors?.some((f) => f.status === "verified") ?? false,
      temporaryPassword: u.app_metadata?.must_change_password === true,
      blockedUntil: u.banned_until && Date.parse(u.banned_until) > now.getTime() ? u.banned_until : null,
      platformAdmin: adminIds.has(u.id),
      businesses: byUser.get(u.id) ?? [],
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

// Stops a login signing in (a lost or misused account), or lets it back in.
// Supabase ends their sessions as they next refresh. Platform admins can't be
// blocked from here, so nobody can lock the platform out of itself.
export async function setLoginBlocked(userId: string, blocked: boolean) {
  const db = createAdminClient();
  const admin = await db.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (admin.error) throw admin.error;
  if (admin.data && blocked) return { ok: false as const, message: "Platform admins can't be blocked here." };
  const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: blocked ? "876000h" : "none" });
  if (error) throw error;
  return { ok: true as const };
}
