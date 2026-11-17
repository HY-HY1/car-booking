import "server-only";
import { createAdminClient } from "../supabase/admin";

// /app/account/password sets a new password without asking for the current
// one, so it only works for an account that's been told to choose one: made
// with a temporary password (sign-up by the super-admin, team invites), or
// just signed in from a password-reset email. The flag lives in app_metadata,
// which only the server can write. Everyone else changes their password in
// Settings → Account, which asks for the current one.
const FLAG = "must_change_password";

// For admin.createUser: an account that starts with a temporary password.
export const TEMPORARY_PASSWORD = { [FLAG]: true };

export async function mustChangePassword(userId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId);
  if (error) throw error;
  return data.user?.app_metadata?.[FLAG] === true;
}

// Set after a reset link is used; cleared once the new password is saved.
export async function setMustChangePassword(userId: string, value: boolean) {
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    // app_metadata is merged, and null removes the key.
    app_metadata: { [FLAG]: value ? true : null },
  });
  if (error) throw error;
}
