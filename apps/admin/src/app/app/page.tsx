import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMemberships, requireUser } from "@/lib/auth";
import { getIsPlatformAdmin } from "@/lib/platform";
import { signOut } from "./actions";
import { adminUrl, appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Choose a business" };

// Sends owners with one business straight to it; anyone with several
// (e.g. the platform admin) picks one.
export default function DashboardIndex() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
      >
        <TenantPicker />
      </Suspense>
    </main>
  );
}

async function TenantPicker() {
  const user = await requireUser();
  const memberships = await getMemberships();
  const platformAdmin = await getIsPlatformAdmin();

  // A platform admin on a single business still gets the picker, so the
  // route to the platform pages is always one click away.
  if (memberships.length === 1 && !platformAdmin) {
    redirect(appUrl(`/${memberships[0].tenant.slug}`));
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          {memberships.length ? "Choose a business" : "No business linked"}
        </CardTitle>
        <CardDescription>
          {memberships.length
            ? `Signed in as ${user.email}`
            : `${user.email} isn't linked to a business yet. Ask your account manager to add you.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {memberships.map(({ tenant, role }) => (
          <Link
            key={tenant.id}
            href={appUrl(`/${tenant.slug}`)}
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {tenant.name}
            <span className="text-xs capitalize text-muted-foreground">
              {role}
            </span>
          </Link>
        ))}
        {platformAdmin && (
          <Link
            href={adminUrl()}
            className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Platform admin
            <span className="text-xs text-muted-foreground">All businesses</span>
          </Link>
        )}
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="w-full">
            Sign out
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
