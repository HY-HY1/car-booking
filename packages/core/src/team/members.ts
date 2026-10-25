import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "../supabase/admin";
import { wouldLeaveNoOwner, type Role } from "./access";

// The logins that can open a business (Settings → Team & access). Written
// with the secret key: callers check the signed-in user can("team.manage")
// for `tenantId` first. A login is a person's own account, so removing them
// from one business never deletes the account or touches other businesses.

export type TeamMember = {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  joinedAt: string;
  lastSignInAt: string | null;
};

export async function listTeam(tenantId: string): Promise<TeamMember[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("tenant_members")
    .select("user_id, role, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at");
  if (error) throw error;

  return Promise.all(
    data.map(async (m) => {
      const { data: found } = await db.auth.admin.getUserById(m.user_id);
      const user = found?.user;
      const meta = (user?.user_metadata ?? {}) as { full_name?: string };
      return {
        userId: m.user_id,
        email: user?.email ?? "(deleted account)",
        name: meta.full_name ?? null,
        role: m.role as Role,
        joinedAt: m.created_at,
        lastSignInAt: user?.last_sign_in_at ?? null,
      };
    }),
  );
}

async function findUserIdByEmail(email: string) {
  const db = createAdminClient();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
}

export type AddResult =
  | { ok: true; email: string; tempPassword: string | null }
  | { ok: false; message: string };

// Someone who already has an account (for this or another business) keeps
// their password and just gets access. Anyone else gets a new account with a
// temporary password, shown once to the owner to pass on.
export async function addTeamMember(
  tenantId: string,
  invitedBy: string,
  input: { email: string; name: string | null; role: Role },
): Promise<AddResult> {
  const db = createAdminClient();
  let userId = await findUserIdByEmail(input.email);
  let tempPassword: string | null = null;

  if (userId) {
    const existing = await db
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { ok: false, message: "They already have access. Change their level in the list instead." };
  } else {
    tempPassword = randomBytes(12).toString("base64url");
    const { data, error } = await db.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: input.name ? { full_name: input.name } : {},
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const { error } = await db
    .from("tenant_members")
    .insert({ tenant_id: tenantId, user_id: userId, role: input.role, invited_by: invitedBy });
  if (error) {
    // Don't leave a brand-new account with no business behind.
    if (tempPassword) await db.auth.admin.deleteUser(userId);
    throw error;
  }
  return { ok: true, email: input.email, tempPassword };
}

async function members(tenantId: string) {
  const { data, error } = await createAdminClient()
    .from("tenant_members")
    .select("user_id, role")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return data.map((m) => ({ userId: m.user_id as string, role: m.role as string }));
}

export async function changeTeamRole(tenantId: string, userId: string, role: Role) {
  const all = await members(tenantId);
  if (!all.some((m) => m.userId === userId)) return { ok: false as const, message: "They don't have access any more." };
  if (wouldLeaveNoOwner(all, { userId, newRole: role })) {
    return { ok: false as const, message: "The business needs an owner. Make someone else an owner first." };
  }
  const { error } = await createAdminClient()
    .from("tenant_members")
    .update({ role })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw error;
  return { ok: true as const };
}

export async function removeTeamMember(tenantId: string, userId: string) {
  const all = await members(tenantId);
  if (wouldLeaveNoOwner(all, { userId, newRole: null })) {
    return { ok: false as const, message: "The business needs an owner. Make someone else an owner first." };
  }
  const { error } = await createAdminClient()
    .from("tenant_members")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw error;
  // Signed-in sessions stop working on their next page load: every page
  // checks membership.
  return { ok: true as const };
}
