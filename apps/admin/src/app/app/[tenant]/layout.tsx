import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Announcements } from "@/components/dashboard/announcements";
import { HeaderSearch } from "@/components/dashboard/dashboard-search";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { Button } from "@/components/ui/button";
import { dashboardBrandCss } from "@leadgen/core/branding/colors";
import { ROLES } from "@leadgen/core/team/access";
import { ThemeToggle } from "@/components/theme-toggle";
import { getBranding } from "@/lib/branding";
import { getMemberships, requireTenant } from "@/lib/auth";
import { getIsPlatformAdmin } from "@/lib/platform";
import { loadSetup } from "@/lib/setup";
import { cn } from "@/lib/utils";
import { signOut } from "../actions";
import { adminUrl, appUrl } from "@/lib/urls";

export default function TenantLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]">) {
  return (
    // The business's colours apply inside data-brand (BrandStyle). --bottom-nav
    // is the height of the phone tabs, for anything that sticks to the bottom.
    <div
      data-brand
      className="flex flex-1 flex-col [--bottom-nav:0px] max-md:[--bottom-nav:calc(3.75rem+env(safe-area-inset-bottom))] md:flex-row"
    >
      <Suspense>
        <BrandStyle params={params} />
      </Suspense>
      <Suspense fallback={<div className="hidden bg-sidebar md:block md:h-dvh md:w-60 md:shrink-0" />}>
        <Navigation params={params} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-15 border-b" />}>
          <TopBar params={params} />
        </Suspense>
        <Suspense>
          <Announcements params={params} />
        </Suspense>
        <main className="min-w-0 flex-1 px-4 pt-6 pb-[calc(1.5rem+var(--bottom-nav))] md:px-8 md:py-8">
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

// Their logo stands in for the name once they've uploaded one.
function BrandName({ name, logoUrl }: { name: string; logoUrl: string | null | undefined }) {
  return logoUrl ? (
    // The owner's own upload: any shape, so it's fitted to the space.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={name} className="h-7 w-auto max-w-full object-contain object-left md:max-w-36" />
  ) : (
    <p className="truncate font-semibold">{name}</p>
  );
}

// Search across the top. On a phone it shares the row with the business name,
// which is in the sidebar on anything wider. Search finds customers and
// enquiries, so it's for the office and up.
async function TopBar({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { tenant, role, can } = await requireTenant(slug);
  const branding = await getBranding(tenant.id);
  const canSearch = can("customers.view");

  return (
    <header
      className={cn(
        "flex items-center gap-3 border-b bg-sidebar px-4 py-2 text-sidebar-foreground md:bg-transparent md:px-8 md:text-foreground",
        !canSearch && "md:hidden",
      )}
    >
      <div className={cn("min-w-0 md:hidden", canSearch && "max-w-[35%] shrink-0")}>
        <BrandName name={tenant.name} logoUrl={branding.logo_url} />
      </div>
      {canSearch && <HeaderSearch slug={slug} role={role} />}
    </header>
  );
}

// Whether the checklist is finished. If it can't be told, Setup stays in the
// menu: a spare link does less harm than a missing one.
async function setupFinished(tenantId: string) {
  try {
    return (await loadSetup(tenantId))?.progress.ready ?? false;
  } catch {
    return false;
  }
}

// The sidebar, and the tabs that replace it on a phone.
async function Navigation({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { user, tenant, role, can } = await requireTenant(slug);
  const [memberships, platformAdmin, branding, setupDone] = await Promise.all([
    getMemberships(),
    getIsPlatformAdmin(),
    getBranding(tenant.id),
    can("setup") ? setupFinished(tenant.id) : false,
  ]);

  const switchBusiness = memberships.length > 1 && (
    <Link href={appUrl()} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
      Switch business
    </Link>
  );

  const account = (
    <>
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
    </>
  );

  return (
    <>
      <aside className="hidden border-r bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:block md:h-dvh md:w-60 md:shrink-0">
        <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
          <div className="min-w-0">
            <BrandName name={tenant.name} logoUrl={branding.logo_url} />
            {switchBusiness}
          </div>
          <DashboardNav slug={slug} role={role} setupDone={setupDone} />
          <div className="mt-auto border-t pt-4">{account}</div>
        </div>
      </aside>
      <DashboardTabs slug={slug} role={role} setupDone={setupDone}>
        {switchBusiness && <div className="mb-3">{switchBusiness}</div>}
        {account}
      </DashboardTabs>
    </>
  );
}
