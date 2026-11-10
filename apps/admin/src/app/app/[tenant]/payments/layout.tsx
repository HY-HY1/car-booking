import { PageHeader } from "@/components/dashboard/page-header";
import { PageTabs } from "@/components/dashboard/page-tabs";

export default async function PaymentsLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]/payments">) {
  const { tenant: slug } = await params;
  return (
    <>
      <PageHeader title="Payments" />
      <PageTabs
        base={`/${slug}/payments`}
        tabs={[
          { path: "", label: "Payments" },
          { path: "/links", label: "Payment links" },
          { path: "/export", label: "Export" },
        ]}
      />
      {children}
    </>
  );
}
