import type { Metadata } from "next";
import { CustomerForm } from "@/components/dashboard/customer-form";
import { BackLink, PageHeader } from "@/components/dashboard/page-header";
import { requireAccess } from "@/lib/auth";
import { createCustomer } from "../actions";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Add customer" };

export default async function NewCustomerPage({
  params,
}: PageProps<"/app/[tenant]/customers/new">) {
  const { tenant: slug } = await params;
  await requireAccess(slug, "customers.view");

  return (
    <>
      <BackLink href={appUrl(`/${slug}/customers`)}>Customers</BackLink>
      <PageHeader
        title="Add customer"
        description="Customers from the booking page are added automatically. Use this for phone or walk-in enquiries."
      />
      <CustomerForm
        action={createCustomer.bind(null, slug)}
        submitLabel="Add customer"
      />
    </>
  );
}
