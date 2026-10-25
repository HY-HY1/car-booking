import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronDown, Clock, X } from "lucide-react";
import { formatDuration, formatPence, type Service } from "@leadgen/core/booking/config";
import { getBookingConfig } from "@leadgen/core/booking/engine";
import { requireRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";

// One page per service: everything a customer wants to know before booking.

function imageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/service-images/${path}`;
}

async function loadService(slug: string) {
  const tenant = await requireRequestTenant();
  const config = await getBookingConfig(tenant.id);
  const service = config?.services.find((s) => s.slug === slug);
  if (!config || !service) notFound();
  return { tenant, service, others: config.services.filter((s) => s.id !== service.id && s.slug) };
}

export async function generateMetadata({ params }: PageProps<"/sites/[tenant]/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { service } = await loadService(slug);
  const title = service.seo_title || service.name;
  const description = service.seo_description || service.tagline || service.description || undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: service.image_path ? [imageUrl(service.image_path)] : undefined,
    },
  };
}

export default async function ServicePage({ params }: PageProps<"/sites/[tenant]/services/[slug]">) {
  const { slug } = await params;
  const { tenant, service, others } = await loadService(slug);
  const book = pageUrl(tenant, `/quote?service=${service.id}`);
  const paragraphs = (service.body ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const includes = service.includes ?? [];
  const notIncluded = service.not_included ?? [];
  const steps = service.steps ?? [];
  const faqs = service.faqs ?? [];
  const gallery = service.gallery ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.seo_description || service.tagline || service.description || undefined,
    image: service.image_path ? imageUrl(service.image_path) : undefined,
    provider: { "@type": "LocalBusiness", name: tenant.name },
    offers: { "@type": "Offer", priceCurrency: "GBP", price: (service.base_price_pence / 100).toFixed(2) },
  };

  return (
    <main className="flex flex-1 flex-col pb-24 sm:pb-0">
      <header className="bg-brand px-4 py-3 text-brand-fg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link href={pageUrl(tenant)} className="font-semibold">
            {tenant.name}
          </Link>
          <Link href={book} className="hidden rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg sm:inline-block">
            Get an instant quote
          </Link>
        </div>
      </header>

      <Hero service={service} />

      <div className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div className="grid gap-10">
          {paragraphs.length > 0 && (
            <section aria-labelledby="about" className="grid gap-3">
              <h2 id="about" className="text-xl font-semibold tracking-tight">
                About this service
              </h2>
              {paragraphs.map((p, i) => (
                <p key={i} className="leading-relaxed text-neutral-700">
                  {p}
                </p>
              ))}
            </section>
          )}

          {(includes.length > 0 || notIncluded.length > 0) && (
            <section aria-labelledby="included" className="grid gap-4">
              <h2 id="included" className="text-xl font-semibold tracking-tight">
                What&apos;s included
              </h2>
              <div className={`grid gap-6 ${includes.length && notIncluded.length ? "sm:grid-cols-2" : ""}`}>
                {includes.length > 0 && (
                  <ul className="grid gap-2.5">
                    {includes.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {notIncluded.length > 0 && (
                  <div>
                    <p className="mb-2.5 text-sm font-medium text-neutral-500">Not included</p>
                    <ul className="grid gap-2.5 text-neutral-600">
                      {notIncluded.map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                          <X className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {gallery.length > 0 && (
            <section aria-labelledby="gallery" className="grid gap-3">
              <h2 id="gallery" className="text-xl font-semibold tracking-tight">
                Our work
              </h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {gallery.map((path) => (
                  <li key={path} className="overflow-hidden rounded-xl bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(path)} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {steps.length > 0 && (
            <section aria-labelledby="how" className="grid gap-4">
              <h2 id="how" className="text-xl font-semibold tracking-tight">
                How it works
              </h2>
              <ol className="grid gap-5">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span
                      aria-hidden
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-fg"
                    >
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-medium">{step.title}</h3>
                      {step.text && <p className="mt-0.5 text-neutral-600">{step.text}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {faqs.length > 0 && (
            <section aria-labelledby="faqs" className="grid gap-3">
              <h2 id="faqs" className="text-xl font-semibold tracking-tight">
                Questions
              </h2>
              <div className="divide-y rounded-2xl border bg-white">
                {faqs.map((f, i) => (
                  <details key={i} className="group px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <ChevronDown className="size-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <p className="mt-2 leading-relaxed text-neutral-600">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <PriceCard service={service} href={book} />
        </aside>
      </div>

      {others.length > 0 && (
        <section aria-labelledby="more" className="border-t bg-neutral-50 px-4 py-10">
          <div className="mx-auto max-w-4xl">
            <h2 id="more" className="mb-4 text-xl font-semibold tracking-tight">
              Other services
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {others.map((o) => (
                <li key={o.id}>
                  <Link
                    href={pageUrl(tenant, `/services/${o.slug}`)}
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-4 transition hover:border-neutral-400"
                  >
                    <span>
                      <span className="block font-medium">{o.name}</span>
                      {o.tagline && <span className="block text-sm text-neutral-500">{o.tagline}</span>}
                    </span>
                    <span className="shrink-0 text-sm font-medium">from {formatPence(o.base_price_pence)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Phones: the price and button stay in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div>
            <p className="text-xs text-neutral-500">From</p>
            <p className="text-lg leading-none font-semibold">{formatPence(service.base_price_pence)}</p>
          </div>
          <Link href={book} className="inline-flex h-11 items-center rounded-full bg-accent px-6 font-medium text-accent-fg">
            Book now
          </Link>
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </main>
  );
}

function Hero({ service }: { service: Service }) {
  const image = service.image_path ? imageUrl(service.image_path) : null;
  return (
    <section className="relative isolate overflow-hidden bg-brand text-brand-fg">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
      )}
      {image && <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />}
      <div className={`mx-auto max-w-4xl px-4 ${image ? "pt-40 pb-8 text-white sm:pt-56" : "py-12 sm:py-16"}`}>
        {service.badge && (
          <span className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-fg">{service.badge}</span>
        )}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{service.name}</h1>
        {service.tagline && <p className="mt-2 max-w-2xl text-lg opacity-90">{service.tagline}</p>}
        {service.description && <p className="mt-2 max-w-2xl opacity-80">{service.description.trim()}</p>}
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-90">
          <span className="font-medium">From {formatPence(service.base_price_pence)}</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden /> {formatDuration(service.duration_mins)}
          </span>
        </p>
      </div>
    </section>
  );
}

function PriceCard({ service, href }: { service: Service; href: string }) {
  return (
    <div className="grid gap-3 rounded-2xl border bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm text-neutral-500">From</p>
        <p className="text-3xl font-semibold tracking-tight">{formatPence(service.base_price_pence)}</p>
        <p className="text-sm text-neutral-500">Final price depends on your car&apos;s size and condition.</p>
      </div>
      <p className="flex items-center gap-2 text-sm text-neutral-600">
        <Clock className="size-4" aria-hidden /> Takes about {formatDuration(service.duration_mins)}
      </p>
      <Link href={href} className="inline-flex h-12 items-center justify-center rounded-full bg-accent font-medium text-accent-fg transition hover:opacity-90">
        Get an instant quote
      </Link>
      <p className="text-center text-xs text-neutral-500">Takes about a minute. No payment to get a price.</p>
    </div>
  );
}
