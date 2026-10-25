"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createApiKey, revokeApiKey } from "@leadgen/core/api/keys";
import { requireTenant } from "@/lib/auth";

// Settings → API. Owner-only: the keys are written with the secret key, so
// this check is what stops anyone else.

export type CreateKeyState = { key?: string; error?: string };

export async function createKeyAction(slug: string, formData: FormData): Promise<CreateKeyState> {
  const { tenant, can, user } = await requireTenant(slug);
  if (!can("api")) return { error: "Only the business owner can create API keys." };

  const name = z.string().trim().min(1).max(60).safeParse(formData.get("name"));
  if (!name.success) return { error: "Give the key a name of up to 60 characters, like “Main website”." };

  try {
    const key = await createApiKey(tenant.id, name.data, user.id);
    refresh();
    return { key };
  } catch (error) {
    console.error("Creating an API key failed", error);
    return { error: "Couldn't create the key. Try again." };
  }
}

export async function revokeKeyAction(slug: string, id: string): Promise<{ error?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("api")) return { error: "Only the business owner can revoke API keys." };
  if (!z.uuid().safeParse(id).success) return { error: "That key no longer exists." };

  try {
    await revokeApiKey(tenant.id, id);
    refresh();
    return {};
  } catch (error) {
    console.error("Revoking an API key failed", error);
    return { error: "Couldn't revoke the key. Try again." };
  }
}
