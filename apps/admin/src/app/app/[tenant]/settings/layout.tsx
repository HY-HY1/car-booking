import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsNav } from "@/components/dashboard/settings-nav";
import { requireTenant } from "@/lib/auth";

export default async function SettingsLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]/settings">) {
  const { tenant: slug } = await params;
  const { role, can } = await requireTenant(slug);
  return (
    <>
      <PageHeader title="Settings" />
      {/* Technicians only have their own account here, so nothing to choose between. */}
      {can("settings.view") ? (
        <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-start lg:gap-8">
          <SettingsNav slug={slug} role={role} />
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        children
      )}
    </>
  );
}
