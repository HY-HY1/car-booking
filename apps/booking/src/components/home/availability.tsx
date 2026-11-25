import { nextAvailability, type BookingConfig } from "@leadgen/core/booking/engine";
import { dayLabel, stripDay, type DayStatus } from "@leadgen/core/booking/next-available";
import { cn } from "@/lib/cn";

// At the top of the hero's booking card: the next day with time free and how
// the week looks, so customers see the diary is real and filling up. Worked
// out for the business's shortest job (or the length they chose); the
// booking form checks the actual job. If it can't be worked out, it just
// isn't shown.

const STATUS: Record<DayStatus, { text: string; dot: string }> = {
  open: { text: "Free", dot: "bg-emerald-500" },
  full: { text: "Booked up", dot: "bg-neutral-400" },
  closed: { text: "Closed", dot: "border border-neutral-300 bg-transparent" },
};

export async function Availability({
  tenantId,
  config,
  durationMins,
}: {
  tenantId: string;
  config: BookingConfig;
  durationMins: number;
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

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <p className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          {next ? (
            <>
              <span className="relative flex size-2.5 shrink-0" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
              {next === today ? "Available today" : `Next available ${dayLabel(next, today).replace(/^Tomorrow$/, "tomorrow")}`}
            </>
          ) : (
            "Fully booked for now"
          )}
        </p>
        <p className="text-sm text-neutral-600">
          {next
            ? booked >= 2
              ? `${booked} of the next ${days.length} days are booked up.`
              : "Pick a time that suits you."
            : "Get in touch and we'll let you know when something comes up."}
        </p>
      </div>

      <ol className="grid grid-cols-7 gap-1" aria-label="The next seven days">
        {days.map((d) => {
          const label = stripDay(d.date);
          return (
            <li
              key={d.date}
              className={cn(
                "grid justify-items-center gap-1 rounded-lg border px-0.5 py-2 text-center",
                d.status === "open" ? "border-emerald-600/30 bg-emerald-50" : d.status === "full" ? "bg-neutral-50" : "border-dashed opacity-60",
              )}
            >
              <span className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
                {d.date === today ? "Today" : label.weekday}
              </span>
              <span className={cn("text-base leading-none font-semibold tabular-nums", d.status === "full" && "text-neutral-400 line-through decoration-1")}>
                {label.day}
              </span>
              <span aria-hidden className={cn("size-1.5 rounded-full", STATUS[d.status].dot)} />
              <span className="sr-only">
                {label.full}: {STATUS[d.status].text}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function AvailabilitySkeleton() {
  return (
    <div aria-hidden className="grid gap-4">
      <div className="grid gap-2">
        <div className="h-6 w-52 animate-pulse rounded bg-neutral-100" />
        <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    </div>
  );
}
