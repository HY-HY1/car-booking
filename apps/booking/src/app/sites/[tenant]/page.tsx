import Link from "next/link";
import { formatPence } from "@leadgen/core/booking/config";
import { formatPhone } from "@leadgen/core/customer-fields";
import { getBookingConfig } from "@leadgen/core/booking/engine";
import { requireRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";

export default async function Home() {
  const tenant = await requireRequestTenant();
  const services = ((await getBookingConfig(tenant.id))?.services ?? []).filter((s) => s.slug);

  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden bg-brand px-4 py-16 text-brand-fg sm:py-24">
        {tenant.branding.cover_url && (
          // The brand colour shows through, so the text stays readable on any photo.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.branding.cover_url} alt="" className="absolute inset-0 size-full object-cover opacity-30" />
        )}
        <div className="relative mx-auto max-w-xl text-center">
          {tenant.branding.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.branding.logo_url} alt="" className="mx-auto mb-6 h-12 w-auto" />
          )}
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{tenant.name}</h1>
          {tenant.branding.tagline && (
            <p className="mt-3 text-lg opacity-80">{tenant.branding.tagline}</p>
          )}
          <Link
            href={pageUrl(tenant, "/quote")}
            className="mt-8 inline-flex h-12 items-center rounded-full bg-accent px-6 font-medium text-accent-fg shadow-sm transition hover:opacity-90"
          >
            Get an instant quote
          </Link>
          {(tenant.contact.phone || tenant.contact.email) && (
            <p className="mt-6 text-sm opacity-80">
              {tenant.contact.phone && (
                <a href={`tel:${tenant.contact.phone}`} className="underline-offset-4 hover:underline">
                  {formatPhone(tenant.contact.phone)}
                </a>
              )}
              {tenant.contact.phone && tenant.contact.email && " · "}
              {tenant.contact.email && (
                <a href={`mailto:${tenant.contact.email}`} className="underline-offset-4 hover:underline">
                  {tenant.contact.email}
                </a>
              )}
            </p>
          )}
        </div>
      </section>

      {services.length > 0 && (
        <section aria-labelledby="services" className="px-4 py-12">
          <div className="mx-auto max-w-4xl">
            <h2 id="services" className="mb-6 text-2xl font-semibold tracking-tight">
              Our services
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {services.map((s) => (
                <li key={s.id}>
                  <Link
                    href={pageUrl(tenant, `/services/${s.slug}`)}
                    className="group block h-full overflow-hidden rounded-2xl border bg-white transition hover:border-neutral-400"
                  >
                    {s.image_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/service-images/${s.image_path}`}
                        alt=""
                        loading="lazy"
                        className="aspect-[16/8] w-full object-cover"
                      />
                    )}
                    <span className="block p-4">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{s.name}</span>
                        <span className="shrink-0 text-sm font-medium">from {formatPence(s.base_price_pence)}</span>
                      </span>
                      {s.tagline && <span className="mt-1 block text-sm text-neutral-600">{s.tagline}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
