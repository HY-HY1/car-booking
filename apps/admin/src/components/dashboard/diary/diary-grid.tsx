"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { WeeklyHours } from "@leadgen/core/booking/config";
import {
  assignLanes,
  canMoveJob,
  clockOf,
  DIARY_SNAP_MINS,
  dropStart,
  minuteOfDay,
  occupiesTime,
  overlaps,
  placeOnDay,
  toMinutes,
  visibleHours,
  withinHours,
  type DiaryView,
  type Placed,
  type TravelLeg,
} from "@leadgen/core/booking/diary";
import { localDate, localTime, weekday } from "@leadgen/core/booking/time";
import { askToConfirmWith } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { BOOKING_STATUS } from "@/lib/booking-display";
import { clock, HATCH, JOB_EDGE, JOB_FILL, longDate, shortDate } from "@/lib/diary-display";
import { appUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { diaryHref } from "./diary-controls";
import { LinkPending } from "./link-pending";

// The diary as a time grid: one column per day (or, in the day view with
// several vans, one per van), hours down the side. Jobs sit where they happen,
// time off is hatched, and the drive between two jobs is drawn in the gap
// between them. Clicking a job adds it to the address, which opens its panel;
// dragging one moves it, and clicking an empty slot adds a booking there.

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
  phone: string | null;
  address: string;
  hasEmail: boolean;
};

