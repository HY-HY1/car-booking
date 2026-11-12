import Link from "next/link";
import { ArrowRight, Check, Clock, Mail, MapPin, Phone } from "lucide-react";
import { getBookingConfig } from "@leadgen/core/booking/engine";
import { openingHoursLines, sameHours } from "@leadgen/core/booking/hours-text";
import { formatPhone } from "@leadgen/core/customer-fields";
import { coverObjectPosition } from "@leadgen/core/branding/cover";
import { requireRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";
import { cn } from "@/lib/cn";
import { BookingSteps, SiteFrame, container } from "@/components/site";
import { ServiceCard } from "@/components/service-card";

// The business's booking home: who they are, what they do and how to book.
// Most customers arrive from the business's own website, so this is a tidy
// landing page, not a full website. The dashboard's BookingPagePreview
// (admin settings/booking-page-preview.tsx) mirrors the top of it: keep in step.
export default async function Home() {
  const tenant = await requireRequestTenant();
  const config = await getBookingConfig(tenant.id);
  const services = (config?.services ?? []).filter((s) => s.slug);
  const settings = config?.settings;
  const quote = pageUrl(tenant, "/quote");
  const { phone, email } = tenant.contact;

  const highlights = [
    "Instant online price",
    "Choose a time that suits you",
    settings?.offers_mobile ? "We come to you" : settings?.offers_unit ? "Drop-off service" : null,
  ].filter((h): h is string => Boolean(h));

  // Hours for each way the business works, once if they're the same.
  const hours: { label: string | null; lines: ReturnType<typeof openingHoursLines> }[] = [];
  if (settings) {
    const unitHours = settings.unit_weekly_hours ?? settings.weekly_hours;
    if (settings.offers_mobile && settings.offers_unit && !sameHours(settings.weekly_hours, unitHours)) {
      hours.push({ label: "At your address", lines: openingHoursLines(settings.weekly_hours) });
      hours.push({ label: "At our premises", lines: openingHoursLines(unitHours) });
    } else if (settings.offers_mobile || settings.offers_unit) {
      hours.push({ label: null, lines: openingHoursLines(settings.offers_mobile ? settings.weekly_hours : unitHours) });
    }
  }
  const unitAddress = settings?.offers_unit ? [settings.unit_address, settings.unit_postcode].filter(Boolean).join(", ") : "";
  const showWhere = Boolean(settings?.offers_mobile || unitAddress);
  const showContact = Boolean(phone || email);
  const infoCards = [showWhere, hours.length > 0, showContact].filter(Boolean).length;

  return (
    <SiteFrame tenant={tenant}>
      <main className="flex flex-1 flex-col">
        <section className="relative isolate overflow-hidden bg-brand text-brand-fg">
          {tenant.branding.cover_url && (
            // The brand colour shows through, so the text stays readable on any photo.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.branding.cover_url}
              alt=""
              className="absolute inset-0 -z-10 size-full object-cover opacity-30"
              style={{ objectPosition: coverObjectPosition(tenant.branding.cover_position) }}
            />
          )}
          <div className={cn(container, "py-16 sm:py-24")}>
            <div className="max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{tenant.name}</h1>
              {tenant.branding.tagline && <p className="mt-4 text-lg text-pretty opacity-85 sm:text-xl">{tenant.branding.tagline}</p>}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={quote}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-medium text-accent-fg shadow-sm ring-1 ring-black/5 transition hover:opacity-90"
                >
                  Get an instant quote <ArrowRight className="size-4" aria-hidden />
                </Link>
                {services.length > 0 && (
                  <a
                    href="#services"
                    className="inline-flex h-12 items-center rounded-full border border-current/30 px-6 font-medium transition hover:bg-current/10"
                  >
                    See our services
                  </a>
                )}
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm opacity-85">
                {highlights.map((h) => (
                  <li key={h} className="inline-flex items-center gap-2">
                    <Check className="size-4" aria-hidden /> {h}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {services.length > 0 && (
          <section id="services" aria-labelledby="services-title" className="scroll-mt-4 py-14 sm:py-20">
            <div className={container}>
              <div className="mb-8 max-w-2xl">
                <h2 id="services-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Our services
                </h2>
                <p className="mt-2 text-neutral-600">
                  Prices start from the amount shown. Your exact price depends on your car&apos;s size and condition, and you&apos;ll
                  see it before you book.
                </p>
              </div>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((s) => (
                  <li key={s.id}>
                    <ServiceCard service={s} href={pageUrl(tenant, `/services/${s.slug}`)} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section aria-labelledby="how-title" className="border-y bg-white py-14 sm:py-20">
          <div className={cn(container, "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center")}>
            <div>
              <h2 id="how-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Book online in minutes
              </h2>
              <p className="mt-2 max-w-md text-neutral-600">
                No waiting for a call back. You see the price as you go, and there&apos;s nothing to pay to get a quote.
              </p>
              <Link
                href={quote}
                className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 font-medium text-brand-fg transition hover:opacity-90"
              >
                Start your booking <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <BookingSteps className="sm:grid-cols-3 sm:gap-6 sm:[&>li]:flex-col sm:[&>li]:gap-3" />
          </div>
        </section>

        {infoCards > 0 && (
          <section aria-label="Opening hours and contact" className="py-14 sm:py-20">
            <div className={cn(container, "grid gap-5", infoCards === 3 ? "md:grid-cols-3" : infoCards === 2 && "md:grid-cols-2")}>
              {showWhere && (
                <InfoCard icon={<MapPin className="size-5" />} title="Where we work">
                  {settings?.offers_mobile && (
                    <p>We come to your home or workplace. Enter your postcode when you book to check we cover your area.</p>
                  )}
                  {unitAddress && (
                    <p>
                      {settings?.offers_mobile ? "Or drop your car off at " : "Drop your car off at "}
                      <span className="font-medium text-neutral-900">{unitAddress}</span>.
                    </p>
                  )}
                </InfoCard>
              )}
              {hours.length > 0 && (
                <InfoCard icon={<Clock className="size-5" />} title="Opening hours">
                  {hours.map((set) => (
                    <div key={set.label ?? "hours"} className="grid gap-1">
                      {set.label && <p className="font-medium text-neutral-900">{set.label}</p>}
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                        {set.lines.map((line) => (
                          <div key={line.days} className="contents">
                            <dt>{line.days}</dt>
                            <dd className={cn("text-right", line.hours === "Closed" ? "text-neutral-400" : "text-neutral-900")}>{line.hours}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </InfoCard>
              )}
              {showContact && (
              <InfoCard icon={<Phone className="size-5" />} title="Get in touch">
                    <p>Questions before you book? We&apos;re happy to help.</p>
                    <ul className="grid gap-1.5">
                      {phone && (
                        <li>
                          <a href={`tel:${phone}`} className="inline-flex items-center gap-2 font-medium text-neutral-900 hover:underline">
                            <Phone className="size-4 text-neutral-400" aria-hidden /> {formatPhone(phone)}
                          </a>
                        </li>
                      )}
                      {email && (
                        <li>
                          <a href={`mailto:${email}`} className="inline-flex items-center gap-2 font-medium break-all text-neutral-900 hover:underline">
                            <Mail className="size-4 shrink-0 text-neutral-400" aria-hidden /> {email}
                          </a>
                        </li>
                      )}
                    </ul>
              </InfoCard>
              )}
            </div>
          </section>
        )}
      </main>
    </SiteFrame>
  );
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-3 rounded-2xl border bg-white p-6 text-sm text-neutral-600">
      <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
        {icon}
      </span>
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      {children}
    </div>
  );
}
