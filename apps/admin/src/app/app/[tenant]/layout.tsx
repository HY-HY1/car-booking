import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Announcements } from "@/components/dashboard/announcements";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Button } from "@/components/ui/button";
import { ROLES } from "@leadgen/core/team/access";
import { getMemberships, requireTenant } from "@/lib/auth";
import { getIsPlatformAdmin } from "@/lib/platform";
import { signOut } from "../actions";
import { adminUrl, appUrl } from "@/lib/urls";

export default function TenantLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]">) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <Suspense fallback={<div className="h-28 md:h-full" />}>
          <Sidebar params={params} />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense>
          <Announcements params={params} />
        </Suspense>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

async function Sidebar({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { user, tenant, role } = await requireTenant(slug);
  const memberships = await getMemberships();
  const platformAdmin = await getIsPlatformAdmin();

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2 md:block">
        <div className="min-w-0">
          <p className="truncate font-semibold">{tenant.name}</p>
          {memberships.length > 1 && (
            <Link
              href={appUrl()}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Switch business
            </Link>
          )}
        </div>
        <form action={signOut} className="md:hidden">
          <Button type="submit" variant="ghost" size="sm">
            <LogOut />
            Sign out
          </Button>
        </form>
      </div>

      <DashboardNav slug={slug} role={role} />

      <div className="mt-auto hidden border-t pt-4 md:block">
        <p className="truncate text-sm">{user.email}</p>
        <p className="text-xs text-muted-foreground">{ROLES[role].label}</p>
        <div className="mt-2 flex flex-col gap-1 text-xs">
          {platformAdmin && (
            <Link href={adminUrl()} className="text-muted-foreground underline-offset-4 hover:underline">
              Platform admin
            </Link>
          )}
          <Link href={appUrl(`/${slug}/settings/account`)} className="text-muted-foreground underline-offset-4 hover:underline">
            Your account
          </Link>
        </div>
        <form action={signOut} className="mt-2">
          <Button type="submit" variant="ghost" size="sm" className="-ml-2">
            <LogOut />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
