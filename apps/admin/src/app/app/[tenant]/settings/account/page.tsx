import type { Metadata } from "next";
import { ROLES } from "@leadgen/core/team/access";
import { EmailForm, PasswordForm, ProfileForm, SignOutEverywhere } from "@/components/dashboard/settings/account-forms";
import { SettingsSection, SettingsStack } from "@/components/dashboard/settings/section";
import { TwoFactor } from "@/components/dashboard/settings/two-factor";
import { Badge } from "@/components/ui/badge";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  changeEmailAction,
  changePasswordAction,
  confirmTwoFactorAction,
  disableTwoFactorAction,
  saveProfileAction,
  signOutEverywhereAction,
  startTwoFactorAction,
} from "./actions";

export const metadata: Metadata = { title: "Your account" };

// The signed-in person, not the business: the same for every business they
// belong to.
export default async function AccountPage({ params }: PageProps<"/app/[tenant]/settings/account">) {
  const { tenant: slug } = await params;
  const { role } = await requireTenant(slug);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error("No user");
  const user = data.user;
  const meta = (user.user_metadata ?? {}) as { full_name?: string; phone?: string };
  const twoFactorOn = user.factors?.some((f) => f.factor_type === "totp" && f.status === "verified") ?? false;

  return (
    <SettingsStack>
      <SettingsSection
        id="details"
        title="Your details"
        badge={<Badge>{ROLES[role].label}</Badge>}
        description="Yours, not the business's: customers don't see them."
      >
        <ProfileForm values={{ full_name: meta.full_name ?? "", phone: meta.phone ?? "" }} action={saveProfileAction} />
      </SettingsSection>

      <SettingsSection
        id="email"
        title="Email"
        description={
          <>
            You sign in with <span className="font-medium text-foreground">{user.email}</span>.
            {user.new_email && (
              <span className="mt-2 block">
                A change to <span className="font-medium text-foreground">{user.new_email}</span> is waiting for you to confirm it.
              </span>
            )}
          </>
        }
      >
        <EmailForm action={changeEmailAction.bind(null, slug)} />
      </SettingsSection>

      <SettingsSection id="password" title="Password" description="Changing it keeps you signed in here.">
        <PasswordForm action={changePasswordAction.bind(null, slug)} twoFactorOn={twoFactorOn} />
      </SettingsSection>

      <SettingsSection
        id="two-factor"
        title="Two-factor login"
        badge={<Badge tone={twoFactorOn ? "success" : "warning"}>{twoFactorOn ? "On" : "Off"}</Badge>}
        description="A code from an authenticator app each time you sign in, so a stolen password isn't enough."
      >
        <TwoFactor
          enabled={twoFactorOn}
          start={startTwoFactorAction}
          confirm={confirmTwoFactorAction.bind(null, slug)}
          disable={disableTwoFactorAction.bind(null, slug)}
        />
      </SettingsSection>

      <SettingsSection
        id="sign-out"
        title="Sign out of all devices"
        description="Lost a phone, or signed in on someone else's computer? This signs you out everywhere, here included."
      >
        <SignOutEverywhere action={signOutEverywhereAction} />
      </SettingsSection>
    </SettingsStack>
  );
}
