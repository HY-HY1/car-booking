import Link from "next/link";
import type { WeeklyHours } from "@leadgen/core/booking/config";
import {
  assignLanes,
  minuteOfDay,
  placeOnDay,
  toMinutes,
  visibleHours,
  type DiaryView,
  type TravelLeg,
} from "@leadgen/core/booking/diary";
import { localTime, weekday } from "@leadgen/core/booking/time";
import { BOOKING_STATUS } from "@/lib/booking-display";
import { clock, longDate, shortDate } from "@/lib/diary-display";
import { cn } from "@/lib/utils";
import { diaryHref } from "./diary-controls";

// The diary as a time grid: one column per day (or, in the day view with
// several vans, one per van), hours down the side. Jobs sit where they happen,
// time off is hatched, and the drive between two jobs is drawn in the gap
// between them. Server-rendered; clicking a job adds it to the address, which
// opens its panel under the grid.

export type GridJob = {
  id: string;
  status: string;
  start: string;
  end: string;
  customer: string | null;
  service: string | null;
  vehicle: string | null;
  postcode: string;
  locationType: "mobile" | "unit";
  resourceId: string;
  resourceName: string;
};

export type GridBlock = {
  id: string;
  start: string;
  end: string;
  reason: string | null;
  // Null = the whole business is off.
  resourceId: string | null;
  resourceName: string | null;
};

export type GridLeg = TravelLeg & { resourceId: string };

export type GridColumn = {
  key: string;
  // The tenant-local date this column shows.
  day: string;
  // A column for one van or bay; null = everything.
  resourceId: string | null;
  // "day": a day in the week view. "resource": a van in the day view.
  variant: "day" | "resource";
  title: string;
  hours: WeeklyHours;
};

const TONE: Record<string, string> = {
  held: "border-amber-500 border-dashed bg-amber-100 text-amber-950",
  requested: "border-violet-500 border-dashed bg-violet-100 text-violet-950",
  confirmed: "border-emerald-600 bg-emerald-100 text-emerald-950",
  completed: "border-sky-600 bg-sky-100 text-sky-950",
  no_show: "border-red-600 bg-red-100 text-red-950 opacity-80",
};