export type GridBlock = {
  id: string;
  start: string;
  end: string;
  reason: string | null;
  // Null = the whole business is off.
  resourceId: string | null;
  resourceName: string | null;
  // Busy in Google Calendar rather than time off set here.
  google?: boolean;
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

export type MoveJob = (
  bookingId: string,
  move: { date: string; time: string; resourceId: string; notify: boolean },
) => Promise<{ error?: string }>;

// Where a dragged job would land.
type Spot = Placed & { column: GridColumn; clash: boolean };

// How long a finger rests on a job before it picks up, so a swipe still scrolls.
const LONG_PRESS_MS = 350;
// How close to the window's edge a drag scrolls the page.
const SCROLL_EDGE = 64;

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
  moveJob,
  canAdd,
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
  // Left out for people who can't change bookings.
  moveJob?: MoveJob;
  canAdd: boolean;
}) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  // A drag ends with a click on whatever is underneath, which isn't a click.
  const justDragged = useRef(false);
  const [drag, setDrag] = useState<{ jobId: string; spot: Spot } | null>(null);
  const [slot, setSlot] = useState<{ key: string; minute: number } | null>(null);
  const [saving, startSaving] = useTransition();

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

  // The column nearest a point on screen, and the minute level with it.
  function locate(clientX: number, clientY: number) {
    const cells = [...(gridRef.current?.querySelectorAll<HTMLElement>("[data-column]") ?? [])];
    const nearest = cells
      .map((cell) => {
        const rect = cell.getBoundingClientRect();
        return { cell, rect, away: clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0 };
      })
      .sort((a, b) => a.away - b.away)[0];
    const column = nearest && columns.find((c) => c.key === nearest.cell.dataset.column);
    return column ? { column, minute: from + ((clientY - nearest.rect.top) / hourPx) * 60 } : null;
  }

  function clashes(job: GridJob, column: GridColumn, placed: Placed) {
    const resourceId = column.resourceId ?? job.resourceId;
    return jobs.some((other) => {
      if (other.id === job.id || other.resourceId !== resourceId || !occupiesTime(other.status)) return false;
      const p = placeOnDay(new Date(other.start), new Date(other.end), column.day, timeZone);
      return p !== null && overlaps(p, placed);
    });
  }

  // Picks a job up: straight away with a mouse once it's moved a little, after
  // a long press with a finger. Listens on the window so a drag can leave the job.
  function pickUp(event: ReactPointerEvent, job: GridJob, placed: Placed) {
    if (event.button !== 0 || saving) return;
    const touch = event.pointerType !== "mouse";
    const origin = { x: event.clientX, y: event.clientY };
    const grabbed = locate(origin.x, origin.y);
    if (!grabbed) return;
    const grab = grabbed.minute - placed.start;
    const duration = placed.end - placed.start;

    let pointer = origin;
    let active = false;
    let spot: Spot | null = null;
    let frame = 0;

    const place = () => {
      const found = locate(pointer.x, pointer.y);
      if (!found) return;
      const start = dropStart(found.minute, grab, duration, { from, to });
      const next = { start, end: start + duration };
      if (spot && spot.column.key === found.column.key && spot.start === start) return;
      spot = { ...next, column: found.column, clash: clashes(job, found.column, next) };
      setDrag({ jobId: job.id, spot });
    };
    const scrollAtEdges = () => {
      const by = pointer.y < SCROLL_EDGE ? -12 : pointer.y > window.innerHeight - SCROLL_EDGE ? 12 : 0;
      if (by) {
        window.scrollBy(0, by);
        place();
      }
      frame = requestAnimationFrame(scrollAtEdges);
    };
    const activate = () => {
      active = true;
      justDragged.current = true;
      setSlot(null);
      if (touch) navigator.vibrate?.(10);
      place();
      frame = requestAnimationFrame(scrollAtEdges);
    };

    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      if (active) return place();
      const moved = Math.hypot(pointer.x - origin.x, pointer.y - origin.y);
      if (touch && moved > 8) finish();
      else if (!touch && moved > 4) activate();
    };
    // Once a job is picked up, the finger moves it and not the page.
    const holdPage = (e: TouchEvent) => {
      if (active) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      finish();
      setDrag(null);
    };
    const onUp = () => {
      finish();
      if (active && spot) void settle(job, spot);
    };
    const onCancel = () => {
      finish();
      setDrag(null);
    };

    const press = touch ? window.setTimeout(activate, LONG_PRESS_MS) : 0;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", holdPage, { passive: false });

    function finish() {
      window.clearTimeout(press);
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchmove", holdPage);
      window.setTimeout(() => {
        justDragged.current = false;
      }, 50);
    }
  }

  // The job has been dropped: check it, ask, then move it.
  async function settle(job: GridJob, spot: Spot) {
    const start = new Date(job.start);
    const fromDay = localDate(start, timeZone);
    const resourceId = spot.column.resourceId ?? job.resourceId;
    const fromMinute = minuteOfDay(start, fromDay, timeZone);
    if (spot.column.day === fromDay && spot.start === fromMinute && resourceId === job.resourceId) return setDrag(null);
    if (spot.clash) {
      toast.error("Another job is already in that time.");
      return setDrag(null);
    }

    const name = job.customer ?? "this customer";
    const time = clockOf(spot.start);
    const newVan = resourceId !== job.resourceId ? columns.find((c) => c.resourceId === resourceId)?.title : undefined;
    const open = spot.column.hours[weekday(spot.column.day)] ?? [];
    const inTimeOff = blocksIn(spot.column).some((b) => {
      const p = placeOnDay(new Date(b.start), new Date(b.end), spot.column.day, timeZone);
      return p !== null && overlaps(p, spot);
    });
    const ahead = spot.column.day > today || (spot.column.day === today && spot.start > nowMinute);
    const timeChanged = spot.column.day !== fromDay || spot.start !== fromMinute;

    const answer = await askToConfirmWith(
      {
        title: `Move ${name}'s job?`,
        description: [
          `From ${shortDate(fromDay)} at ${clock(job.start, timeZone)} to ${shortDate(spot.column.day)} at ${time}${newVan ? ` on ${newVan}` : ""}.`,
          !withinHours(open, spot) && "That's outside your working hours.",
          inTimeOff && "That's during time off.",
          !ahead && "That time has already passed.",
        ]
          .filter(Boolean)
          .join(" "),
        confirmLabel: "Move job",
      },
      job.hasEmail && ahead && timeChanged ? { option: { label: `Email ${name} the new time`, defaultChecked: true } } : undefined,
    );
    if (!answer || !moveJob) return setDrag(null);

    startSaving(async () => {
      try {
        const { error } = await moveJob(job.id, { date: spot.column.day, time, resourceId, notify: answer.option });
        if (error) toast.error(error);
        else toast.success("Job moved");
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
      setDrag(null);
    });
  }

  function hoverSlot(event: ReactPointerEvent<HTMLDivElement>, column: GridColumn) {
    if (event.pointerType !== "mouse" || drag) return;
    if ((event.target as Element).closest("[data-item]")) return setSlot(null);
    const offset = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const minute = Math.min(
      Math.floor((from + (offset / hourPx) * 60) / DIARY_SNAP_MINS) * DIARY_SNAP_MINS,
      to - DIARY_SNAP_MINS,
    );
    if (slot?.key !== column.key || slot.minute !== minute) setSlot({ key: column.key, minute });
  }

  function addAt(event: MouseEvent<HTMLDivElement>, column: GridColumn) {
    if (justDragged.current || (event.target as Element).closest("[data-item]")) return;
    const offset = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const minute = Math.floor((from + (offset / hourPx) * 60) / DIARY_SNAP_MINS) * DIARY_SNAP_MINS;
    const params = new URLSearchParams({ date: column.day, time: clockOf(minute) });
    const resource = column.resourceId ?? resourceFilter;
    if (resource) params.set("resource", resource);
    router.push(appUrl(`/${slug}/bookings/new?${params}`));
  }

  return (
    <div ref={gridRef} className="hidden overflow-x-auto rounded-xl border bg-card md:block">
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
                <p className="text-sm font-medium">{c.title}</p>
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
          const ghost = drag?.spot.column.key === c.key ? drag.spot : null;

          return (
            <div
              key={c.key}
              data-column={c.key}
              className={cn("relative border-l bg-muted/40", c.day === today && "bg-primary/3", canAdd && "cursor-pointer")}
              style={{ height }}
              onPointerMove={canAdd ? (e) => hoverSlot(e, c) : undefined}
              onPointerLeave={canAdd ? () => setSlot(null) : undefined}
              onClick={canAdd ? (e) => addAt(e, c) : undefined}
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

              {slot?.key === c.key && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0.5 rounded-md bg-primary/10 px-1.5 text-[11px] leading-5 font-medium text-primary"
                  style={{ top: y(slot.minute), height: (30 / 60) * hourPx }}
                >
                  + {clockOf(slot.minute)}
                </div>
              )}

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
                    data-item
                    className="absolute inset-x-0.5 cursor-default overflow-hidden rounded-md border border-muted-foreground/30 px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground"
                    style={{ top, height: h, backgroundImage: HATCH }}
                    title={`${block.google ? "Busy in Google Calendar" : "Time off"}${block.resourceName ? ` (${block.resourceName})` : ""}${block.reason && !block.google ? `: ${block.reason}` : ""}`}
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
                    data-item
                    className={cn(
                      "absolute inset-x-1.5 cursor-default overflow-hidden rounded border border-dashed px-1 text-[10px] leading-4",
                      leg.tight
                        ? "border-red-400 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"
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
                // A job running past midnight can't be dropped whole on one day.
                const movable =
                  moveJob && canMoveJob(job.status) && localDate(new Date(job.start), timeZone) === localDate(new Date(job.end), timeZone);
                return (
                  <Link
                    key={job.id}
                    data-item
                    href={diaryHref(slug, view, c.day, job.id, resourceFilter)}
                    scroll={false}
                    draggable={false}
                    title={`${startText} to ${endText} · ${[job.customer, job.service, showResource && job.resourceName, BOOKING_STATUS[job.status]].filter(Boolean).join(" · ")}`}
                    aria-current={selected ? "true" : undefined}
                    onPointerDown={movable ? (e) => pickUp(e, job, { start, end }) : undefined}
                    onContextMenu={
                      movable
                        ? (e) => {
                            if ((e.nativeEvent as PointerEvent).pointerType === "touch") e.preventDefault();
                          }
                        : undefined
                    }
                    onClick={(e) => {
                      if (justDragged.current) e.preventDefault();
                    }}
                    className={cn(
                      "absolute z-10 overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-xs leading-snug shadow-sm outline-none select-none [-webkit-touch-callout:none] hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50",
                      JOB_EDGE[job.status] ?? "border-border",
                      JOB_FILL[job.status] ?? "bg-muted",
                      job.status === "no_show" && "opacity-80",
                      selected && "ring-2 ring-foreground",
                      movable && "cursor-grab active:cursor-grabbing",
                      drag?.jobId === job.id && "opacity-40",
                    )}
                    style={{
                      top,
                      height: h,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }}
                  >
                    <LinkPending />
                    <span className="block truncate font-medium">{job.customer ?? "Booking"}</span>
                    <span className="block truncate opacity-80">
                      {startText}–{endText}
                      {job.status === "held" && " · awaiting deposit"}
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

              {ghost && (
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-x-0.5 z-30 rounded-md border-2 border-dashed px-1.5 py-0.5 text-xs font-medium shadow-md",
                    ghost.clash
                      ? "border-destructive bg-destructive/15 text-destructive"
                      : "border-primary bg-primary/15 text-foreground",
                  )}
                  style={{ top: y(ghost.start), height: y(ghost.end) - y(ghost.start) }}
                >
                  {clockOf(ghost.start)}–{clockOf(ghost.end)}
                </div>
              )}

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
