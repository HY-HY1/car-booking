import Link from "next/link";
import { ArrowRight, Clock, Sparkles } from "lucide-react";
import { formatDuration, formatPence, type Service } from "@leadgen/core/booking/config";

export function serviceImageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/service-images/${path}`;
}

// A service in a list, linking to its own page. Cards in a row line up
// whether or not they have a photo: without one, a panel in the brand
// colour takes its place.
export function ServiceCard({ service, href }: { service: Service; href: string }) {
  const summary = service.tagline || service.description?.trim();
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-xs transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
    >
      <div className="relative aspect-video overflow-hidden bg-brand/15 text-neutral-500">
        {service.image_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={serviceImageUrl(service.image_path)}
            alt=""
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div aria-hidden className="grid size-full place-items-center bg-linear-to-br from-white/40 to-transparent">
            <Sparkles className="size-7 opacity-70" />
          </div>
        )}
        {service.badge && (
          <span className="absolute top-3 left-3 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg shadow-sm">
            {service.badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <h3 className="text-lg leading-snug font-semibold tracking-tight">{service.name}</h3>
        {summary && <p className="line-clamp-3 text-sm text-neutral-600">{summary}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <p className="text-xs text-neutral-500">From</p>
            <p className="text-xl leading-tight font-semibold">{formatPence(service.base_price_pence)}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm text-neutral-500">
            <Clock className="size-4" aria-hidden /> {formatDuration(service.duration_mins)}
          </span>
        </div>
        <span className="mt-3 inline-flex items-center gap-1 border-t pt-3 text-sm font-medium text-neutral-900">
          View details
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
