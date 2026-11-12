import { ArrowRight, Sparkles } from "lucide-react";
import { readableOn } from "@leadgen/core/branding/colors";
import { formatPence } from "@leadgen/core/booking/config";
import { coverObjectPosition, type CoverPosition } from "@leadgen/core/branding/cover";

export type PreviewService = { id: string; name: string; basePricePence: number; tagline: string | null; imageUrl: string | null };

const isColour = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

// The top of the booking page's home page as a phone shows it, with what's
// typed in the form rather than what's saved. Keep in step with the booking
// app's sites/[tenant]/page.tsx, components/site.tsx (header) and
// components/service-card.tsx. Always light, as that page is, whatever theme
// the dashboard is in.
export function BookingPagePreview({
  businessName,
  primary,
  accent,
  tagline,
  logoUrl,
  coverUrl,
  coverPosition,
  services,
}: {
  businessName: string;
  primary: string;
  accent: string;
  tagline: string;
  logoUrl?: string;
  coverUrl?: string;
  coverPosition?: CoverPosition;
  // The booking page shows contact details lower down and in the footer,
  // below what this preview covers.
  contact: { email: string | null; phone: string | null };
  services: PreviewService[];
}) {
  // A colour still being typed isn't one yet.
  const brand = isColour(primary) ? primary : "#18181b";
  const button = isColour(accent) ? accent : "#3b82f6";
  const onBrand = readableOn(brand);
  const onButton = readableOn(button);

  return (
    <figure className="grid gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">Preview, updates as you type</figcaption>
      <div className="mx-auto max-h-[38rem] w-full max-w-80 overflow-y-auto rounded-2xl border bg-[#fafafa] text-neutral-900 shadow-sm">
        <div style={{ background: brand, color: onBrand }}>
          <div className="flex h-12 items-center justify-between gap-3 px-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-6 w-auto max-w-32 object-contain object-left" />
            ) : (
              <span className="truncate text-sm font-semibold">{businessName}</span>
            )}
            <span className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm" style={{ background: button, color: onButton }}>
              Book now
            </span>
          </div>
          <div className="relative isolate overflow-hidden px-4 pt-8 pb-10">
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt=""
                className="absolute inset-0 -z-10 size-full object-cover opacity-30"
                style={{ objectPosition: coverObjectPosition(coverPosition) }}
              />
            )}
            <p className="text-2xl font-semibold tracking-tight">{businessName}</p>
            {tagline.trim() && <p className="mt-2 text-sm opacity-85">{tagline}</p>}
            <span
              className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium shadow-sm"
              style={{ background: button, color: onButton }}
            >
              Get an instant quote <ArrowRight className="size-3.5" />
            </span>
          </div>
        </div>

        {services.length > 0 && (
          <section className="px-4 py-8">
            <p className="mb-4 text-xl font-semibold tracking-tight">Our services</p>
            <ul className="grid gap-3">
              {services.map((s) => (
                <li key={s.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                  ) : (
                    <div
                      className="grid aspect-video place-items-center text-neutral-500"
                      style={{ background: `color-mix(in srgb, ${brand} 15%, white)` }}
                    >
                      <Sparkles className="size-6 opacity-70" />
                    </div>
                  )}
                  <div className="p-4">
                    <p className="font-semibold tracking-tight">{s.name}</p>
                    {s.tagline && <p className="mt-1 text-sm text-neutral-600">{s.tagline}</p>}
                    <p className="mt-3 text-xs text-neutral-500">From</p>
                    <p className="text-lg leading-tight font-semibold">{formatPence(s.basePricePence)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </figure>
  );
}
