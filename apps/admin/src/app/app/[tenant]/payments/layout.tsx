import { PageHeader } from "@/components/dashboard/page-header";
import { PaymentsTabs } from "@/components/dashboard/payments-tabs";

export default async function PaymentsLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]/payments">) {
  const { tenant: slug } = await params;
  return (
    <>
      <PageHeader title="Payments" />
      <PaymentsTabs slug={slug} />
      {children}
    </>
  );
}
