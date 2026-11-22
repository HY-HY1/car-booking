import Link from "next/link";
import { ArrowRight, CalendarCheck } from "lucide-react";
import { nextAvailability, type BookingConfig } from "@leadgen/core/booking/engine";
import { dayLabel, stripDay, type DayStatus } from "@leadgen/core/booking/next-available";
import { cn } from "@/lib/cn";
import { container } from "@/components/site";
import { Eyebrow } from "./eyebrow";

// Under the heading: the next day with time free and how the week looks, so
// customers see the diary is real and filling up. Worked out for the
// business's shortest job (or the length they chose); the booking form checks
// the actual job. If it can't be worked out, the section just isn't shown.

const STATUS: Record<DayStatus, { text: string; dot: string }> = {
  open: { text: "Free", dot: "bg-emerald-500" },
  full: { text: "Booked up", dot: "bg-neutral-400" },
  closed: { text: "Closed", dot: "border border-neutral-300 bg-transparent" },
};

export async function Availability({
  tenantId,
  config,
  durationMins,
  quoteUrl,
}: {
  tenantId: string;
  config: BookingConfig;
  durationMins: number;
  quoteUrl: string;
}) {
  let result;
  try {
    result = await nextAvailability(tenantId, config, durationMins);
  } catch (error) {
    console.error("Couldn't work out the next free day", error);
    return null;
  }
  if (!result) return null;
  const { today, next, days } = result;
  const booked = days.filter((d) => d.status === "full").length;
  const tomorrow = days[1]?.date;

  return (
    <section aria-labelledby="availability-title" className="border-b bg-surface">
      <div className={cn(container, "grid gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-center lg:gap-10")}>
        <div className="grid gap-3">
          <Eyebrow>Availability</Eyebrow>
          <h2 id="availability-title" className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            {next ? (
              <>
                <span className="relative flex size-3 shrink-0" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
                </span>
                {next === today ? "Available today" : `Next available ${dayLabel(next, today)}`}
              </>
            ) : (
              "Fully booked for now"
            )}
          </h2>
          <p className="text-sm text-neutral-600">
            {next
              ? booked >= 2
                ? `${booked} of the next ${days.length} days are already booked up. Grab a time while there's space.`
                : "Pick a time that suits you and book in a couple of minutes."
              : "Every day we take bookings is full. Get in touch and we'll let you know when something comes up."}
          </p>
          {next && (
            <Link
              href={quoteUrl}
              className="mt-1 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-fg transition hover:opacity-90"
            >
              <CalendarCheck className="size-4" aria-hidden />
              {next === today || next === tomorrow ? `Book for ${dayLabel(next, today).toLowerCase()}` : `Book for ${dayLabel(next, today)}`}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>

        <div className="grid gap-3">
          <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {days.map((d) => {
              const label = stripDay(d.date);
              return (
                <li
                  key={d.date}
                  className={cn(
                    "grid justify-items-center gap-1 rounded-xl border px-1 py-2.5 text-center sm:py-3",
                    d.status === "open" ? "border-emerald-600/30 bg-emerald-50" : d.status === "full" ? "bg-neutral-50" : "border-dashed opacity-70",
                  )}
                >
                  <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase sm:text-xs">
                    {d.date === today ? "Today" : label.weekday}
                  </span>
                  <span className={cn("text-lg leading-none font-semibold tabular-nums sm:text-xl", d.status === "full" && "text-neutral-400 line-through decoration-1")}>
                    {label.day}
                  </span>
                  <span aria-hidden className={cn("mt-0.5 size-2 rounded-full", STATUS[d.status].dot)} />
                  <span className="sr-only">
                    {label.full}: {STATUS[d.status].text}
                  </span>
                </li>
              );
            })}
          </ol>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500" aria-hidden>
            {(Object.keys(STATUS) as DayStatus[]).map((s) => (
              <li key={s} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", STATUS[s].dot)} /> {STATUS[s].text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function AvailabilitySkeleton() {
  return (
    <section aria-hidden className="border-b bg-surface">
      <div className={cn(container, "grid gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-center lg:gap-10")}>
        <div className="grid gap-3">
          <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
          <div className="h-8 w-64 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-100" />
          ))}
        </div>
      </div>
    </section>
  );
}
