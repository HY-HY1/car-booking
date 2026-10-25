import { PageHeader } from "@/components/dashboard/page-header";
import { PaymentsTabs } from "@/components/dashboard/payments-tabs";

export default async function PaymentsLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]/payments">) {
  const { tenant: slug } = await params;
  return (
    <>
      <PageHeader
        title="Payments"
        description="Every payment taken through your Stripe account, and links to take new ones."
      />
      <PaymentsTabs slug={slug} />
      {children}
    </>
  );
}