export function DiaryGrid({
  slug,
  view,
  columns,
  today,
  now,
  timeZone,
  jobs,
  blocks,
  legs,
  selectedId,
  showResource,
  resourceFilter,
}: {
  slug: string;
  view: DiaryView;
  columns: GridColumn[];
  today: string;
  now: Date;
  timeZone: string;
  jobs: GridJob[];
  blocks: GridBlock[];
  legs: GridLeg[];
  selectedId?: string;
  // Name the van on each job (several are in the same column).
  showResource: boolean;
  // Kept in links so a chosen van stays chosen.
  resourceFilter?: string;
}) {
  const detailed = view === "day";
  const hourPx = detailed ? 64 : 48;
  const days = [...new Set(columns.map((c) => c.day))];

  const jobsIn = (c: GridColumn) => jobs.filter((j) => c.resourceId === null || j.resourceId === c.resourceId);
  const blocksIn = (c: GridColumn) =>
    blocks.filter((b) => c.resourceId === null || b.resourceId === null || b.resourceId === c.resourceId);
  const legsIn = (c: GridColumn) => legs.filter((l) => c.resourceId === null || l.resourceId === c.resourceId);

  // Jobs only decide how tall the grid is; a holiday shouldn't stretch it to
  // 24 hours.
  const placedJobs = columns.flatMap((c) =>
    jobsIn(c).flatMap((j) => {
      const p = placeOnDay(new Date(j.start), new Date(j.end), c.day, timeZone);
      return p ? [p] : [];
    }),
  );
  const allHours = columns.reduce<WeeklyHours>((acc, c) => {
    for (const [day, windows] of Object.entries(c.hours)) {
      acc[day as keyof WeeklyHours] = [...(acc[day as keyof WeeklyHours] ?? []), ...windows];
    }
    return acc;
  }, {});
  const { from, to } = visibleHours(days, allHours, placedJobs);
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from / 60 + i);
  const height = ((to - from) / 60) * hourPx;
  const y = (minute: number) => ((Math.min(Math.max(minute, from), to) - from) / 60) * hourPx;

  const nowMinute = minuteOfDay(now, today, timeZone);

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `3.25rem repeat(${columns.length}, minmax(${detailed && columns.length === 1 ? 0 : 6.5}rem, 1fr))`,
        }}
      >
        <div className="border-b" />
        {columns.map((c) => {
          const count = jobsIn(c).filter((j) => placeOnDay(new Date(j.start), new Date(j.end), c.day, timeZone)).length;
          const isToday = c.day === today;
          return (
            <div key={c.key} className={cn("border-b border-l px-2 py-2 text-center", isToday && "bg-primary/5")}>
              {c.variant === "resource" ? (
                <>
                  <p className="text-sm font-medium">{c.title}</p>
                </>
              ) : detailed ? (
                <p className="text-sm font-medium">{longDate(c.day)}</p>
              ) : (
                <Link href={diaryHref(slug, "day", c.day, undefined, resourceFilter)} className="group block">
                  <span className="block text-xs text-muted-foreground uppercase">{shortDate(c.day).slice(0, 3)}</span>
                  <span
                    className={cn(
                      "mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-sm font-medium group-hover:bg-muted",
                      isToday && "bg-primary text-primary-foreground group-hover:bg-primary/90",
                    )}
                  >
                    {Number(c.day.slice(8))}
                  </span>
                </Link>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {count === 0 ? "No jobs" : `${count} ${count === 1 ? "job" : "jobs"}`}
              </p>
            </div>
          );
        })}

        <div className="relative" style={{ height }} aria-hidden>
          {hours.map((h, i) => (
            <span
              key={h}
              className={cn("absolute right-2 text-[11px] text-muted-foreground tabular-nums", i > 0 && "-translate-y-1/2")}
              style={{ top: i * hourPx }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {columns.map((c) => {
          const open = c.hours[weekday(c.day)] ?? [];
          const dayJobs = assignLanes(
            jobsIn(c).flatMap((j) => {
              const p = placeOnDay(new Date(j.start), new Date(j.end), c.day, timeZone);
              return p ? [{ ...p, job: j }] : [];
            }),
          );
          const dayBlocks = blocksIn(c).flatMap((b) => {
            const p = placeOnDay(new Date(b.start), new Date(b.end), c.day, timeZone);
            return p ? [{ ...p, block: b }] : [];
          });
          const dayLegs = legsIn(c).flatMap((leg) => {
            const p = placeOnDay(leg.start, leg.end, c.day, timeZone);
            return p ? [{ ...p, leg }] : [];
          });

          return (
            <div
              key={c.key}
              className={cn("relative border-l bg-muted/40", c.day === today && "bg-primary/3")}
              style={{ height }}
            >
              {/* Working hours are drawn lighter than the rest of the day. */}
              {open.map(([start, end]) => (
                <div
                  key={start}
                  className="absolute inset-x-0 bg-card"
                  style={{ top: y(toMinutes(start)), height: y(toMinutes(end)) - y(toMinutes(start)) }}
                />
              ))}
              {hours.slice(1).map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: (i + 1) * hourPx }} />
              ))}

              {dayBlocks.map(({ start, end, block }) => {
                const top = y(start);
                const h = y(end) - top;
                if (h <= 0) return null;
                // In a column for everything, say which van it's for.
                const label = [c.resourceId === null ? block.resourceName : null, block.reason || "Time off"]
                  .filter(Boolean)
                  .join(": ");
                return (
                  <div
                    key={block.id}
                    className="absolute inset-x-0.5 overflow-hidden rounded-md border border-muted-foreground/30 px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground"
                    style={{
                      top,
                      height: h,
                      backgroundImage:
                        "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklch, currentColor 14%, transparent) 6px 7px)",
                    }}
                    title={`Time off${block.resourceName ? ` (${block.resourceName})` : ""}${block.reason ? `: ${block.reason}` : ""}`}
                  >
                    <span className="font-medium">{label}</span>
                  </div>
                );
              })}

              {dayLegs.map(({ start, end, leg }) => {
                if (leg.driveMins === 0 && !leg.tight) return null;
                const top = y(start);
                const h = y(end) - top;
                if (h <= 0) return null;
                const text = leg.tight
                  ? leg.driveMins !== null
                    ? `Tight: ~${leg.driveMins} min drive, ${leg.gapMins} min gap`
                    : `Tight: ${leg.gapMins} min gap`
                  : `~${leg.driveMins} min drive`;
                return (
                  <div
                    key={`${leg.fromId}-${leg.toId}`}
                    className={cn(
                      "absolute inset-x-1.5 overflow-hidden rounded border border-dashed px-1 text-[10px] leading-4",
                      leg.tight
                        ? "border-red-400 bg-red-50 text-red-800"
                        : "border-muted-foreground/40 bg-muted/70 text-muted-foreground",
                    )}
                    style={{ top, height: h }}
                    title={
                      leg.driveMins === null
                        ? `${leg.gapMins} min between jobs; the drive couldn't be estimated`
                        : `${leg.gapMins} min between jobs, about ${leg.driveMins} min of it driving`
                    }
                  >
                    {h >= 14 && text}
                  </div>
                );
              })}

              {dayJobs.map(({ start, end, lane, lanes, job }) => {
                const top = y(start);
                const h = Math.max(y(end) - top, 18);
                const selected = job.id === selectedId;
                const startText = clock(job.start, timeZone);
                const endText = clock(job.end, timeZone);
                return (
                  <Link
                    key={job.id}
                    href={diaryHref(slug, view, c.day, job.id, resourceFilter) + "#job"}
                    title={`${startText} to ${endText} · ${[job.customer, job.service, showResource && job.resourceName, BOOKING_STATUS[job.status]].filter(Boolean).join(" · ")}`}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "absolute z-10 overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-xs leading-snug shadow-sm outline-none hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50",
                      TONE[job.status] ?? "border-border bg-muted",
                      selected && "ring-2 ring-foreground",
                    )}
                    style={{
                      top,
                      height: h,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }}
                  >
                    <span className="block truncate font-medium">{job.customer ?? "Booking"}</span>
                    <span className="block truncate opacity-80">
                      {startText}–{endText}
                      {job.status === "held" && " · held"}
                    </span>
                    {showResource && h >= 52 && <span className="block truncate font-medium opacity-80">{job.resourceName}</span>}
                    {job.service && h >= (showResource ? 68 : 52) && <span className="block truncate opacity-80">{job.service}</span>}
                    {detailed && job.vehicle && h >= 84 && <span className="block truncate opacity-80">{job.vehicle}</span>}
                    {detailed && h >= 100 && (
                      <span className="block truncate opacity-80">
                        {job.locationType === "unit" ? "At the shop" : job.postcode}
                      </span>
                    )}
                  </Link>
                );
              })}

              {c.day === today && nowMinute > from && nowMinute < to && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                  style={{ top: y(nowMinute) }}
                  aria-label={`Now, ${localTime(now, timeZone)}`}
                >
                  <span className="absolute -top-1.25 -left-1 size-2 rounded-full bg-red-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
