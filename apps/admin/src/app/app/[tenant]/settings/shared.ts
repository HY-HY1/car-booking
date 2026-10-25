import "server-only";
import { z } from "zod";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { requireTenant } from "@/lib/auth";

// Shared by the Settings tabs' server actions. Every write is filtered on the
// tenant from the URL's membership check, never an id from the form.

// Takes a ZodError or anything shaped like one (parseNotificationsForm).
export function fieldErrors(error: Pick<z.ZodError, "issues"> | { issues: { path: PropertyKey[]; message: string }[] }): SaveState {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { errors, message: errors.form };
}

export function failed(what: string, error: unknown): SaveState {
  console.error(`Saving ${what} failed`, error);
  return { message: `Couldn't save ${what}. Try again.` };
}

// FormData → plain strings for the schemas (files are handled separately).
export function plain(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) if (typeof value === "string") values[key] = value;
  return values;
}

// Settings are changed by owners and managers (team/access.ts).
export async function requireOwner(slug: string) {
  const result = await requireTenant(slug);
  if (!result.can("settings.edit")) {
    return { ...result, denied: { message: "Your access level doesn't include changing settings." } as SaveState };
  }
  return { ...result, denied: null };
}
