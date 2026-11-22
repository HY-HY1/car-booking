import Link from "next/link";
import { ArrowRight, Check, Clock } from "lucide-react";
import { formatDuration, formatPence, type Service } from "@leadgen/core/booking/config";

// A service on the home page, as a price card: its label, name, starting
// price and what's included, all as the business entered them under Pricing.
// The whole card links to the service's own page.

const MAX_INCLUDES = 5;

export function ServiceTile({ service, href }: { service: Service; href: string }) {
  const includes = (service.includes ?? []).map((i) => i.trim()).filter(Boolean);
  const shown = includes.slice(0, MAX_INCLUDES);
  const more = includes.length - shown.length;
  const summary = service.tagline?.trim() || (!shown.length ? service.description?.trim() : "");

  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-2xl border bg-surface p-6 shadow-xs transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
    >
      {service.badge && <p className="mb-2 text-xs font-medium tracking-[0.12em] text-neutral-500 uppercase">{service.badge}</p>}
      <h3 className="text-xl leading-snug font-semibold tracking-tight">{service.name}</h3>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm text-neutral-500">From</span>
        <span className="text-3xl font-semibold tracking-tight text-brand tabular-nums">{formatPence(service.base_price_pence)}</span>
      </p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-neutral-500">
        <Clock className="size-3.5" aria-hidden /> About {formatDuration(service.duration_mins)}
      </p>
      {summary && <p className="mt-4 line-clamp-3 text-sm text-neutral-600">{summary}</p>}
      {shown.length > 0 && (
        <ul className="mt-4 grid gap-2 border-t pt-4 text-sm text-neutral-700">
          {shown.map((item) => (
            <li key={item} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              {item}
            </li>
          ))}
          {more > 0 && <li className="pl-6.5 text-neutral-500">and {more} more</li>}
        </ul>
      )}
      <span className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-medium text-neutral-900">
        See what&apos;s included
        <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
