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
      <PageHeader
        title="Settings"
        description="Your account, your business, your booking page and how bookings, payments and messages work."
      />
      <SettingsTabs slug={slug} role={role} />
      {children}
    </>
  );
}
