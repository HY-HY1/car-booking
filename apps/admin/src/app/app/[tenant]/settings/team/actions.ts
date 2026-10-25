"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { roleSchema } from "@leadgen/core/team/access";
import { addTeamMember, changeTeamRole, removeTeamMember } from "@leadgen/core/team/members";
import { requireTenant } from "@/lib/auth";

// Settings → Team & access. Owners only: who can log in to this business and
// at what level. The business is always the one from the URL's membership
// check; user ids from the form are only ever matched within it.

export type AddMemberState = {
  errors?: Record<string, string | undefined>;
  message?: string;
  added?: { email: string; tempPassword: string | null };
};

const addSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter their email address.")),
  name: z.string().trim().max(100, "Keep the name under 100 characters."),
  role: roleSchema,
});

export async function addMemberAction(slug: string, _prev: AddMemberState, formData: FormData): Promise<AddMemberState> {
  const { tenant, can, user } = await requireTenant(slug);
  if (!can("team.manage")) return { message: "Only the business owner can add logins." };

  const parsed = addSchema.safeParse({
    email: formData.get("email") ?? "",
    name: formData.get("name") ?? "",
    role: formData.get("role") ?? "",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors };
  }

  try {
    const result = await addTeamMember(tenant.id, user.id, { ...parsed.data, name: parsed.data.name || null });
    if (!result.ok) return { errors: { email: result.message } };
    refresh();
    return { added: { email: result.email, tempPassword: result.tempPassword } };
  } catch (error) {
    console.error("Adding a team login failed", error);
    return { message: "Couldn't add them. Try again." };
  }
}

export async function changeRoleAction(slug: string, userId: string, role: string): Promise<{ message?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("team.manage")) return { message: "Only the business owner can change access levels." };
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success || !z.uuid().safeParse(userId).success) return { message: "That isn't a change we can make." };
  try {
    const result = await changeTeamRole(tenant.id, userId, parsedRole.data);
    if (!result.ok) return { message: result.message };
  } catch (error) {
    console.error("Changing a team role failed", error);
    return { message: "Couldn't change it. Try again." };
  }
  refresh();
  return {};
}

export async function removeMemberAction(slug: string, userId: string): Promise<{ message?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("team.manage")) return { message: "Only the business owner can remove logins." };
  if (!z.uuid().safeParse(userId).success) return {};
  try {
    const result = await removeTeamMember(tenant.id, userId);
    if (!result.ok) return { message: result.message };
  } catch (error) {
    console.error("Removing a team login failed", error);
    return { message: "Couldn't remove them. Try again." };
  }
  refresh();
  return {};
}
