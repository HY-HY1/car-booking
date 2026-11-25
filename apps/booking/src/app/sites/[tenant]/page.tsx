import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Mail, MapPin, Phone } from "lucide-react";
import { formatPence, type Service } from "@leadgen/core/booking/config";
import { siteNeedsOf } from "@leadgen/core/booking/site-needs";
import { formatPhone } from "@leadgen/core/customer-fields";
import { aboutParagraphs } from "@leadgen/core/branding/about";
import { jobsCountText, policyLineText } from "@leadgen/core/branding/extras";
import { countCompletedJobs } from "@leadgen/core/booking/completed";
import { policyOf } from "@leadgen/core/settings/policy";
import { jsonLdText, localBusinessJsonLd } from "@leadgen/core/seo/local-business";
import { coverObjectPosition } from "@leadgen/core/branding/cover";
import { loadPublicReviews } from "@leadgen/core/reviews/sync";
import { loadBookingConfig } from "@/lib/booking-config";
import { pageMetadata } from "@/lib/seo";
import { requireRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";
import { cn } from "@/lib/cn";
import { SiteFrame, container, shownPhone } from "@/components/site";
import { AboutSection } from "@/components/home/about";
import { BookBar } from "@/components/home/book-bar";
import { Availability, AvailabilitySkeleton } from "@/components/home/availability";
import { Coverage } from "@/components/home/coverage";
import { FaqSection } from "@/components/home/faqs";
import { GalleryGrid } from "@/components/home/gallery";
import { VideoShowcase, type ShowcaseVideo } from "@/components/home/videos";
import { DEFAULT_VIDEO_HEADING, DEFAULT_VIDEO_TEXT, VIDEO_PROVIDERS, embedUrl, socialButtonLabel, videoFileUrl, videoThumbnail } from "@leadgen/core/branding/videos";
import { RatingLine, Reviews } from "@/components/home/reviews";
import { ServiceRow } from "@/components/home/service-row";
import { SiteNeedsNotice } from "@/components/home/site-needs";

// The business's booking home: who they are, what they do and how to book.
// For many businesses this is their only web page, so it should read as
// theirs (their facts, their photos, their story) rather than as a booking
// system's; the booking itself is one button away throughout. The
// dashboard's BookingPagePreview (admin settings/booking-page-preview.tsx)
// mirrors the top of it: keep in step.
export async function generateMetadata() {
  return pageMetadata(await requireRequestTenant(), "/");
}

export default async function Home() {
  const tenant = await requireRequestTenant();
  // Reviews, if the owner shows them (Settings → Booking page → Reviews on
  // your page): the Google ones they picked, or the newest good ones.
  const reviewSettings = tenant.branding.reviews;
  const extras = tenant.branding.extras;
  const [config, reviews, completed] = await Promise.all([
    // Shared with the footer, which shows the opening hours.
    loadBookingConfig(tenant.id),
    // The page never waits on, or fails for, the reviews.
    reviewSettings.show
      ? loadPublicReviews(tenant.id, reviewSettings.pinned).catch((error) => {
          console.error("Couldn't load the Google reviews", error);
          return null;
        })
      : null,
    // Only counted when it's shown; never fails the page.
    extras.jobs_count.show
      ? countCompletedJobs(tenant.id).catch((error) => {
          console.error("Couldn't count the completed jobs", error);
          return null;
        })
      : null,
  ]);
  const services = (config?.services ?? []).filter((s) => s.slug);
  const settings = config?.settings;
  const quote = pageUrl(tenant, "/quote");
  const { phone, email } = tenant.contact;
  const callPhone = shownPhone(tenant);
  const { about, gallery } = tenant.branding;
  const ownerName = about.name?.trim();

  // Under the buttons: what the business says about itself (About you), or
  // with nothing written there, how it works.
  const facts = about.facts.length
    ? about.facts
    : [settings?.offers_mobile ? "We come to you" : null, settings?.offers_unit ? (settings.offers_mobile ? "Or drop your car off" : "Drop-off service") : null].filter(
        (f): f is string => Boolean(f),
      );

  // Settings → Booking page → Trust and enquiries.
  const jobsText = completed === null ? null : jobsCountText(extras, completed);
  const policyLine = policyLineText(extras, settings?.deposit, policyOf(settings?.cancellation_policy));
  const enquiryUrl = extras.enquiries.show ? pageUrl(tenant, "/contact") : null;

  const jsonLd = localBusinessJsonLd({
    name: tenant.name,
    url: pageUrl(tenant, "/", { absolute: true }),
    description: tenant.branding.tagline,
    telephone: phone,
    email,
    logo: tenant.branding.logo_url,
    image: tenant.branding.cover_url,
    address: settings?.offers_unit ? { street: settings.unit_address, postcode: settings.unit_postcode } : null,
    areaServed: settings?.offers_mobile ? tenant.branding.home.places : [],
    hours: settings ? (settings.offers_mobile ? settings.weekly_hours : (settings.unit_weekly_hours ?? settings.weekly_hours)) : null,
    prices: services.map((s) => s.base_price_pence),
    website: tenant.branding.website_url,
  });

  // Videos of their work (Settings → Booking page → Videos of your work),
  // ready for the player: an upload's file, or a link's player and still.
  const videoIntro = tenant.branding.video_intro;
  const videos: ShowcaseVideo[] = tenant.branding.videos.map((v, i) =>
    v.kind === "upload"
      ? { key: `${i}-${v.path}`, kind: "upload", src: videoFileUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, v.path), vertical: v.vertical, caption: v.caption }
      : {
          key: `${i}-${v.provider}-${v.id}`,
          kind: "link",
          embed: embedUrl(v),
          thumbnail: videoThumbnail(v),
          provider: VIDEO_PROVIDERS[v.provider],
          vertical: v.vertical,
          caption: v.caption,
        },
  );

  const unitAddress = settings?.offers_unit ? [settings.unit_address, settings.unit_postcode].filter(Boolean).join(", ") : "";

  // The extra sections, as the owner set them (Settings → Booking page).
  const home = tenant.branding.home;
  const bookable = services.filter((s) => s.location_types.some((l) => (l === "mobile" ? settings?.offers_mobile : settings?.offers_unit)));
  const availabilityMins =
    home.show_availability && config && bookable.length > 0
      ? (home.availability_mins ?? Math.min(...bookable.map((s) => s.duration_mins)))
      : null;
  // An area with no limit ({}) has nothing to show or check.
  const showArea = Boolean(home.show_area && settings?.offers_mobile && Object.keys(settings.service_area).length > 0);
  const contactHref = phone ? `tel:${phone}` : email ? `mailto:${email}` : null;

  // With the coverage section showing, "Where we work" only needs the shop.
  const showWhere = Boolean((settings?.offers_mobile && !showArea) || unitAddress);
  const showContact = Boolean(phone || email);
  // The opening hours are in the footer, on every page.
  const infoColumns = [showWhere, showContact].filter(Boolean).length;
  // The sections above it end in their own space, apart from the shaded
  // reviews band, which it needs room below.
  const testimonials = reviewSettings.show ? reviewSettings.testimonials : [];
  const afterReviews = Boolean(reviews?.featured.length || testimonials.length) && !showArea && !aboutParagraphs(about.text).length;
  const showCard = services.length > 0 || availabilityMins !== null;
  const withPhotos = services.some((s) => s.image_path);
  const cover = tenant.branding.cover_url;
  // Beside the words, or as a bar across the bottom of the hero when the
  // cover photo takes the right-hand side.
  const bookCard = (wide: boolean) =>
    showCard && config ? (
      <BookCard
        wide={wide}
        services={services}
        quoteUrl={quote}
        terms={policyLine}
        availability={
          availabilityMins !== null ? (
            <Suspense fallback={<AvailabilitySkeleton />}>
              <Availability tenantId={tenant.id} config={config} durationMins={availabilityMins} />
            </Suspense>
          ) : null
        }
      />
    ) : null;

  const bookButton = (label: string) => (
    <Link
      href={quote}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-medium whitespace-nowrap text-accent-fg shadow-sm ring-1 ring-black/5 transition hover:opacity-90"
    >
      {label} <ArrowRight className="size-4 shrink-0" aria-hidden />
    </Link>
  );
  const callButton = callPhone ? (
    <a
      href={`tel:${callPhone}`}
      className="inline-flex h-12 items-center gap-2 rounded-full border border-current/30 px-6 font-medium transition hover:bg-current/10"
    >
      <Phone className="size-4" aria-hidden /> Call {formatPhone(callPhone)}
    </a>
  ) : null;

  return (
    <SiteFrame tenant={tenant} bottomBar={showCard}>
      <main className="flex flex-1 flex-col">
        <section id="home-top" className="bg-wash">
          <div
            className={cn(
              container,
              "grid gap-10 py-12 sm:py-16 lg:py-20",
              // The booking card overlaps the bottom of the hero when the photo takes the right.
              cover && showCard && "pb-28 sm:pb-32 lg:pb-36",
              (cover || showCard) && "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12",
            )}
          >
            <div className="grid content-start gap-6">
              <div className="grid gap-4">
                <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:leading-[1.08]">
                  {tenant.branding.hero_heading?.trim() || tenant.name}
                </h1>
                {tenant.branding.tagline && <p className="max-w-xl text-lg text-pretty opacity-85 sm:text-xl">{tenant.branding.tagline}</p>}
              </div>
              <div className="flex flex-wrap gap-3">
                {bookButton("Check prices and book")}
                {callButton ??
                  (services.length > 0 && (
                    <a
                      href="#services"
                      className="inline-flex h-12 items-center rounded-full border border-current/30 px-6 font-medium transition hover:bg-current/10"
                    >
                      See our services
                    </a>
                  ))}
              </div>
              {(reviews || jobsText || facts.length > 0) && (
                <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm opacity-90">
                  {reviews && (
                    <li>
                      <RatingLine reviews={reviews} />
                    </li>
                  )}
                  {jobsText && (
                    <li className="inline-flex items-center gap-1.5 font-medium">
                      <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                      {jobsText}
                    </li>
                  )}
                  {facts.map((f) => (
                    <li key={f} className="inline-flex items-center gap-1.5">
                      <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* The cover photo on the right; with none, the booking card has the space. */}
            {cover ? (
              <div className="relative aspect-4/3 overflow-hidden rounded-2xl shadow-lg ring-1 shadow-black/20 ring-black/10 lg:aspect-auto lg:h-full lg:min-h-96">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  style={{ objectPosition: coverObjectPosition(tenant.branding.cover_position) }}
                />
              </div>
            ) : (
              bookCard(false)
            )}
          </div>
        </section>

        {cover && showCard && (
          <div id="home-card" className={cn(container, "relative z-10 -mt-20 sm:-mt-24")}>
            {bookCard(true)}
          </div>
        )}

        {services.length > 0 && (
          <section id="services" aria-labelledby="services-title" className="scroll-mt-4 py-14 sm:py-20">
            <div className={container}>
              <div className="mb-8 grid max-w-2xl gap-3">
                <h2 id="services-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  Services and prices
                </h2>
                <p className="text-pretty text-neutral-600">
                  Prices start from the amount shown. Your exact price depends on your car&apos;s size and condition, and
                  you&apos;ll see it before you book.
                  {enquiryUrl && (
                    <>
                      {" "}
                      Need something not listed?{" "}
                      <Link href={enquiryUrl} className="font-medium text-neutral-900 underline underline-offset-4">
                        Ask about a job
                      </Link>
                      .
                    </>
                  )}
                </p>
              </div>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-surface">
                {services.map((s) => (
                  <li key={s.id}>
                    <ServiceRow service={s} href={pageUrl(tenant, `/services/${s.slug}`)} withPhoto={withPhotos} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* After the services, so customers see what is on offer before what
            the job needs. The booking form checks it again. */}
        {settings?.offers_mobile && (
          <SiteNeedsNotice
            needs={siteNeedsOf(settings.site_requirements)}
            unitAddress={unitAddress}
            className={services.length > 0 ? "pb-14 sm:pb-20" : "py-14 sm:py-20"}
          />
        )}

        {gallery.length > 0 && (
          <section id="work" aria-labelledby="work-title" className="scroll-mt-4 border-t py-14 sm:py-20">
            <div className={cn(container, "grid gap-8")}>
              <GalleryGrid photos={gallery} businessName={tenant.name} titleId="work-title" />
            </div>
          </section>
        )}

        {/* Only once there's a video: the words and a link to their social
            media on the left, the videos on the right (stacked on a phone). */}
        {videos.length > 0 && (
          <section id="videos" aria-labelledby="videos-title" className="scroll-mt-4 border-t py-14 sm:py-20">
            <div className={cn(container, "grid gap-10 md:grid-cols-[minmax(0,26rem)_auto] md:items-center md:justify-center md:gap-10 lg:gap-12")}>
              <div className="grid content-center gap-4">
                <h2 id="videos-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  {videoIntro.heading ?? DEFAULT_VIDEO_HEADING}
                </h2>
                <p className="max-w-md text-lg text-pretty text-neutral-700">{videoIntro.text ?? DEFAULT_VIDEO_TEXT}</p>
                {videos.length > 1 && <p className="text-sm text-neutral-500">Use the arrows to watch the next one.</p>}
                {videoIntro.social_url && (
                  <a
                    href={videoIntro.social_url}
                    target="_blank"
                    rel="noopener"
                    className="mt-2 inline-flex h-12 w-fit items-center gap-2 rounded-full border border-neutral-300 bg-surface px-6 font-medium text-neutral-900 transition hover:border-neutral-500"
                  >
                    {socialButtonLabel(videoIntro.social_url)} <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                )}
              </div>
              <VideoShowcase videos={videos} businessName={tenant.name} />
            </div>
          </section>
        )}

        <Reviews reviews={reviews} testimonials={testimonials} />

        <AboutSection about={about} businessName={tenant.name} />

        {showArea && settings && (
          <Coverage businessName={tenant.name} settings={settings} places={home.places} quoteUrl={quote} contactHref={contactHref} />
        )}

        {infoColumns > 0 && (
          <section aria-label="Where we work and contact" className={cn("pb-14 sm:pb-20", afterReviews && "pt-14 sm:pt-20")}>
            <div className={container}>
              <div
                className={cn(
                  "grid divide-y overflow-hidden rounded-2xl border bg-surface md:divide-x md:divide-y-0",
                  infoColumns === 2 && "md:grid-cols-2",
                )}
              >
                {showWhere && (
                  <InfoColumn icon={<MapPin className="size-4" />} title="Where we work">
                    {settings?.offers_mobile && !showArea && (
                      <p>We come to your home or workplace. Enter your postcode when you book to check we cover your area.</p>
                    )}
                    {unitAddress && (
                      <p>
                        {settings?.offers_mobile ? (showArea ? "We come to you, or you can drop your car off at " : "Or drop your car off at ") : "Drop your car off at "}
                        <span className="font-medium text-neutral-900">{unitAddress}</span>.
                      </p>
                    )}
                  </InfoColumn>
                )}
                {showContact && (
                  <InfoColumn icon={<Phone className="size-4" />} title="Get in touch">
                    <p>
                      Questions before you book? {ownerName ? `${ownerName} is` : "We're"} happy to help.
                      {enquiryUrl && (
                        <>
                          {" "}
                          <Link href={enquiryUrl} className="font-medium text-neutral-900 underline underline-offset-4">
                            Send an enquiry
                          </Link>
                          .
                        </>
                      )}
                    </p>
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
                  </InfoColumn>
                )}
              </div>
            </div>
          </section>
        )}

        <FaqSection faqs={tenant.branding.faqs} contactHref={enquiryUrl ?? contactHref} />

        {/* The last word: book, or ring. */}
        <section aria-labelledby="book-title" className="bg-wash py-14 sm:py-16">
          <div className={cn(container, "flex flex-wrap items-center justify-between gap-x-10 gap-y-6")}>
            <div className="grid max-w-xl gap-2">
              <h2 id="book-title" className="text-3xl font-semibold tracking-tight text-balance">
                Ready to book?
              </h2>
              <p className="text-pretty opacity-85">
                {callPhone
                  ? `Get your price and pick a time online in a couple of minutes, or call ${ownerName ?? "us"} on ${formatPhone(callPhone)}.`
                  : "Get your price and pick a time online in a couple of minutes. There's nothing to pay for a quote."}
              </p>
              {policyLine && <p className="text-sm opacity-75">{policyLine}</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              {bookButton("Check prices and book")}
              {callButton}
            </div>
          </div>
        </section>

        {showCard && (
          <BookBar
            watch={["home-top", "home-card"]}
            href={quote}
            priceFrom={services.length ? formatPence(Math.min(...services.map((s) => s.base_price_pence))) : null}
            terms={policyLine}
            phone={callPhone}
          />
        )}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(jsonLd) }} />
      </main>
    </SiteFrame>
  );
}

// Beside the heading: the week's availability (when the owner shows it) and
// what the services start from, with the way into the booking form.
const CARD_SERVICES = 4;

function BookCard({
  services,
  quoteUrl,
  terms,
  availability,
  wide,
}: {
  services: Service[];
  quoteUrl: string;
  // The deposit and cancellation line, when it's shown.
  terms: string | null;
  availability: React.ReactNode;
  // Side by side across the page on big screens, rather than stacked.
  wide: boolean;
}) {
  const shown = services.slice(0, CARD_SERVICES);
  const more = services.length - shown.length;
  // The rule between parts: above each on phones, beside each when wide.
  // None before the first, as the week may not show or be worked out.
  const divided = cn("border-t pt-6 first:border-t-0 first:pt-0", wide && "lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 lg:first:border-l-0 lg:first:pl-0");
  return (
    <div
      className={cn(
        "grid gap-6 rounded-2xl bg-surface p-6 text-(--ink) shadow-lg ring-1 shadow-black/15 ring-black/5 sm:p-7",
        wide && "lg:grid-flow-col lg:auto-cols-fr lg:items-center lg:gap-8 lg:p-8",
      )}
    >
      {availability}
      {shown.length > 0 && (
        <div className={cn("grid gap-3", divided)}>
          <p className="text-sm font-semibold text-neutral-900">Prices from</p>
          <ul className="grid gap-2.5">
            {shown.map((s) => (
              <li key={s.id} className="flex items-baseline gap-3 text-sm">
                <span className="truncate text-neutral-700">{s.name}</span>
                <span aria-hidden className="min-w-4 flex-1 translate-y-[-0.2em] border-b border-dotted border-neutral-300" />
                <span className="font-semibold text-neutral-900 tabular-nums">{formatPence(s.base_price_pence)}</span>
              </li>
            ))}
          </ul>
          {more > 0 && (
            <a href="#services" className="w-fit text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline">
              and {more} more {more === 1 ? "service" : "services"}
            </a>
          )}
        </div>
      )}
      <div className={cn("grid gap-2", wide && divided)}>
        <Link
          href={quoteUrl}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 font-medium whitespace-nowrap text-accent-fg shadow-sm ring-1 ring-black/5 transition hover:opacity-90"
        >
          Check prices and book <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
        <p className="text-center text-xs text-pretty text-neutral-500">{terms ?? "Nothing to pay for a quote."}</p>
      </div>
    </div>
  );
}

function InfoColumn({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-3 p-6 text-sm text-neutral-600 sm:p-8">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-neutral-400">
          {icon}
        </span>
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
