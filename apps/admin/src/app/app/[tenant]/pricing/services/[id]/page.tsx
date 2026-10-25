import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, ComingSoon, PageHeader } from "@/components/dashboard/page-header";
import { ServiceForm } from "@/components/dashboard/service-editor";
import { requireAccess } from "@/lib/auth";
import { loadPricing } from "@/lib/pricing";
import { loadSetup } from "@/lib/setup";
import { deleteService, saveService } from "../../actions";
import { appUrl, tenantUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Edit service" };

export default async function ServicePage({ params }: PageProps<"/app/[tenant]/pricing/services/[id]">) {
  const { tenant: slug, id } = await params;
  const { tenant, can } = await requireAccess(slug, "pricing.view");
  const [{ rules, services }, setup] = await Promise.all([loadPricing(tenant.id), loadSetup(tenant.id)]);
  const readOnly = !can("pricing.edit");
  const back = <BackLink href={appUrl(`/${slug}/pricing`)}>All services</BackLink>;

  if (!rules) {
    return (
      <>
        {back}
        <PageHeader title="Service" />
        <ComingSoon>Booking isn&apos;t set up for this business yet.</ComingSoon>
      </>
    );
  }

  const isNew = id === "new";
  const service = isNew ? undefined : services.find((s) => s.id === id);
  if (!isNew && !service) notFound();

  const pageUrl = service?.slug
    ? tenantUrl(slug, `/services/${service.slug}`, { absolute: true, customDomain: setup?.customDomain })
    : null;

  return (
    <>
      {back}
      <PageHeader
        title={service ? service.name : "Add a service"}
        description="Everything here appears on this service's own page and in your booking list. Changes show straight away."
      />
      {readOnly && (
        <p className="mb-6 rounded-lg bg-muted p-3 text-sm text-muted-foreground">Only the business owner can change services.</p>
      )}
      <div className="max-w-5xl">
        <ServiceForm
          // Remounts after a save so the form picks up what was stored.
          key={service ? `${service.id}-${JSON.stringify(service)}` : "new"}
          service={service}
          action={saveService.bind(null, slug, service?.id ?? null)}
          deleteAction={service ? deleteService.bind(null, slug, service.id) : undefined}
          readOnly={readOnly}
          pageUrl={pageUrl}
        />
      </div>
    </>
  );
}
