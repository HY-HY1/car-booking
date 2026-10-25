import type { Metadata } from "next";
import { Download } from "lucide-react";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/dashboard/customer-form";
import { DeleteCustomerButton } from "@/components/dashboard/delete-customer-button";
import { PhotoGallery } from "@/components/dashboard/photo-gallery";
import { BackLink, ComingSoon, PageHeader } from "@/components/dashboard/page-header";
import { requireAccess } from "@/lib/auth";
import {
  CUSTOMER_SOURCES,
  MARKETING_BASES,
  formatDate,
} from "@leadgen/core/customer-fields";
import { getCustomer } from "@/lib/customers";
import { listCustomerPhotos } from "@/lib/photos";
import { deleteCustomer, deletePhoto, updateCustomer } from "../actions";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({
  params,
}: PageProps<"/app/[tenant]/customers/[id]">) {
  const { tenant: slug, id } = await params;
  const { tenant, can } = await requireAccess(slug, "customers.view");
  const customer = await getCustomer(tenant.id, id);
  if (!customer) notFound();
  const photos = await listCustomerPhotos(tenant.id, customer.id);

  const source =
    CUSTOMER_SOURCES[customer.source as keyof typeof CUSTOMER_SOURCES] ??
    customer.source;

  return (
    <>
      <BackLink href={appUrl(`/${slug}/customers`)}>Customers</BackLink>
      <PageHeader
        title={customer.name}
        description={`Added ${formatDate(customer.created_at)} · ${source}`}
      />
      {customer.anonymised_at && (
        <p className="mb-6 rounded-lg border bg-muted/50 p-3 text-sm">
          This customer&apos;s details were erased on {formatDate(customer.anonymised_at)}. Their past
          bookings remain in your records without their personal details.
        </p>
      )}

      <div className="grid gap-10">
        <section aria-labelledby="details-heading">
          <h2 id="details-heading" className="mb-4 font-medium">
            Details
          </h2>
          <CustomerForm
            action={updateCustomer.bind(null, slug, customer.id)}
            customer={customer}
            submitLabel="Save changes"
          />
          {customer.marketing_updated_at && (
            <p className="mt-3 text-xs text-muted-foreground">
              Marketing preferences last changed{" "}
              {formatDate(customer.marketing_updated_at)}
              {customer.marketing_basis &&
                ` (${MARKETING_BASES[customer.marketing_basis]})`}
              .
            </p>
          )}
        </section>

        <section id="photos" aria-labelledby="photos-heading">
          <h2 id="photos-heading" className="mb-1 font-medium">
            Photos
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Taken by the customer when booking. Click one to see it full size.
          </p>
          {photos.length ? (
            <PhotoGallery
              photos={photos}
              canDelete={can("customers.delete")}
              deleteAction={deletePhoto.bind(null, slug)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No photos.</p>
          )}
        </section>

        <section aria-labelledby="history-heading">
          <h2 id="history-heading" className="mb-4 font-medium">
            Vehicles and bookings
          </h2>
          <ComingSoon>
            Their vehicles and past jobs will show here.
          </ComingSoon>
        </section>

        {can("customers.delete") && !customer.anonymised_at && (
          <section aria-labelledby="privacy-heading" className="border-t pt-6">
            <h2 id="privacy-heading" className="mb-1 font-medium">
              Their data (GDPR)
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              If they ask for a copy of what you hold, download it here and send it once you&apos;re
              sure who is asking. If they ask to be erased, erasing removes their name, contact details,
              address, notes, vehicles and photos. Past jobs stay in your records without their details,
              for your accounts. Log the request under Settings, Privacy.
            </p>
            <div className="flex flex-wrap items-start gap-3">
              <a
                href={appUrl(`/${slug}/customers/${customer.id}/export`)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium hover:bg-muted"
              >
                <Download className="size-4" />
                Download their data
              </a>
              <DeleteCustomerButton
                name={customer.name}
                action={deleteCustomer.bind(null, slug, customer.id)}
              />
            </div>
          </section>
        )}
      </div>
    </>
  );
}
