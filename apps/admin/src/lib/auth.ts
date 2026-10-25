import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { hasAccess } from "@leadgen/core/billing/rules";
import { can, type Permission, type Role } from "@leadgen/core/team/access";
import { createClient } from "@/lib/supabase/server";
import { appUrl, loginUrl } from "@/lib/urls";

// Data access layer for the owner dashboard. Every dashboard page goes
// through these helpers; RLS enforces the same rules again in the database.

export type TenantRole = Role;
export type Tenant = { id: string; name: string; slug: string; subscription_status: string | null };
export type Membership = { role: TenantRole; tenant: Tenant };
export type CurrentUser = { id: string; email: string | null };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
});

export async function requireUser(next = appUrl()) {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(next));
  return user;
}

// The tenants the signed-in user belongs to, oldest membership first.
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_members")
    .select("role, tenant:tenants(id, name, slug, subscription_status)")
    .eq("user_id", user.id)
    .order("created_at");

  if (error) throw error;
  return data as unknown as Membership[];
});

// Resolves the tenant for a dashboard URL. Signed-out users go to login;
// users who aren't members get a 404, so tenant slugs aren't confirmed. A
// business that signed up but hasn't started its trial, or whose subscription
// has ended, is sent to the billing page instead. Businesses that aren't
// billed through the app (no status) are never sent.
export async function requireTenant(slug: string) {
  const user = await requireUser(appUrl(`/${slug}`));
  const membership = (await getMemberships()).find(
    (m) => m.tenant.slug === slug,
  );
  if (!membership) notFound();
  if (!hasAccess(membership.tenant.subscription_status)) {
    redirect(appUrl(`/signup/billing?tenant=${encodeURIComponent(slug)}`));
  }
  const role = membership.role;
  // What this person's access level allows (team/access.ts).
  return { user, ...membership, can: (permission: Permission) => can(role, permission) };
}

// For pages and actions an access level may not include: anyone without the
// permission is sent to a page that says so.
export async function requireAccess(slug: string, permission: Permission) {
  const result = await requireTenant(slug);
  if (!result.can(permission)) redirect(appUrl(`/${encodeURIComponent(slug)}/no-access`));
  return result;
}
