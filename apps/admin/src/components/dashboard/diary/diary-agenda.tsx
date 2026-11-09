import Link from "next/link";
import { Plus } from "lucide-react";
import { minuteOfDay, placeOnDay, type DiaryView } from "@leadgen/core/booking/diary";
import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS, BOOKING_STATUS_TONE } from "@/lib/booking-display";
import { clock, HATCH, JOB_EDGE, shortDate } from "@/lib/diary-display";
import { appUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { ContactActions } from "./contact-actions";
import { diaryHref } from "./diary-controls";
import type { GridBlock, GridJob, GridLeg } from "./diary-grid";
import { LinkPending } from "./link-pending";

// The diary on a phone: each day as a list in time order, with a job's call,
// text and navigate buttons on its card.

type Entry =
  | { kind: "job"; at: number; job: GridJob }
  | { kind: "block"; at: number; block: GridBlock }
  | { kind: "leg"; at: number; leg: GridLeg };

// Jobs that are still to happen, or happening. No one rings a finished job.
const LIVE = ["held", "requested", "confirmed"];

export function DiaryAgenda({
  slug,
  view,
  days,
  today,
  now,
  timeZone,
  jobs,
  blocks,
  legs,
  selectedId,
  showResource,
  resourceFilter,
  canAdd,
}: {
  slug: string;
  view: DiaryView;
  days: string[];
  today: string;
  now: Date;
  timeZone: string;
  jobs: GridJob[];
  blocks: GridBlock[];
  legs: GridLeg[];
  selectedId?: string;
  showResource: boolean;
  resourceFilter?: string;
  canAdd: boolean;
}) {
  const nowMinute = minuteOfDay(now, today, timeZone);

  return (
    <div className="grid gap-6 md:hidden">
      {days.map((day) => {
        const placedAt = (start: Date, end: Date) => placeOnDay(start, end, day, timeZone)?.start;
        const entries: Entry[] = [
          ...jobs.flatMap((job): Entry[] => {
            const at = placedAt(new Date(job.start), new Date(job.end));
            return at === undefined || (resourceFilter && job.resourceId !== resourceFilter) ? [] : [{ kind: "job", at, job }];
          }),
          ...blocks.flatMap((block): Entry[] => {
            const at = placedAt(new Date(block.start), new Date(block.end));
            return at === undefined || (resourceFilter && block.resourceId && block.resourceId !== resourceFilter)
              ? []
              : [{ kind: "block", at, block }];
          }),
          ...legs.flatMap((leg): Entry[] => {
            const at = placedAt(leg.start, leg.end);
            return at === undefined || (leg.driveMins === 0 && !leg.tight) ? [] : [{ kind: "leg", at, leg }];
          }),
        ].sort((a, b) => a.at - b.at);

        const jobCount = entries.filter((e) => e.kind === "job").length;
        // The red "now" line goes before the first thing still to come.
        const nowIndex = day === today ? entries.findIndex((e) => e.at > nowMinute) : -1;
        const newBooking = appUrl(
          `/${slug}/bookings/new?date=${day}${resourceFilter ? `&resource=${resourceFilter}` : ""}`,
        );

        return (
          <section key={day} aria-label={shortDate(day)}>
            <header className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">
                {day === today ? "Today" : shortDate(day)}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {jobCount === 0 ? "No jobs" : `${jobCount} ${jobCount === 1 ? "job" : "jobs"}`}
                </span>
              </h2>
              {canAdd && (
                <Link
                  href={newBooking}
                  aria-label={`Add a booking on ${shortDate(day)}`}
                  className="-mr-2 grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-5" />
                </Link>
              )}
            </header>

            {entries.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Nothing booked.</p>
            ) : (
              <ol className="grid gap-2">
                {entries.map((entry, i) => (
                  <li key={entry.kind === "job" ? entry.job.id : entry.kind === "block" ? entry.block.id : `${entry.leg.fromId}-${entry.leg.toId}`} className="grid gap-2">
                    {i === nowIndex && <NowLine />}
                    {entry.kind === "job" ? (
                      <JobCard
                        job={entry.job}
                        href={diaryHref(slug, view, day, entry.job.id, resourceFilter)}
                        selected={entry.job.id === selectedId}
                        timeZone={timeZone}
                        showResource={showResource}
                      />
                    ) : entry.kind === "block" ? (
                      <BlockRow block={entry.block} timeZone={timeZone} />
                    ) : (
                      <LegRow leg={entry.leg} />
                    )}
                  </li>
                ))}
                {day === today && nowIndex === -1 && (
                  <li>
                    <NowLine />
                  </li>
                )}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

function JobCard({
  job,
  href,
  selected,
  timeZone,
  showResource,
}: {
  job: GridJob;
  href: string;
  selected: boolean;
  timeZone: string;
  showResource: boolean;
}) {
  const place = job.locationType === "unit" ? "At the shop" : job.postcode;
  return (
    <div
      className={cn(
        "rounded-xl border-l-4 bg-card ring-1 ring-foreground/10",
        JOB_EDGE[job.status] ?? "border-border",
        selected && "ring-2 ring-foreground",
      )}
    >
      <Link href={href} scroll={false} className="relative flex gap-3 overflow-hidden rounded-r-xl p-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <LinkPending />
        <div className="w-11 shrink-0 text-sm tabular-nums">
          <p className="font-medium">{clock(job.start, timeZone)}</p>
          <p className="text-muted-foreground">{clock(job.end, timeZone)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium">{job.customer ?? "Booking"}</p>
            <Badge tone={BOOKING_STATUS_TONE[job.status]}>{BOOKING_STATUS[job.status] ?? job.status}</Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">{[job.service, job.vehicle].filter(Boolean).join(" · ")}</p>
          <p className="truncate text-sm text-muted-foreground">{[place, showResource && job.resourceName].filter(Boolean).join(" · ")}</p>
        </div>
      </Link>
      {LIVE.includes(job.status) && (
        <div className="px-3 pb-3 empty:hidden">
          <ContactActions phone={job.phone} address={job.address} locationType={job.locationType} />
        </div>
      )}
    </div>
  );
}

function BlockRow({ block, timeZone }: { block: GridBlock; timeZone: string }) {
  return (
    <div
      className="rounded-xl border border-muted-foreground/30 px-3 py-2 text-sm text-muted-foreground"
      style={{ backgroundImage: HATCH }}
    >
      <span className="font-medium">{clock(block.start, timeZone)}–{clock(block.end, timeZone)}</span>{" "}
      {[block.resourceName, block.reason || "Time off"].filter(Boolean).join(": ")}
    </div>
  );
}

function LegRow({ leg }: { leg: GridLeg }) {
  const text = leg.tight
    ? leg.driveMins !== null
      ? `Tight: ~${leg.driveMins} min drive, ${leg.gapMins} min gap`
      : `Tight: ${leg.gapMins} min gap`
    : `~${leg.driveMins} min drive`;
  return (
    <p className={cn("border-l-2 border-dashed py-0.5 pl-3 ml-4 text-xs", leg.tight ? "border-red-400 text-red-800 dark:text-red-300" : "border-muted-foreground/40 text-muted-foreground")}>
      {text}
    </p>
  );
}

function NowLine() {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400">
      <span className="size-2 rounded-full bg-red-500" />
      Now
      <span className="h-0.5 flex-1 bg-red-500" />
    </div>
  );
}
