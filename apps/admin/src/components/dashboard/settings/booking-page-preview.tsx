import { ArrowRight, Check, ChevronRight, Phone, Sparkles } from "lucide-react";
import { bookingColors, readableOn } from "@leadgen/core/branding/colors";
import { formatPence } from "@leadgen/core/booking/config";
import { coverObjectPosition, type CoverPosition } from "@leadgen/core/branding/cover";
import { logoBox, type LogoSize } from "@leadgen/core/branding/logo-size";

export type PreviewService = { id: string; name: string; basePricePence: number; tagline: string | null; imageUrl: string | null };

const isColour = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

// The top of the booking page's home page as a phone shows it, with what's
// typed in the form rather than what's saved. Keep in step with the booking
// app's sites/[tenant]/page.tsx, components/site.tsx (header) and
// components/home/service-row.tsx. Always light, as that page is, whatever theme
// the dashboard is in.
export function BookingPagePreview({
  businessName,
  heroHeading,
  primary,
  accent,
  tagline,
  fonts,
  logoUrl,
  logoSize,
  coverUrl,
  coverPosition,
  phone,
  facts,
  services,
}: {
  businessName: string;
  // The hero heading as typed; blank shows the business name.
  heroHeading: string;
  primary: string;
  accent: string;
  tagline: string;
  // font-family values for headings and body text (booking-fonts.ts).
  fonts: { heading: string; body: string };
  logoUrl?: string;
  logoSize: LogoSize;
  coverUrl?: string;
  coverPosition?: CoverPosition;
  // The phone number shown at the top, if it is (Home page), as saved.
  phone: string | null;
  // The points under the buttons (About you), as saved.
  facts: string[];
  services: PreviewService[];
}) {
  // A colour still being typed isn't one yet.
  const brand = isColour(primary) ? primary : "#18181b";
  const button = isColour(accent) ? accent : "#3b82f6";
  const onBrand = readableOn(brand);
  const onButton = readableOn(button);
  // The hero's wash.
  const page = bookingColors({ primary_color: brand, accent_color: button }).light;
  // As the booking page's price list: thumbnails only when a service has a photo.
  const withPhotos = services.some((s) => s.imageUrl);
  // As globals.css draws headings on the booking page: never fake-bold.
  const heading = { fontFamily: fonts.heading, fontSynthesisWeight: "none" } as const;
  // The logo as a phone shows it, scaled to the preview (3/4 size).
  const logo = logoBox(logoSize);
  const logoHeight = Math.round(logo.phoneHeight * 0.75);

  return (
    <figure className="grid gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">Preview, updates as you type</figcaption>
      <div
        className="mx-auto max-h-[38rem] w-full max-w-80 overflow-y-auto rounded-2xl border bg-[#fafafa] text-neutral-900 shadow-sm"
        style={{ fontFamily: fonts.body }}
      >
        <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2" style={{ background: brand, color: onBrand }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="w-auto object-contain object-left"
              style={{ height: logoHeight, maxWidth: Math.round(logo.phoneMaxWidth * 0.75) }}
            />
          ) : (
            <span className="truncate text-sm font-semibold" style={heading}>
              {businessName}
            </span>
          )}
          <span className="flex shrink-0 items-center gap-2">
            {phone && <Phone className="size-3.5 opacity-90" />}
            <span className="rounded-full px-3 py-1.5 text-xs font-medium shadow-sm" style={{ background: button, color: onButton }}>
              Book now
            </span>
          </span>
        </div>
        <div className="px-4 pt-8 pb-10" style={{ background: page.wash }}>
          <p className="text-2xl font-semibold tracking-tight text-balance" style={heading}>
            {heroHeading.trim() || businessName}
          </p>
          {tagline.trim() && <p className="mt-2 text-sm opacity-85">{tagline}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <span
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium shadow-sm"
              style={{ background: button, color: onButton }}
            >
              Check prices and book <ArrowRight className="size-3.5" />
            </span>
            {phone && (
              <span className="inline-flex h-10 items-center gap-1.5 rounded-full border border-current/30 px-4 text-sm font-medium">
                <Phone className="size-3.5" /> Call
              </span>
            )}
          </div>
          {facts.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs opacity-90">
              {facts.map((f) => (
                <li key={f} className="inline-flex items-center gap-1">
                  <Check className="size-3.5" strokeWidth={2.5} /> {f}
                </li>
              ))}
            </ul>
          )}
          {/* The cover photo: beside the words on a big screen, under them on a phone. */}
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="mt-7 aspect-4/3 w-full rounded-xl object-cover shadow-lg"
              style={{ objectPosition: coverObjectPosition(coverPosition) }}
            />
          )}
          {/* The booking card under the words. On the live page it also
              shows the week's free days, which a preview can't know. */}
          {services.length > 0 && (
            <div className="mt-7 grid gap-3 rounded-xl bg-white p-4 text-neutral-900 shadow-lg">
              <p className="text-xs font-semibold">Prices from</p>
              <ul className="grid gap-2">
                {services.slice(0, 4).map((s) => (
                  <li key={s.id} className="flex items-baseline gap-2 text-xs">
                    <span className="truncate text-neutral-700">{s.name}</span>
                    <span className="min-w-3 flex-1 border-b border-dotted border-neutral-300" />
                    <span className="font-semibold">{formatPence(s.basePricePence)}</span>
                  </li>
                ))}
              </ul>
              <span
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-medium"
                style={{ background: button, color: onButton }}
              >
                Check prices and book <ArrowRight className="size-3.5" />
              </span>
            </div>
          )}
        </div>

        {services.length > 0 && (
          <section className="px-4 py-8">
            <p className="mb-4 text-xl font-semibold tracking-tight" style={heading}>
              Services and prices
            </p>
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
              {services.map((s) => (
                <li key={s.id} className="flex gap-3 p-3">
                  {withPhotos &&
                    (s.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.imageUrl} alt="" loading="lazy" className="size-14 shrink-0 rounded-md object-cover" />
                    ) : (
                      <div
                        className="grid size-14 shrink-0 place-items-center rounded-md"
                        style={{ background: `color-mix(in srgb, ${brand} 10%, white)`, color: brand }}
                      >
                        <Sparkles className="size-5 opacity-50" />
                      </div>
                    ))}
                  <div className="grid min-w-0 flex-1 content-start gap-0.5">
                    <p className="truncate text-sm font-semibold tracking-tight" style={heading}>
                      {s.name}
                    </p>
                    {s.tagline && <p className="line-clamp-2 text-xs text-neutral-600">{s.tagline}</p>}
                    <p className="mt-1 text-xs">
                      <span className="text-neutral-500">From </span>
                      <span className="font-semibold">{formatPence(s.basePricePence)}</span>
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 self-center text-neutral-300" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </figure>
  );
}
