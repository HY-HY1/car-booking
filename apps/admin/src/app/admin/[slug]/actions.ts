"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { roleSchema } from "@leadgen/core/team/access";
import { addDomain, addMember, getBusinessBySlug, setDomainVerified, setPrimaryDomain } from "@leadgen/core/platform/businesses";
import { hostnameSchema } from "@leadgen/core/platform/rules";
import { requirePlatformAdmin } from "@/lib/platform";
import { adminUrl } from "@/lib/urls";

// Managing one business from the platform panel. Each action re-checks that
// the caller is a platform admin and looks the business up by its slug; the
// browser never supplies a tenant id.

async function business(slug: string) {
  await requirePlatformAdmin(adminUrl(`/${slug}`));
  const found = await getBusinessBySlug(slug);
  if (!found) throw new Error("No such business");
  return found;
}

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
    refresh();
    return { added: result };
  } catch (error) {
    console.error("Adding a member failed", error);
    return { error: "Couldn't add them. Try again." };
  }
}

export type AddDomainState = { error?: string; added?: string };

export async function addDomainAction(slug: string, _prev: AddDomainState, formData: FormData): Promise<AddDomainState> {
  const b = await business(slug);
  const hostname = hostnameSchema.safeParse(String(formData.get("hostname") ?? ""));
  if (!hostname.success) return { error: hostname.error.issues[0]?.message ?? "Enter a valid hostname." };

  const result = await addDomain(b.id, hostname.data);
  if (!result.ok) return { error: result.message };
  refresh();
  return { added: hostname.data };
}

export async function setVerifiedAction(slug: string, domainId: string, verified: boolean) {
  const b = await business(slug);
  if (!z.uuid().safeParse(domainId).success) return;
  await setDomainVerified(b.id, domainId, verified);
  refresh();
}

export async function makePrimaryAction(slug: string, domainId: string) {
  const b = await business(slug);
  if (!z.uuid().safeParse(domainId).success) return;
  await setPrimaryDomain(b.id, domainId);
  refresh();
}
