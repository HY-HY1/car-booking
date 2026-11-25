import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock, Home, MapPin, Phone, Plus, Store, X } from "lucide-react";
import { addOnFitsService, formatDuration, formatPence } from "@leadgen/core/booking/config";
import { siteNeedsOf, siteNeedsText } from "@leadgen/core/booking/site-needs";
import { conditionLines, durationRange, oneSizeFitsAll, priceNotes, sizeRows } from "@leadgen/core/booking/service-pricing";
import { policyLineText } from "@leadgen/core/branding/extras";
import { formatPhone } from "@leadgen/core/customer-fields";
import { loadPublicReviews } from "@leadgen/core/reviews/sync";
import { jsonLdText } from "@leadgen/core/seo/local-business";
import { policyOf } from "@leadgen/core/settings/policy";
import { loadBookingConfig } from "@/lib/booking-config";
import { pageMetadata } from "@/lib/seo";
import { requireRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";
import { cn } from "@/lib/cn";
import { BOOKING_STEPS, SiteFrame, container, shownPhone } from "@/components/site";
import { serviceImageUrl as imageUrl } from "@/components/service-card";
import { Availability, AvailabilitySkeleton } from "@/components/home/availability";
import { BookBar } from "@/components/home/book-bar";
import { FaqSection } from "@/components/home/faqs";
import { GalleryGrid } from "@/components/home/gallery";
import { Reviews } from "@/components/home/reviews";
import { ServiceRow } from "@/components/home/service-row";
import { BeforeAfterSlider } from "@/components/before-after";

// One page per service: everything a customer wants to know before booking,
// all from what the business has set up in the dashboard. The service's own
// write-up (Pricing → the service's page: tagline, description, what's
// included and not, steps, photos, questions), its price and time for each
// car size and what changes them (the pricing rules), the extras that go
// with it, where it's done (hours & rules, coverage), the business's reviews
// and questions, and its other services. Anything not set is left out, so
// a service with little written still reads as finished.

// The business's reviews on service pages: hidden for now (the owner asked),
// kept so they can come back by flipping this.
const SHOW_REVIEWS = false;

async function loadService(slug: string) {
  const tenant = await requireRequestTenant();
  const config = await loadBookingConfig(tenant.id);
  const service = config?.services.find((s) => s.slug === slug);
  if (!config || !service) notFound();
  return { tenant, config, service, others: config.services.filter((s) => s.id !== service.id && s.slug) };
}

// The service's own title and description (from its page in Pricing), its
// photo to share, and its one canonical address.
export async function generateMetadata({ params }: PageProps<"/sites/[tenant]/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { tenant, service } = await loadService(slug);
  return pageMetadata(tenant, `/services/${service.slug}`, {
    title: service.seo_title || service.name,
    description: service.seo_description || service.tagline || service.description,
    image: service.image_path ? imageUrl(service.image_path) : undefined,
  });
}

export default async function ServicePage({ params }: PageProps<"/sites/[tenant]/services/[slug]">) {
  const { slug } = await params;
  const { tenant, config, service, others } = await loadService(slug);
  const { settings } = config;
  const reviewSettings = tenant.branding.reviews;
  const reviews = SHOW_REVIEWS && reviewSettings.show
    ? await loadPublicReviews(tenant.id, reviewSettings.pinned).catch((error) => {
        console.error("Couldn't load the Google reviews", error);
        return null;
      })
    : null;

  const book = pageUrl(tenant, `/quote?service=${service.id}`);
  const callPhone = shownPhone(tenant);
  const contactHref = tenant.contact.phone ? `tel:${tenant.contact.phone}` : tenant.contact.email ? `mailto:${tenant.contact.email}` : null;
  const enquiryUrl = tenant.branding.extras.enquiries.show ? pageUrl(tenant, "/contact") : null;
  const policyLine = policyLineText(tenant.branding.extras, settings.deposit, policyOf(settings.cancellation_policy));

  // The written parts, from the service's page in Pricing.
  const description = service.description?.trim() || null;
  const tagline = service.tagline?.trim() || null;
  // The tagline sits over the name when there's a description to follow it;
  // on its own it follows the name instead.
  const eyebrow = description && tagline && tagline !== description ? tagline : null;
  const lead = description ?? tagline;
  const paragraphs = (service.body ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const includes = (service.includes ?? []).map((i) => i.trim()).filter(Boolean);
  const notIncluded = (service.not_included ?? []).map((i) => i.trim()).filter(Boolean);
  const steps = (service.steps ?? []).filter((s) => s.title.trim() || s.text.trim());
  const gallery = (service.gallery ?? []).map((path) => ({ url: imageUrl(path)! }));
  // Its own questions, or else the business's general ones.
  const faqs = (service.faqs ?? []).length
    ? service.faqs!.map((f) => ({ question: f.q, answer: f.a }))
    : tenant.branding.faqs;
  const image = service.image_path ? imageUrl(service.image_path) : null;
  // Before and after pairs (Pricing → the service → Before and after).
  const pairs = (service.before_after ?? []).map((p) => ({ before: imageUrl(p.before)!, after: imageUrl(p.after)!, caption: p.caption }));

  // Prices and times, as the booking form works them out.
  const rows = sizeRows(service, settings.min_price_pence);
  const sameForAll = oneSizeFitsAll(rows);
  const fromPence = Math.min(...rows.map((r) => r.pricePence));
  const time = durationRange(rows);
  const timeText = time.min === time.max ? formatDuration(time.min) : `${formatDuration(time.min)} – ${formatDuration(time.max)}`;
  const notes = priceNotes(settings);
  const conditions = conditionLines(settings.condition_tiers, service.base_price_pence);
  const extras = config.addOns.filter((x) => addOnFitsService(x, service.id));

  // Where it's done: only the places this service goes and the business offers.
  const atAddress = settings.offers_mobile && service.location_types.includes("mobile");
  const atPremises = settings.offers_unit && service.location_types.includes("unit");
  const unitAddress = [settings.unit_address, settings.unit_postcode].filter(Boolean).join(", ");
  const needs = siteNeedsText(siteNeedsOf(settings.site_requirements));
  const places = tenant.branding.home.places;
  const showArea = atAddress && tenant.branding.home.show_area && Object.keys(settings.service_area).length > 0;
  const lower = service.name.charAt(0).toLowerCase() + service.name.slice(1);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.seo_description || lead || undefined,
    image: image ?? undefined,
    serviceType: service.name,
    provider: { "@type": "AutoWash", name: tenant.name, url: pageUrl(tenant, "/", { absolute: true }) },
    areaServed: atAddress && places.length ? places.map((name) => ({ "@type": "Place", name })) : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "GBP",
      lowPrice: (fromPence / 100).toFixed(2),
      highPrice: (Math.max(...rows.map((r) => r.pricePence)) / 100).toFixed(2),
      url: pageUrl(tenant, `/services/${service.slug}`, { absolute: true }),
    },
  };

  const bookButton = (label = "Check prices and book") => (
    <Link
      href={book}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-medium text-accent-fg shadow-sm ring-1 ring-black/5 transition hover:opacity-90"
    >
      {label} <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
  const callButton = callPhone ? (
    <a href={`tel:${callPhone}`} className="inline-flex h-12 items-center gap-2 rounded-full border border-current/30 px-6 font-medium transition hover:bg-current/10">
      <Phone className="size-4" aria-hidden /> Call {formatPhone(callPhone)}
    </a>
  ) : null;

  return (
    <SiteFrame tenant={tenant} bottomBar>
      <main className="flex flex-1 flex-col">
        {/* ------------------------------------------------------------ hero */}
        <section id="service-top" className="bg-wash">
          <div className={cn(container, "grid gap-10 pt-6 pb-12 sm:pb-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12")}>
            <div className="grid content-start gap-6">
              <Link href={pageUrl(tenant, "/#services")} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-600 transition hover:text-neutral-950">
                <ArrowLeft className="size-4" aria-hidden /> All services
              </Link>
              <div className="grid gap-4">
                {(eyebrow || service.badge) && (
                  <div className="flex flex-wrap items-center gap-3">
                    {eyebrow && <Label>{eyebrow}</Label>}
                    {service.badge && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg">{service.badge}</span>}
                  </div>
                )}
                <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{service.name}</h1>
                {lead && <p className="max-w-xl text-lg text-pretty text-neutral-700">{lead}</p>}
              </div>
              <ul className="flex flex-wrap gap-2 text-sm">
                <Fact>From {formatPence(fromPence)}</Fact>
                <Fact icon={<Clock className="size-4" aria-hidden />}>About {timeText}</Fact>
                {atAddress && <Fact icon={<Home className="size-4" aria-hidden />}>At your address</Fact>}
                {atPremises && <Fact icon={<Store className="size-4" aria-hidden />}>At our premises</Fact>}
              </ul>
              <div className="flex flex-wrap gap-3">
                {bookButton()}
                {callButton}
              </div>
              {policyLine && <p className="text-sm text-neutral-600">{policyLine}</p>}
            </div>

            {/* The service's photo, or else a card with when it can be done. */}
            {image ? (
              <div className="relative aspect-4/3 overflow-hidden rounded-2xl shadow-lg ring-1 shadow-black/15 ring-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
              </div>
            ) : (
              <div className="grid gap-6 rounded-2xl bg-surface p-6 shadow-lg ring-1 shadow-black/10 ring-black/5 sm:p-7">
                <Suspense fallback={<AvailabilitySkeleton />}>
                  <Availability tenantId={tenant.id} config={config} durationMins={time.min} />
                </Suspense>
                <div className="grid gap-2 border-t pt-6">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-neutral-500">From</span>
                    <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatPence(fromPence)}</span>
                  </p>
                  <Link
                    href={book}
                    className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 font-medium text-accent-fg shadow-sm ring-1 ring-black/5 transition hover:opacity-90"
                  >
                    Check prices and book <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ------------------------------------------- prices and what's in it */}
        <section aria-label="Prices and what's included" className="py-12 sm:py-16">
          <div className={container}>
            <div className={cn("grid gap-10 rounded-2xl border bg-surface p-6 shadow-xs sm:p-10", includes.length > 0 && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14")}>
              <div className="grid content-start gap-5">
                <Label>Pricing</Label>
                {sameForAll ? (
                  <PriceRow name="Any car" detail={null} price={formatPence(rows[0].pricePence)} time={formatDuration(rows[0].durationMins)} />
                ) : (
                  <ul className={cn("grid divide-y", includes.length === 0 && "sm:grid-cols-2 sm:gap-x-10 sm:divide-y-0")}>
                    {rows.map((r) => (
                      <li key={r.size} className={cn(includes.length === 0 && "sm:border-b")}>
                        <PriceRow name={r.name} detail={r.examples} price={formatPence(r.pricePence)} time={formatDuration(r.durationMins)} />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid gap-1.5 text-sm text-neutral-600">
                  <p>
                    <span className="font-medium text-neutral-900">Typical duration:</span> {timeText}.
                  </p>
                  {notes.map((n) => (
                    <p key={n}>{n}</p>
                  ))}
                </div>
                {conditions.length > 0 && (
                  <div className="grid max-w-xl gap-2 rounded-xl bg-neutral-50 p-4 text-sm ring-1 ring-neutral-200/70">
                    <p className="font-medium text-neutral-900">The car&apos;s condition</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                      {conditions.map((c) => (
                        <div key={c.label} className="contents">
                          <dt className="text-neutral-700">{c.label}</dt>
                          <dd className="text-right text-neutral-600">{c.effect}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>

              {includes.length > 0 && (
                <div className="grid content-start gap-5">
                  <Label>What&apos;s included</Label>
                  <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {includes.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-neutral-800">
                        <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-wash text-brand">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  {notIncluded.length > 0 && (
                    <div className="grid gap-3 border-t pt-5">
                      <p className="text-sm font-medium text-neutral-500">Not included</p>
                      <ul className="grid gap-x-8 gap-y-2 text-sm text-neutral-600 sm:grid-cols-2">
                        {notIncluded.map((item) => (
                          <li key={item} className="flex items-start gap-2.5">
                            <X className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ before and after */}
        {pairs.length > 0 && (
          <section id="before-after" aria-labelledby="before-after-title" className="scroll-mt-4 pb-12 sm:pb-16">
            {/* One pair sits beside the words, so it's a sensible size and the
                section stays balanced; several go in a grid under them. */}
            <div
              className={cn(
                container,
                "grid gap-8",
                pairs.length === 1 && "md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-center md:gap-12",
              )}
            >
              <div className={cn("flex flex-wrap items-end justify-between gap-x-10 gap-y-3", pairs.length === 1 && "md:grid md:content-center md:gap-4")}>
                <div className="grid gap-3">
                  <Label>Before and after</Label>
                  <h2 id="before-after-title" className="text-3xl font-semibold tracking-tight text-balance">
                    The finish to expect
                  </h2>
                </div>
                <p className="max-w-sm text-pretty text-neutral-600">
                  {pairs.length === 1
                    ? `A real ${lower}. Drag across the photo to compare the car before and after.`
                    : `Real ${lower} jobs. Drag across each photo to compare the car before and after.`}
                </p>
              </div>
              <ul className={cn("grid gap-6", pairs.length > 1 && "md:grid-cols-2")}>
                {pairs.map((pair) => (
                  <li key={pair.before + pair.after}>
                    <BeforeAfterSlider before={pair.before} after={pair.after} caption={pair.caption} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ----------------------------------------------------- the write-up */}
        {paragraphs.length > 0 && (
          <section aria-labelledby="about-title" className="pb-12 sm:pb-16">
            <div className={cn(container, "grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14")}>
              <div className="grid content-start gap-3">
                <Label>About this service</Label>
                <h2 id="about-title" className="text-3xl font-semibold tracking-tight text-balance">
                  What to expect
                </h2>
              </div>
              <div className="grid gap-4 text-lg/relaxed text-pretty text-neutral-700">
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {gallery.length > 0 && (
          <section aria-labelledby="photos-title" className="border-t py-12 sm:py-16">
            <div className={cn(container, "grid gap-8")}>
              <GalleryGrid photos={gallery} businessName={tenant.name} titleId="photos-title" />
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------- extras */}
        {extras.length > 0 && (
          <section aria-labelledby="extras-title" className="border-t py-12 sm:py-16">
            <div className={cn(container, "grid gap-8")}>
              <div className="grid gap-3">
                <Label>Extras</Label>
                <h2 id="extras-title" className="text-3xl font-semibold tracking-tight text-balance">
                  Add to your {lower}
                </h2>
                <p className="text-pretty text-neutral-600">Pick any of these when you book.</p>
              </div>
              <ul className={cn("grid gap-4", extras.length > 1 && "sm:grid-cols-2", extras.length > 2 && "lg:grid-cols-3")}>
                {extras.map((x) => (
                  <li key={x.id} className="grid content-start gap-2 rounded-2xl border bg-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex items-center gap-2 font-semibold text-neutral-900">
                        <Plus className="size-4 text-brand" aria-hidden /> {x.name}
                      </p>
                      <p className="shrink-0 font-semibold tabular-nums">+{formatPence(x.price_pence)}</p>
                    </div>
                    {x.description && <p className="text-sm text-pretty text-neutral-600">{x.description}</p>}
                    {x.duration_mins > 0 && <p className="text-xs text-neutral-500">Adds about {formatDuration(x.duration_mins)}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------ steps */}
        <section aria-labelledby="steps-title" className="bg-neutral-100/70 py-12 sm:py-16">
          <div className={cn(container, "grid gap-8")}>
            <div className="grid gap-3">
              <Label>{steps.length ? "How it runs" : "How booking works"}</Label>
              <h2 id="steps-title" className="text-3xl font-semibold tracking-tight text-balance">
                Step by step
              </h2>
            </div>
            <ol className="grid gap-x-12 gap-y-6 sm:grid-cols-2">
              {(steps.length ? steps : BOOKING_STEPS.map((s) => ({ title: s.title, text: s.text }))).map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-brand text-sm font-semibold text-brand tabular-nums">
                    {i + 1}
                  </span>
                  <div className="grid gap-0.5 pt-1">
                    {s.title.trim() && <h3 className="font-semibold text-neutral-900">{s.title}</h3>}
                    {s.text.trim() && <p className="text-pretty text-neutral-600">{s.text}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------ where */}
        {(atAddress || atPremises) && (
          <section aria-labelledby="where-title" className="py-12 sm:py-16">
            <div className={cn(container, "grid gap-8")}>
              <div className="grid gap-3">
                <Label>Where</Label>
                <h2 id="where-title" className="text-3xl font-semibold tracking-tight text-balance">
                  {atAddress && atPremises ? "At your place or ours" : atAddress ? "We come to you" : "At our premises"}
                </h2>
              </div>
              <div className={cn("grid gap-4", atAddress && atPremises && "md:grid-cols-2")}>
                {atAddress && (
                  <div className="grid content-start gap-3 rounded-2xl border bg-surface p-6">
                    <p className="flex items-center gap-2 font-semibold text-neutral-900">
                      <Home className="size-5 text-brand" aria-hidden /> At your home or workplace
                    </p>
                    <p className="text-pretty text-neutral-600">
                      {needs ? `We bring everything else. We'll just need ${needs}.` : "We bring everything we need."}
                    </p>
                    {places.length > 0 && (
                      <ul className="flex flex-wrap gap-2 text-sm" aria-label="Places we cover">
                        {places.slice(0, 12).map((p) => (
                          <li key={p} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium text-neutral-700">
                            <MapPin className="size-3.5 text-brand" aria-hidden /> {p}
                          </li>
                        ))}
                      </ul>
                    )}
                    {showArea && (
                      <Link href={pageUrl(tenant, "/#area")} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-neutral-900 underline-offset-4 hover:underline">
                        Check your postcode <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    )}
                  </div>
                )}
                {atPremises && (
                  <div className="grid content-start gap-3 rounded-2xl border bg-surface p-6">
                    <p className="flex items-center gap-2 font-semibold text-neutral-900">
                      <Store className="size-5 text-brand" aria-hidden /> At our premises
                    </p>
                    <p className="text-pretty text-neutral-600">
                      {unitAddress ? (
                        <>
                          Drop your car off at <span className="font-medium text-neutral-900">{unitAddress}</span>.
                        </>
                      ) : (
                        "Drop your car off with us."
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {SHOW_REVIEWS && <Reviews reviews={reviews} testimonials={reviewSettings.show ? reviewSettings.testimonials : []} />}

        <FaqSection faqs={faqs} contactHref={enquiryUrl ?? contactHref} />

        {/* ----------------------------------------------------------- others */}
        {others.length > 0 && (
          <section aria-labelledby="more-title" className="border-t py-12 sm:py-16">
            <div className={cn(container, "grid gap-6")}>
              <h2 id="more-title" className="text-3xl font-semibold tracking-tight text-balance">
                Other services
              </h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-surface">
                {others.map((o) => (
                  <li key={o.id}>
                    <ServiceRow service={o} href={pageUrl(tenant, `/services/${o.slug}`)} withPhoto={others.some((x) => x.image_path)} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------ close */}
        <section aria-labelledby="book-title" className="bg-wash py-14 sm:py-16">
          <div className={cn(container, "flex flex-wrap items-center justify-between gap-x-10 gap-y-6")}>
            <div className="grid max-w-xl gap-2">
              <h2 id="book-title" className="text-3xl font-semibold tracking-tight text-balance">
                Ready to book a {lower}?
              </h2>
              <p className="text-pretty text-neutral-700">
                See your exact price and pick a time online in a couple of minutes.
                {enquiryUrl && (
                  <>
                    {" "}
                    Something different in mind?{" "}
                    <Link href={enquiryUrl} className="font-medium text-neutral-900 underline underline-offset-4">
                      Ask about a job
                    </Link>
                    .
                  </>
                )}
              </p>
              {policyLine && <p className="text-sm text-neutral-600">{policyLine}</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              {bookButton()}
              {callButton}
            </div>
          </div>
        </section>

        <BookBar watch={["service-top"]} href={book} priceFrom={formatPence(fromPence)} terms={policyLine} phone={callPhone} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(jsonLd) }} />
      </main>
    </SiteFrame>
  );
}

// The small label over a section or in the price card.
function Label({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-brand uppercase">
      <span aria-hidden className="h-px w-6 bg-current" />
      {children}
    </p>
  );
}

function Fact({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 font-medium text-neutral-800 ring-1 ring-black/5">
      {icon}
      {children}
    </li>
  );
}

function PriceRow({ name, detail, price, time }: { name: string; detail: string | null; price: string; time: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="font-medium text-neutral-900">{name}</p>
        {detail && <p className="text-xs text-neutral-500">{detail}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-heading text-xl font-semibold tabular-nums">{price}</p>
        <p className="text-xs text-neutral-500">{time}</p>
      </div>
    </div>
  );
}
