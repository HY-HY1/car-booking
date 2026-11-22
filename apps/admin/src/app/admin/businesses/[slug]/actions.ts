"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getBillingState, reconcileSubscription, syncSubscription } from "@leadgen/core/billing/subscriptions";
import {
  addDomain,
  addMember,
  deleteBusiness,
  getBusinessBySlug,
  removeMember,
  resetTwoFactor,
  setDomainVerified,
  setMemberRole,
  setPrimaryDomain,
} from "@leadgen/core/platform/businesses";
import { hostnameSchema } from "@leadgen/core/platform/rules";
import { cancelClosure } from "@leadgen/core/settings/account";
import { removeCustomDomain } from "@leadgen/core/settings/domains-server";
import { ROLES, roleSchema } from "@leadgen/core/team/access";
import { logActivity } from "@/lib/activity";
import { requirePlatformAdmin } from "@/lib/platform";
import { adminUrl } from "@/lib/urls";

// Managing one business from the platform panel. Each action re-checks that
// the caller is a platform admin and looks the business up by its slug; the
// browser never supplies a tenant id. Changes are written to the business's
// own activity log, so its owners can see what the platform did.

async function business(slug: string) {
  const admin = await requirePlatformAdmin(adminUrl(`/businesses/${slug}`));
  const found = await getBusinessBySlug(slug);
  if (!found) throw new Error("No such business");
  return { ...found, admin };
}

export type Result = { ok?: true; error?: string; message?: string };

export type AddMemberState = {
  error?: string;
  added?: { email: string; tempPassword: string | null; alreadyMember: boolean };
};

export async function addMemberAction(slug: string, _prev: AddMemberState, formData: FormData): Promise<AddMemberState> {
  const b = await business(slug);
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  const role = roleSchema.safeParse(formData.get("role"));
  if (!email.success) return { error: "Enter a valid email address." };
  if (!role.success) return { error: "Choose a role." };

  try {
    const result = await addMember(b.id, email.data, role.data);
    if (!result.alreadyMember) await logActivity(b.id, "team.added", `Platform admin added ${email.data} as ${ROLES[role.data].label}`);
    refresh();
    return { added: result };
  } catch (error) {
    console.error("Adding a member failed", error);
    return { error: "Couldn't add them. Try again." };
  }
}

// Puts you on the business as an owner, so you can open its dashboard to help.
export async function joinAction(slug: string): Promise<Result> {
  const b = await business(slug);
  if (!b.admin.email) return { error: "Your login has no email address." };
  try {
    const result = await addMember(b.id, b.admin.email.toLowerCase(), "owner");
    if (!result.alreadyMember) await logActivity(b.id, "team.added", `Platform admin ${b.admin.email} joined as Owner to help`);
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("Joining a business failed", error);
    return { error: "Couldn't add you. Try again." };
  }
}

export async function setRoleAction(slug: string, userId: string, role: string): Promise<Result> {
  const b = await business(slug);
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success || !z.uuid().safeParse(userId).success) return { error: "Choose a role." };
  const member = b.members.find((m) => m.userId === userId);
  if (!member) return { error: "They aren't on this business." };
  try {
    const result = await setMemberRole(b.id, userId, parsed.data);
    if (!result.ok) return { error: result.message };
    if (member.role !== parsed.data) {
      await logActivity(b.id, "team.role_changed", `Platform admin changed ${member.email} to ${ROLES[parsed.data].label}`);
    }
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("Changing a role failed", error);
    return { error: "Couldn't change it. Try again." };
  }
}

export async function removeMemberAction(slug: string, userId: string): Promise<Result> {
  const b = await business(slug);
  if (!z.uuid().safeParse(userId).success) return { error: "They aren't on this business." };
  const member = b.members.find((m) => m.userId === userId);
  if (!member) return { ok: true };
  try {
    const result = await removeMember(b.id, userId);
    if (!result.ok) return { error: result.message };
    await logActivity(b.id, "team.removed", `Platform admin removed ${member.email}`);
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("Removing a member failed", error);
    return { error: "Couldn't remove them. Try again." };
  }
}

