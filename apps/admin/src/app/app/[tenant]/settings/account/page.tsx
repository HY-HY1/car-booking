import type { Metadata } from "next";
import { ROLES } from "@leadgen/core/team/access";
import { EmailForm, PasswordForm, ProfileForm } from "@/components/dashboard/settings/account-forms";
import { TwoFactor } from "@/components/dashboard/settings/two-factor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export const metadata: Metadata = { title: "Account" };

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
    <div className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            Your access here: {ROLES[role].label}. These are yours, not the business&apos;s: customers don&apos;t see them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm values={{ full_name: meta.full_name ?? "", phone: meta.phone ?? "" }} action={saveProfileAction} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            You sign in with <span className="font-medium text-foreground">{user.email}</span>
            {user.new_email ? `. A change to ${user.new_email} is waiting for you to confirm it.` : "."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailForm current={user.email ?? null} action={changeEmailAction.bind(null, slug)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>At least 10 characters. Changing it keeps you signed in here.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm action={changePasswordAction.bind(null, slug)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Two-factor login <Badge tone={twoFactorOn ? "success" : "neutral"}>{twoFactorOn ? "On" : "Off"}</Badge>
          </CardTitle>
          <CardDescription>
            A code from an authenticator app each time you sign in, so a stolen password isn&apos;t enough.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactor
            enabled={twoFactorOn}
            start={startTwoFactorAction}
            confirm={confirmTwoFactorAction.bind(null, slug)}
            disable={disableTwoFactorAction.bind(null, slug)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign out of all devices</CardTitle>
          <CardDescription>
            Lost a phone, or signed in on someone else&apos;s computer? This signs you out everywhere, here included.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOutEverywhereAction}>
            <Button type="submit" variant="outline">
              Sign out everywhere
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
