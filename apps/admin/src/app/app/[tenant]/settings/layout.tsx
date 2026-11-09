import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsTabs } from "@/components/dashboard/settings-tabs";
import { requireTenant } from "@/lib/auth";

export default async function SettingsLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]/settings">) {
  const { tenant: slug } = await params;
  const { role } = await requireTenant(slug);
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs slug={slug} role={role} />
      {children}
    </>
  );
}