// Someone who has lost their authenticator app can't get in any other way.
export async function resetTwoFactorAction(slug: string, userId: string): Promise<{ removed?: number; error?: string }> {
  const b = await business(slug);
  const member = b.members.find((m) => m.userId === userId);
  if (!member) return { error: "They aren't on this business." };
  try {
    const removed = await resetTwoFactor(userId);
    if (removed > 0) await logActivity(b.id, "account.two_factor_reset", `Reset two-factor login for ${member.email}`);
    return { removed };
  } catch (error) {
    console.error("Resetting two-factor failed", error);
    return { error: "Couldn't reset it. Try again." };
  }
}

export type AddDomainState = { error?: string; added?: string };

export async function addDomainAction(slug: string, _prev: AddDomainState, formData: FormData): Promise<AddDomainState> {
  const b = await business(slug);
  const hostname = hostnameSchema.safeParse(String(formData.get("hostname") ?? ""));
  if (!hostname.success) return { error: hostname.error.issues[0]?.message ?? "Enter a valid hostname." };

  const result = await addDomain(b.id, hostname.data);
  if (!result.ok) return { error: result.message };
  await logActivity(b.id, "settings.domain_added", `Platform admin added ${hostname.data}`);
  refresh();
  return { added: hostname.data };
}

export async function setVerifiedAction(slug: string, domainId: string, verified: boolean) {
  const b = await business(slug);
  if (!z.uuid().safeParse(domainId).success) return;
  await setDomainVerified(b.id, domainId, verified);
  const domain = b.domains.find((d) => d.id === domainId);
  if (domain) await logActivity(b.id, "settings.domain_verified", `Platform admin marked ${domain.hostname} ${verified ? "verified" : "unverified"}`);
  refresh();
}

export async function makePrimaryAction(slug: string, domainId: string) {
  const b = await business(slug);
  if (!z.uuid().safeParse(domainId).success) return;
  await setPrimaryDomain(b.id, domainId);
  const domain = b.domains.find((d) => d.id === domainId);
  if (domain) await logActivity(b.id, "settings.domain_primary", `Platform admin made ${domain.hostname} the main address`);
  refresh();
}

export async function removeDomainAction(slug: string, domainId: string): Promise<Result> {
  const b = await business(slug);
  if (!z.uuid().safeParse(domainId).success) return { error: "No such domain." };
  const domain = b.domains.find((d) => d.id === domainId);
  try {
    await removeCustomDomain(b.id, domainId);
    if (domain) await logActivity(b.id, "settings.domain_removed", `Platform admin removed ${domain.hostname}`);
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("Removing a domain failed", error);
    return { error: "Couldn't remove it. Try again." };
  }
}

// Reads the subscription from Stripe again, for when our copy looks wrong
// (a webhook that never arrived).
export async function resyncBillingAction(slug: string): Promise<Result> {
  const b = await business(slug);
  try {
    const state = await getBillingState(b.id);
    const status = state.subscriptionId ? await syncSubscription(state.subscriptionId, b.id) : await reconcileSubscription(b.id);
    refresh();
    return { ok: true, message: status ? `Stripe says: ${status.replaceAll("_", " ")}` : "Stripe has no subscription for this business." };
  } catch (error) {
    console.error("Re-reading a subscription failed", error);
    return { error: "Couldn't reach Stripe. Try again." };
  }
}

// Undoes an owner's "close my account", and turns their billing back on.
export async function cancelClosureAction(slug: string): Promise<Result> {
  const b = await business(slug);
  if (!b.deletionRequestedAt) return { ok: true };
  try {
    await cancelClosure(b.id);
    await logActivity(b.id, "account.closure_cancelled", "Platform admin cancelled the request to close the account");
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("Cancelling a closure failed", error);
    return { error: "Couldn't cancel it. Try again." };
  }
}

// Deletes the business for good. The slug has to be typed back, so it can't
// be done with a stray click.
export async function deleteBusinessAction(slug: string, typed: string): Promise<Result> {
  const b = await business(slug);
  if (typed.trim() !== b.slug) return { error: `Type ${b.slug} to confirm.` };
  try {
    const result = await deleteBusiness(b.id);
    console.info(`Platform admin ${b.admin.email} deleted business ${b.slug}`, result);
  } catch (error) {
    console.error("Deleting a business failed", error);
    return { error: "Couldn't delete it; some of it may be left. Check the server log, then try again." };
  }
  redirect(adminUrl(`/businesses?deleted=${encodeURIComponent(b.name)}`));
}
