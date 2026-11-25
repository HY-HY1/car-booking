import { openingHoursLines, sameHours } from "@leadgen/core/booking/hours-text";
import type { BookingConfig } from "@leadgen/core/booking/engine";
import { cn } from "@/lib/cn";

type HoursSet = { label: string | null; lines: ReturnType<typeof openingHoursLines> };

// The hours for each way the business works: one list if it works only one
// way or keeps the same hours for both, else one for jobs at the customer's
// address and one for the premises.
export function openingHoursSets(settings: BookingConfig["settings"] | undefined): HoursSet[] {
  if (!settings || !(settings.offers_mobile || settings.offers_unit)) return [];
  const unitHours = settings.unit_weekly_hours ?? settings.weekly_hours;
  if (settings.offers_mobile && settings.offers_unit && !sameHours(settings.weekly_hours, unitHours)) {
    return [
      { label: "At your address", lines: openingHoursLines(settings.weekly_hours) },
      { label: "At our premises", lines: openingHoursLines(unitHours) },
    ];
  }
  return [{ label: null, lines: openingHoursLines(settings.offers_mobile ? settings.weekly_hours : unitHours) }];
}

export function OpeningHours({ sets, className }: { sets: HoursSet[]; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)}>
      {sets.map((set) => (
        <div key={set.label ?? "hours"} className="grid gap-1">
          {set.label && <p className="font-medium text-neutral-900">{set.label}</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            {set.lines.map((line) => (
              <div key={line.days} className="contents">
                <dt className="text-neutral-600">{line.days}</dt>
                <dd className={cn("text-right tabular-nums", line.hours === "Closed" ? "text-neutral-400" : "text-neutral-900")}>{line.hours}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
