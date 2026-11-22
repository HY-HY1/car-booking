import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getMemberships, twoFactorState } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform";
import { adminUrl, appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Turn on two-factor login" };

// Where a platform admin without an authenticator is sent: the panel can
// read and change every business, so a password alone isn't enough.
export default function TwoFactorPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requirePlatformAdmin(adminUrl("/two-factor"), { setup: true });
  if ((await twoFactorState())?.enrolled) redirect(adminUrl());
  const memberships = await getMemberships();
  const first = memberships[0]?.tenant.slug;

  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <PageHeader
        title="Turn on two-factor login"
        description="The platform admin can see and change every business, so it needs a code from your phone as well as your password."
      />
      <div className="grid gap-4 rounded-xl bg-card p-5 text-sm ring-1 ring-foreground/10">
        <ShieldCheck className="size-6 text-primary" />
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Open your account settings in one of your dashboards.</li>
          <li>Under Two-factor login, scan the code with an authenticator app (Google Authenticator, 1Password, Authy).</li>
          <li>Enter the six-digit code it shows, then come back here.</li>
        </ol>
        {first ? (
          <Link href={appUrl(`/${first}/settings/account`)} className={buttonVariants({ className: "w-fit" })}>
            Set it up in Settings → Your account
          </Link>
        ) : (
          <p>
            You&apos;re not on any business yet, so there&apos;s no settings page to set it up from. Add yourself to one in the
            database (tenant_members), or create one with “Add me” ticked, then come back.
          </p>
        )}
      </div>
    </div>
  );
}
