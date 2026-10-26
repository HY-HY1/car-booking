import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Announcements } from "@/components/dashboard/announcements";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Button } from "@/components/ui/button";
import { dashboardBrandCss } from "@leadgen/core/branding/colors";
import { ROLES } from "@leadgen/core/team/access";
import { ThemeToggle } from "@/components/theme-toggle";
import { getBranding } from "@/lib/branding";
import { getMemberships, requireTenant } from "@/lib/auth";
import { getIsPlatformAdmin } from "@/lib/platform";
import { signOut } from "../actions";
import { adminUrl, appUrl } from "@/lib/urls";

export default function TenantLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]">) {
  return (
    // The business's colours apply inside data-brand (BrandStyle).
    <div data-brand className="flex flex-1 flex-col md:flex-row">
      <Suspense>
        <BrandStyle params={params} />
      </Suspense>
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

// The brand's colours for this dashboard, in light and dark mode. The CSS is
// built only from colours the schema checked are #rrggbb.
async function BrandStyle({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenant(slug);
  const branding = await getBranding(tenant.id);
  return <style dangerouslySetInnerHTML={{ __html: dashboardBrandCss(branding) }} />;
}

async function Sidebar({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { user, tenant, role } = await requireTenant(slug);
  const [memberships, platformAdmin, branding] = await Promise.all([
    getMemberships(),
    getIsPlatformAdmin(),
    getBranding(tenant.id),
  ]);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2 md:block">
        <div className="min-w-0">
          {/* Their logo stands in for the name once they've uploaded one. */}
          {branding.logo_url ? (
            // The owner's own upload: any shape, so it's fitted to the sidebar.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo_url} alt={tenant.name} className="h-7 w-auto max-w-36 object-contain object-left" />
          ) : (
            <p className="truncate font-semibold">{tenant.name}</p>
          )}
          {memberships.length > 1 && (
            <Link
              href={appUrl()}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Switch business
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 md:hidden">
          <ThemeToggle />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut />
              Sign out
            </Button>
          </form>
        </div>
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
        <div className="mt-2 flex items-center justify-between gap-2">
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="-ml-2">
              <LogOut />
              Sign out
            </Button>
          </form>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
