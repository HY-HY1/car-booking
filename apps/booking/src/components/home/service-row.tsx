import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { formatDuration, formatPence, type Service } from "@leadgen/core/booking/config";
import { serviceImageUrl } from "@/components/service-card";

// A service on the home page, as a line of a price list: its name, what it
// is, what's included and its starting price, all as the business entered
// them under Pricing. The whole line links to the service's own page. When
// any service has a photo, every line gets a thumbnail (the brand colour
// standing in where there's none) so the list lines up.

const MAX_INCLUDES = 5;

export function ServiceRow({ service, href, withPhoto = false }: { service: Service; href: string; withPhoto?: boolean }) {
  const includes = (service.includes ?? []).map((i) => i.trim()).filter(Boolean);
  const shown = includes.slice(0, MAX_INCLUDES);
  const more = includes.length - shown.length;
  const summary = service.tagline?.trim() || (!shown.length ? service.description?.trim() : "");
  const price = formatPence(service.base_price_pence);
  const duration = `about ${formatDuration(service.duration_mins)}`;

  return (
    <Link href={href} className="group flex gap-4 p-5 transition hover:bg-neutral-50 sm:gap-6 sm:p-6">
      {withPhoto && (
        <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-brand/10 text-brand sm:h-24 sm:w-32">
          {service.image_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={serviceImageUrl(service.image_path)} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <div aria-hidden className="grid size-full place-items-center">
              <Sparkles className="size-6 opacity-50" />
            </div>
          )}
        </div>
      )}

      <div className="grid min-w-0 flex-1 content-start gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="text-lg leading-snug font-semibold tracking-tight">{service.name}</h3>
          {service.badge && (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">{service.badge}</span>
          )}
        </div>
        {summary && <p className="line-clamp-2 text-sm text-pretty text-neutral-600">{summary}</p>}
        {shown.length > 0 && (
          <p className="text-sm text-pretty text-neutral-500">
            <span className="font-medium text-neutral-700">Includes</span> {shown.join(" · ")}
            {more > 0 && ` and ${more} more`}
          </p>
        )}
        {/* On a phone the price goes under the words. */}
        <p className="mt-1 text-sm sm:hidden">
          <span className="text-neutral-500">From </span>
          <span className="font-semibold text-neutral-900 tabular-nums">{price}</span>
          <span className="text-neutral-500"> · {duration}</span>
        </p>
      </div>

      <div className="hidden shrink-0 content-start justify-items-end text-right sm:grid">
        <span className="text-xs text-neutral-500">from</span>
        <span className="text-2xl leading-tight font-semibold tracking-tight tabular-nums">{price}</span>
        <span className="mt-0.5 text-xs text-neutral-500">{duration}</span>
      </div>
      <ChevronRight
        aria-hidden
        className="size-5 shrink-0 self-center text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-900"
      />
    </Link>
  );
}
