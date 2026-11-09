import { readableOn } from "@leadgen/core/branding/colors";
import { formatPence } from "@leadgen/core/booking/config";
import { formatPhone } from "@leadgen/core/customer-fields";

export type PreviewService = { id: string; name: string; basePricePence: number; tagline: string | null; imageUrl: string | null };

const isColour = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

// The booking page's home page as a phone shows it, with what's typed in the
// form rather than what's saved. Keep in step with the booking app's
// sites/[tenant]/page.tsx. Always light, as that page is, whatever theme the
// dashboard is in.
export function BookingPagePreview({
  businessName,
  primary,
  accent,
  tagline,
  logoUrl,
  coverUrl,
  contact,
  services,
}: {
  businessName: string;
  primary: string;
  accent: string;
  tagline: string;
  logoUrl?: string;
  coverUrl?: string;
  contact: { email: string | null; phone: string | null };
  services: PreviewService[];
}) {
  // A colour still being typed isn't one yet.
  const brand = isColour(primary) ? primary : "#18181b";
  const button = isColour(accent) ? accent : "#3b82f6";

  return (
    <figure className="grid gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">Preview, updates as you type</figcaption>
      <div className="mx-auto max-h-[38rem] w-full max-w-80 overflow-y-auto rounded-2xl border bg-white text-neutral-900 shadow-sm">
        <section className="relative overflow-hidden px-4 py-12" style={{ background: brand, color: readableOn(brand) }}>
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover opacity-30" />
          )}
          <div className="relative text-center">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="mx-auto mb-5 h-12 w-auto" />
            )}
            <p className="text-2xl font-semibold tracking-tight">{businessName}</p>
            {tagline.trim() && <p className="mt-2 opacity-80">{tagline}</p>}
            <span
              className="mt-6 inline-flex h-11 items-center rounded-full px-5 text-sm font-medium shadow-sm"
              style={{ background: button, color: readableOn(button) }}
            >
              Get an instant quote
            </span>
            {(contact.phone || contact.email) && (
              <p className="mt-5 text-xs break-words opacity-80">
                {[contact.phone && formatPhone(contact.phone), contact.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </section>

        {services.length > 0 && (
          <section className="px-4 py-8">
            <p className="mb-4 text-xl font-semibold tracking-tight">Our services</p>
            <ul className="grid gap-3">
              {services.map((s) => (
                <li key={s.id} className="overflow-hidden rounded-2xl border bg-white">
                  {s.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt="" loading="lazy" className="aspect-[16/8] w-full object-cover" />
                  )}
                  <div className="p-3">
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{s.name}</span>
                      <span className="shrink-0 text-sm font-medium">from {formatPence(s.basePricePence)}</span>
                    </p>
                    {s.tagline && <p className="mt-1 text-sm text-neutral-600">{s.tagline}</p>}
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
